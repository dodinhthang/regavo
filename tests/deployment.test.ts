import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { checkDeployment } from '../scripts/check-deployment.mjs';

type FixtureOptions = {
  cache?: boolean;
  changed?: boolean;
  workerMime?: string;
  spaFallback?: boolean;
};
async function fixture(
  options: FixtureOptions,
  run: (url: string, directory: string) => Promise<void>,
) {
  const directory = await mkdtemp(join(tmpdir(), 'regavo-deployment-'));
  const files: Record<string, [string, string]> = {
    '/index.html': [
      'text/html',
      '<title>Regavo</title><script src="/assets/index-test.js"></script><link href="/assets/index-test.css"><link href="/favicon.ico"><link href="/site.webmanifest">',
    ],
    '/assets/index-test.js': ['text/javascript', 'console.log("Regavo")'],
    '/assets/index-test.css': ['text/css', 'body { color: green; }'],
    '/assets/worker-test.js': ['text/javascript', 'self.onmessage = () => {};'],
    '/art/one.webp': ['image/webp', 'image-one'],
    '/art/two.webp': ['image/webp', 'image-two'],
    '/assets/background.webp': ['image/webp', 'image-three'],
    '/art/geometry.json': ['application/json', '{"frames":[]}'],
    '/favicon.ico': ['image/x-icon', 'icon'],
    '/site.webmanifest': ['application/manifest+json', '{}'],
    '/asset-manifest.json': [
      'application/json',
      JSON.stringify({
        images: [
          { file: '/art/one.webp' },
          { file: '/art/two.webp' },
          { file: '/assets/background.webp' },
        ],
        geometry: [{ file: '/art/geometry.json' }],
      }),
    ],
  };
  for (const [path, [, content]] of Object.entries(files)) {
    await mkdir(join(directory, path, '..'), { recursive: true });
    await writeFile(directory + path, content);
  }
  const server = createServer(async (request, response) => {
    const path = request.url === '/' ? '/index.html' : request.url!;
    const file = files[path];
    if (!file) {
      response.writeHead(options.spaFallback ? 200 : 404, { 'Content-Type': 'text/html' });
      response.end('missing');
      return;
    }
    response.setHeader(
      'Content-Type',
      path === '/assets/worker-test.js' && options.workerMime ? options.workerMime : file[0],
    );
    if ((path.startsWith('/art/') || path.startsWith('/assets/')) && options.cache !== false)
      response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.end(
      options.changed && path === '/assets/index-test.js'
        ? 'changed'
        : await readFile(directory + path),
    );
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    await run(`http://127.0.0.1:${address.port}`, directory);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(directory, { recursive: true, force: true });
  }
}

test('deployed artifact passes when content, MIME, cache and missing-asset responses match', async () => {
  await fixture({}, (url, directory) => checkDeployment(url, directory));
});
test('deployment verification rejects stale content and incorrect cache, Worker MIME or SPA fallback', async () => {
  for (const [options, message] of [
    [{ changed: true }, /deployed content differs/],
    [{ cache: false }, /immutable cache missing/],
    [{ workerMime: 'text/html' }, /MIME/],
    [{ spaFallback: true }, /Missing assets must return 404/],
  ] as const)
    await fixture(options, (url, directory) =>
      assert.rejects(checkDeployment(url, directory), message),
    );
});
