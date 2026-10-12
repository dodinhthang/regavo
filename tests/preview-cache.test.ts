import assert from 'node:assert/strict';
import test from 'node:test';
import { PreviewSceneCache } from '../src/ui/preview-scene-cache.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('completed previews are reused without reloading evicted sprite atlases', async () => {
  const cache = new PreviewSceneCache<string>(12);
  const signal = new AbortController().signal;
  let renders = 0;
  const create = async () => {
    renders++;
    return 'Persia';
  };
  const first = cache.load('persian:3:1500', 4, signal, create);
  const duplicate = cache.load('persian:3:1500', 4, signal, create);
  assert.deepEqual(await Promise.all([first, duplicate]), ['Persia', 'Persia']);
  assert.equal(await cache.load('persian:3:1500', 4, signal, create), 'Persia');
  assert.equal(renders, 1);
});

test('a cached selection is immediate even while another scene is preparing', async () => {
  const cache = new PreviewSceneCache<string>(12);
  const signal = new AbortController().signal;
  await cache.load('roman', 4, signal, async () => 'Rome');
  const held = deferred<string>();
  const pending = cache.load('mongol', 4, signal, () => held.promise);
  assert.equal(await cache.load('roman', 4, signal, async () => 'wrong'), 'Rome');
  held.resolve('Mongolia');
  await pending;
});

test('rapid selections skip cancelled queued scenes and discard a cancelled in-flight result', async () => {
  const cache = new PreviewSceneCache<string>(12);
  const firstController = new AbortController();
  const nextController = new AbortController();
  const held = deferred<string>();
  const calls: string[] = [];
  const first = cache.load('first', 4, firstController.signal, async () => {
    calls.push('first');
    return held.promise;
  });
  const firstRejected = assert.rejects(first, { name: 'AbortError' });
  await Promise.resolve();
  const skipped = cache.load('skipped', 4, nextController.signal, async () => {
    calls.push('skipped');
    return 'stale';
  });
  const skippedRejected = assert.rejects(skipped, { name: 'AbortError' });
  const latest = cache.load('latest', 4, new AbortController().signal, async () => {
    calls.push('latest');
    return 'selected';
  });
  firstController.abort();
  nextController.abort();
  held.resolve('old');
  await Promise.all([firstRejected, skippedRejected]);
  assert.equal(await latest, 'selected');
  assert.deepEqual(calls, ['first', 'latest']);
  assert.equal(cache.get('first'), undefined);
  assert.equal(cache.get('skipped'), undefined);
});

test('preview memory budget evicts least recently viewed scenes', async () => {
  const cache = new PreviewSceneCache<string>(8);
  const signal = new AbortController().signal;
  await cache.load('roman', 4, signal, async () => 'Rome');
  await cache.load('persian', 4, signal, async () => 'Persia');
  assert.equal(cache.get('roman'), 'Rome');
  await cache.load('tang', 4, signal, async () => 'Tang');
  assert.equal(cache.get('persian'), undefined);
  assert.equal(cache.get('roman'), 'Rome');
  assert.equal(cache.get('tang'), 'Tang');
  await cache.load('large', 9, signal, async () => 'large');
  assert.equal(cache.get('large'), undefined);
  assert.equal(cache.get('roman'), 'Rome');
});

test('a failed preparation can be retried without blocking later selections', async () => {
  const cache = new PreviewSceneCache<string>(8);
  const signal = new AbortController().signal;
  await assert.rejects(
    cache.load('roman', 4, signal, async () => {
      throw new Error('network failure');
    }),
    /network failure/,
  );
  assert.equal(await cache.load('roman', 4, signal, async () => 'Rome'), 'Rome');
});
