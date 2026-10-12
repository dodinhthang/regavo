import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const hash = (data) => createHash('sha256').update(data).digest('hex');
const civs = ['roman', 'mongol', 'persian', 'tang', 'ottoman', 'daiviet'];
const widths = [960, 1920];

async function rendererFingerprint(root, assets) {
  const files = ['scripts/lobby-previews.mjs', 'scripts/encode-image.mjs', 'pnpm-lock.yaml'];
  const walk = async (directory) => {
    for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
      const file = directory + '/' + entry.name;
      if (entry.isDirectory()) await walk(file);
      else files.push(file);
    }
  };
  for (const directory of ['src/render', 'src/game']) await walk(directory);
  for (const file of ['render-empire-preview', 'empire-preview-layout', 'preview-scene-fit'])
    files.push(`src/ui/${file}.ts`);
  const inputs = await Promise.all(files.sort().map((file) => readFile(join(root, file))));
  return hash(Buffer.concat([...inputs, Buffer.from(JSON.stringify(assets.urls))]));
}

/** Generate both responsive sizes once; corrupt/stale caches regenerate themselves. */
export async function prepareLobbyPreviews(root, assets) {
  const cache = join(root, 'node_modules/.cache/regavo-previews');
  await mkdir(cache, { recursive: true });
  const fingerprint = await rendererFingerprint(root, assets);
  let records;
  try {
    records = JSON.parse(await readFile(join(cache, fingerprint + '.json'), 'utf8'));
    if (records.length !== civs.length * 3 * widths.length) throw new Error('Incomplete previews');
    for (const record of records) {
      const data = await readFile(join(cache, record.name));
      if (hash(data) !== record.sha256) throw new Error('Invalid preview cache');
    }
  } catch {
    records = await renderPreviews(root, cache, fingerprint, assets);
    await writeFile(join(cache, fingerprint + '.json'), JSON.stringify(records));
  }
  const urls = {};
  for (const record of records) {
    record.file = '/art/' + record.name;
    urls[`${record.civ}:${record.age}:${record.width}`] = record.file;
    await copyFile(join(cache, record.name), join(assets.publicDir, 'art', record.name));
  }
  const manifestPath = join(assets.publicDir, 'asset-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.previews = records.map((record) => {
    const result = { ...record };
    delete result.name;
    return result;
  });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(
    `Lobby previews: ${records.length} scenes, ${(records.reduce((n, r) => n + r.bytes, 0) / 1048576).toFixed(1)} MiB total.`,
  );
  return urls;
}

async function renderPreviews(root, cache, fingerprint, assets) {
  const server = await createServer({
    root,
    configFile: false,
    publicDir: assets.publicDir,
    define: { __RUNTIME_ASSETS__: JSON.stringify(assets.urls) },
    server: { host: '127.0.0.1', port: 0 },
    plugins: [
      {
        name: 'render-lobby-previews',
        configureServer(server) {
          server.middlewares.use('/__render-previews', async (_request, response, next) => {
            try {
              response.setHeader('content-type', 'text/html');
              response.end(
                await server.transformIndexHtml(
                  '/__render-previews',
                  '<!doctype html><title>Regavo asset renderer</title>',
                ),
              );
            } catch (error) {
              next(error);
            }
          });
        },
      },
    ],
  });
  const encoder = new Worker(new URL('./encode-image.mjs', import.meta.url));
  let browser;
  const records = [];
  try {
    await server.listen();
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.on('response', (response) => {
      if (response.status() >= 400)
        console.error(`Preview renderer: ${response.status()} ${response.url()}`);
    });
    page.on('requestfailed', (request) =>
      console.error(`Preview request failed: ${request.url()} ${request.failure()?.errorText}`),
    );
    page.on('pageerror', (error) => console.error(error.message));
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__render-previews`);
    for (const civ of civs)
      for (const age of [1, 2, 3]) {
        const images = await page.evaluate(
          async ({ civ, age, widths, moduleUrl }) => {
            const { renderEmpirePreview } = await import(moduleUrl);
            const canvas = await renderEmpirePreview(
              civ,
              age,
              widths.at(-1),
              new AbortController().signal,
            );
            return widths.map((width) => {
              // eslint-disable-next-line no-undef -- executed inside Chromium
              const sized = document.createElement('canvas');
              sized.width = width;
              sized.height = Math.round(width * 0.54);
              sized.getContext('2d').drawImage(canvas, 0, 0, sized.width, sized.height);
              return sized.toDataURL('image/png').split(',')[1];
            });
          },
          { civ, age, widths, moduleUrl: '/src/ui/render-empire-preview.ts' },
        );
        for (const [index, width] of widths.entries()) {
          const source = join(cache, `${fingerprint}-${civ}-${age}-${width}.png`);
          const output = source.replace(/\.png$/, '.webp');
          await writeFile(source, Buffer.from(images[index], 'base64'));
          const result = await new Promise((resolve, reject) => {
            const fail = (error) => {
              encoder.off('message', done);
              reject(error);
            };
            const done = (message) => {
              encoder.off('error', fail);
              message.error ? reject(new Error(message.error)) : resolve(message);
            };
            encoder.once('error', fail);
            encoder.once('message', done);
            encoder.postMessage({ source, output });
          });
          const name = `preview-${civ}-${age}-${width}-${result.sha256.slice(0, 16)}.webp`;
          await copyFile(output, join(cache, name));
          records.push({ civ, age, ...result, name, rendererSha256: fingerprint });
        }
        console.log(`Rendered lobby: ${civ} age ${age}`);
      }
  } finally {
    await browser?.close();
    await server.close();
    await encoder.terminate();
  }
  return records;
}
