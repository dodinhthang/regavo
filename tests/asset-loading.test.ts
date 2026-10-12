import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loadBuildingAtlas } from '../src/render/atlas.ts';
import { loadSecondaryBuildings } from '../src/render/buildings.ts';
import { loadUnitAtlases, getUnitAnimationStatus } from '../src/render/units.ts';

test('preview loads only selected architecture and idle poses, then upgrades to full match art', async () => {
  const originalImage = globalThis.Image;
  const requests: string[] = [];
  class MockImage {
    naturalWidth = 0;
    naturalHeight = 0;
    onload?: () => void;
    onerror?: () => void;
    set src(url: string) {
      requests.push(url);
      const png = readFileSync(new URL('../public' + url, import.meta.url));
      this.naturalWidth = png.readUInt32BE(16);
      this.naturalHeight = png.readUInt32BE(20);
      queueMicrotask(() => this.onload?.());
    }
  }
  globalThis.Image = MockImage as unknown as typeof Image;
  try {
    assert.deepEqual(
      await Promise.all([
        loadBuildingAtlas(['roman'], [1]),
        loadBuildingAtlas(['persian'], [3]),
        loadBuildingAtlas(['roman'], [1]),
      ]),
      [true, true, true],
    );
    assert.deepEqual(requests.sort(), [
      '/art/building-centers-v6-age1.png',
      '/art/building-centers-v7-age3.png',
    ]);
    requests.length = 0;
    assert.equal(await loadBuildingAtlas(['daiviet'], [3]), true);
    assert.deepEqual(requests.sort(), [
      '/art/daiviet-v10-townhall-house-age3.png',
      '/art/daiviet-v4-dragon-emblem.png',
      '/art/daiviet-v9-buildings-age3.png',
    ]);
    requests.length = 0;
    assert.equal(await loadSecondaryBuildings(['house', 'barracks', 'farm'], 3), true);
    assert.deepEqual(requests.sort(), [
      '/art/buildings-v3-a.png',
      '/art/buildings-v6-age3-a.png',
      '/art/buildings-v6-age3-b.png',
    ]);
    requests.length = 0;
    assert.equal(await loadUnitAtlases(['daiviet'], 'preview'), true);
    assert.ok(requests.some((url) => url.includes('units-people-walk-a')));
    assert.ok(requests.every((url) => !/impact|windup|carry-|walk-[bcd]/.test(url)));
    const previewRequests = new Set(requests);
    requests.length = 0;
    assert.equal(await loadUnitAtlases(['daiviet']), true);
    assert.ok(requests.some((url) => url.includes('carry-wood')));
    assert.ok(requests.some((url) => url.includes('infantry-impact')));
    assert.ok(
      requests.every((url) => !previewRequests.has(url)),
      'idle sources are reused',
    );
    requests.length = 0;
    assert.equal(await loadUnitAtlases(['ottoman'], 'preview'), true);
    assert.ok(
      requests.includes('/art/units-siege-v6-cannon.png'),
      'idle cannon keeps its authored art',
    );
    assert.equal(getUnitAnimationStatus().attackPoseSheets.cannon, true);
    assert.equal(
      getUnitAnimationStatus().workerPoseSheets.ottoman,
      true,
      'idle Ottoman villagers require their authored work sheet',
    );
    const deselectedSheets = getUnitAnimationStatus().civilizationArt.daiviet.sheets;
    assert.ok(deselectedSheets);
    assert.ok(
      Object.entries(deselectedSheets).every(
        ([key, loaded]) => !key.startsWith('units-') || !loaded,
      ),
      'switching away after a match releases every independent unit sheet',
    );
    requests.length = 0;
    for (const civ of ['roman', 'mongol']) {
      assert.equal(await loadUnitAtlases([civ], 'preview'), true);
      assert.equal(
        getUnitAnimationStatus().workerPoseSheets[civ],
        true,
        `${civ} idle villagers must not fall back to procedural blocks`,
      );
      if (civ === 'roman')
        assert.equal(
          getUnitAnimationStatus().infantryStrideSheet,
          true,
          'Roman legionaries use the shared infantry stance even while idle',
        );
    }
    requests.length = 0;
    assert.equal(await loadSecondaryBuildings(), true);
    assert.ok(requests.some((url) => url.includes('age1')));
    assert.equal(await loadBuildingAtlas(), true);
    assert.ok(requests.includes('/art/building-centers-v7-age2.png'));
  } finally {
    globalThis.Image = originalImage;
  }
});
