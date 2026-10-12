import { createHash } from 'node:crypto';
import { availableParallelism } from 'node:os';
import { readdir, readFile, mkdir, rm, copyFile, writeFile, cp } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { Worker } from 'node:worker_threads';

const hash = (data) => createHash('sha256').update(data).digest('hex');
const codec = 'jsquash-png-3.1.1-webp-1.5.0-lossless-exact-m4-q75-v1';

/** Literal loader references plus the active registry, including explicit fallback sources. */
export async function runtimeArtFiles(root, definitions) {
  const files = new Set();
  const manifests = new Set();
  const walk = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.name.endsWith('.ts')) {
        const text = await readFile(path, 'utf8');
        for (const match of text.matchAll(/[\w-]+\.png/g)) files.add(match[0]);
        for (const match of text.matchAll(/[\w-]+\.manifest\.json/g)) manifests.add(match[0]);
      }
    }
  };
  await walk(join(root, 'src/render'));
  for (const definition of Object.values(definitions)) {
    if (definition.kind !== 'sheets') continue;
    const keys = new Set([
      ...Object.values(definition.buildings)
        .flat()
        .map((pose) => pose.sheet),
      ...(definition.unitSheets ?? []),
      ...Object.values(definition.units).flatMap((unit) => [
        unit.reference.sheet,
        ...Object.values(unit.actions)
          .flat()
          .map((pose) => pose.sheet),
        ...Object.values(unit.cargo ?? {})
          .flat()
          .map((pose) => pose.sheet),
      ]),
    ]);
    for (const key of keys) files.add(definition.sheets[key].file);
  }
  return { images: [...files].sort(), manifests: [...manifests].sort() };
}

async function encodeJobs(jobs, onProgress) {
  const workers = [];
  let next = 0;
  let completed = 0;
  try {
    await Promise.all(
      Array.from({ length: Math.min(4, availableParallelism(), jobs.length) }, async () => {
        const worker = new Worker(new URL('./encode-image.mjs', import.meta.url));
        workers.push(worker);
        while (next < jobs.length) {
          const job = jobs[next++];
          const result = await new Promise((resolve, reject) => {
            const done = (message) => {
              worker.off('error', fail);
              message.error ? reject(new Error(message.error)) : resolve(message);
            };
            const fail = (error) => {
              worker.off('message', done);
              reject(error);
            };
            worker.once('message', done);
            worker.once('error', fail);
            worker.postMessage({ source: job.source, output: job.output });
          });
          Object.assign(job.record, result);
          await writeFile(job.metadata, JSON.stringify(job.record));
          onProgress(++completed, jobs.length);
        }
      }),
    );
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate()));
  }
}

export async function prepareRuntimeAssets(root, definitions) {
  const cache = join(root, 'node_modules/.cache/regavo-assets');
  const publicDir = join(cache, 'public');
  await rm(publicDir, { recursive: true, force: true });
  await mkdir(join(publicDir, 'art'), { recursive: true });
  await mkdir(join(publicDir, 'ui'), { recursive: true });
  const selection = await runtimeArtFiles(root, definitions);
  const sources = [
    ...selection.images.map((file) => ({
      source: join(root, 'public/art', file),
      url: '/art/' + file,
    })),
    { source: join(root, 'src/assets/battlefield.png'), url: '/assets/battlefield.png' },
  ];
  const jobs = [];
  for (const item of sources) {
    const data = await readFile(item.source);
    const sourceSha256 = hash(data);
    const key = hash(codec + sourceSha256);
    item.output = join(cache, key + '.webp');
    item.metadata = join(cache, key + '.json');
    item.record = { source: item.url, sourceBytes: data.length, sourceSha256, codec };
    try {
      const metadata = JSON.parse(await readFile(item.metadata, 'utf8'));
      const cached = await readFile(item.output);
      if (hash(cached) !== metadata.sha256) throw new Error('Invalid image cache');
      for (const key of ['bytes', 'sha256', 'width', 'height']) item.record[key] = metadata[key];
    } catch {
      jobs.push(item);
    }
  }
  if (jobs.length) console.log(`Optimizing ${jobs.length} runtime images (lossless WebP)…`);
  await encodeJobs(jobs, (done, total) => {
    if (done % 10 === 0 || done === total) console.log(`Runtime images: ${done}/${total}`);
  });
  const urls = {};
  for (const item of sources) {
    const file = basename(item.url, '.png') + '-' + item.record.sha256.slice(0, 16) + '.webp';
    item.record.file = '/art/' + file;
    if (item.url.startsWith('/art/')) {
      urls[item.url] = item.record.file;
      await copyFile(item.output, join(publicDir, 'art', file));
    }
  }
  const geometry = [];
  for (const file of selection.manifests) {
    const data = await readFile(join(root, 'public/art', file));
    const sha256 = hash(data);
    const output = basename(file, '.json') + '-' + sha256.slice(0, 16) + '.json';
    urls['/art/' + file] = '/art/' + output;
    geometry.push({ source: '/art/' + file, file: '/art/' + output, sha256 });
    await writeFile(join(publicDir, 'art', output), data);
  }
  for (const file of [
    'favicon.ico',
    'favicon-32.png',
    'favicon-64.png',
    'apple-touch-icon.png',
    'site.webmanifest',
    'third-party-licenses.txt',
    '_headers',
  ])
    await copyFile(join(root, 'public', file), join(publicDir, file));
  await cp(join(root, 'public/icons'), join(publicDir, 'icons'), { recursive: true });
  await copyFile(join(root, 'public/ui/grain.svg'), join(publicDir, 'ui/grain.svg'));
  await copyFile(join(root, 'LICENSE'), join(publicDir, 'project-license.txt'));
  const retained = (await readdir(join(root, 'public/art'))).filter((file) =>
    file.endsWith('.png'),
  );
  const omitted = retained.filter((file) => !selection.images.includes(file));
  const originalBytes = sources.reduce((sum, item) => sum + item.record.sourceBytes, 0);
  const outputBytes = sources.reduce((sum, item) => sum + item.record.bytes, 0);
  const manifest = {
    schemaVersion: 1,
    projectLicense: 'MIT',
    encoding:
      'Lossless WebP with exact RGBA, unchanged dimensions; source PNGs retained in repository.',
    originalBytes,
    outputBytes,
    omittedHistoricalImages: omitted,
    geometry,
    images: sources.map((item) => item.record),
  };
  // The background is emitted by Vite; its final hashed filename is recorded after bundling.
  manifest.images.at(-1).file = null;
  await writeFile(join(publicDir, 'asset-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(
    `Runtime artwork: ${(originalBytes / 1048576).toFixed(1)} → ${(outputBytes / 1048576).toFixed(1)} MiB; ${omitted.length} historical PNGs omitted.`,
  );
  const background = join(
    cache,
    'battlefield-' + sources.at(-1).record.sha256.slice(0, 16) + '.webp',
  );
  await copyFile(sources.at(-1).output, background);
  return { publicDir, urls, background };
}
