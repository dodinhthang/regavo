import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export async function checkDeployment(base, directory = 'dist') {
  assert.ok(base, 'DEPLOYMENT_URL is required.');
  const url = new URL(base);
  assert.ok(
    url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)),
    'Deployment URL must use HTTPS.',
  );
  const hash = (data) => createHash('sha256').update(data).digest('hex');
  const get = async (path) => {
    const response = await fetch(new URL(path, url), {
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
    assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
    return response;
  };
  const verify = async (path, mime, immutable = false) => {
    const response = await get(path);
    const type = response.headers.get('content-type') ?? '';
    assert.match(type, mime, `${path}: MIME ${type}`);
    const body = Buffer.from(await response.arrayBuffer());
    assert.equal(
      hash(body),
      hash(await readFile(directory + path)),
      `${path}: deployed content differs from the verified artifact`,
    );
    if (immutable) {
      const cache = response.headers.get('cache-control') ?? '';
      assert.match(cache, /\bimmutable\b/, `${path}: immutable cache missing`);
      assert.match(cache, /\bmax-age=31536000\b/, `${path}: cache lifetime differs`);
    }
  };
  const index = await get('/');
  assert.match(index.headers.get('content-type') ?? '', /text\/html/);
  const html = await index.text();
  assert.equal(
    hash(html),
    hash(await readFile(directory + '/index.html')),
    'Deployed HTML differs from the verified artifact',
  );
  assert.doesNotMatch(
    index.headers.get('cache-control') ?? '',
    /\bimmutable\b/,
    'HTML must not have immutable caching',
  );
  await verify('/asset-manifest.json', /application\/json/);
  const manifest = JSON.parse(await readFile(directory + '/asset-manifest.json', 'utf8'));
  const images = [
    manifest.images[0],
    manifest.images[Math.floor(manifest.images.length / 2)],
    manifest.images.at(-1),
  ];
  for (const image of images) await verify(image.file, /image\/webp/, true);
  for (const geometry of manifest.geometry) await verify(geometry.file, /application\/json/, true);
  const assets = await readdir(directory + '/assets');
  const worker = assets.find((file) => /^worker-[^/]+\.js$/.test(file));
  assert.ok(worker, 'Built simulation Worker is missing');
  await verify('/assets/' + worker, /(?:java|ecma)script/, true);
  for (const match of html.matchAll(/(?:src|href)="(\/[^"#]+)"/g)) {
    const path = match[1];
    if (path.endsWith('.js')) await verify(path, /(?:java|ecma)script/, true);
    else if (path.endsWith('.css')) await verify(path, /text\/css/, true);
    else if (/\.(png|ico)$/.test(path)) await verify(path, /image\//);
    else if (path.endsWith('.webmanifest'))
      await verify(path, /(?:application\/manifest\+json|application\/json)/);
  }
  const missing = await fetch(new URL('/art/regavo-missing-smoke-asset.png', url), {
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(missing.status, 404, 'Missing assets must return 404, not SPA HTML');
  console.log(`Verified production content, Worker and cache headers at ${url.origin}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await checkDeployment(process.env.DEPLOYMENT_URL);
      break;
    } catch (error) {
      if (attempt === 5 || !process.env.DEPLOYMENT_URL) throw error;
      console.warn(`Deployment verification attempt ${attempt} failed: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}
