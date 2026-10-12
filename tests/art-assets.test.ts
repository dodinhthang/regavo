import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CIVILIZATION_ART } from '../src/render/civilization-art-data.ts';
import {
  DAI_VIET_DRAGON_FILE,
  DAI_VIET_DRAGON_SIZE,
  DAI_VIET_DRAGON_FRAME,
} from '../src/render/daiviet-emblem.ts';

test('retained civilization artwork matches its PNG records and all registered frames remain intact', () => {
  const origins = JSON.parse(
    readFileSync(new URL('../public/asset-origins.json', import.meta.url), 'utf8'),
  );
  const sources = new Map<string, Buffer>();
  for (const asset of origins.runtimeArt.generatedAssets) {
    const png = readFileSync(new URL('../public' + asset.file, import.meta.url));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', asset.file);
    assert.equal(createHash('sha256').update(png).digest('hex'), asset.sha256, asset.file);
    assert.equal(png.length, asset.bytes, asset.file);
    sources.set(asset.file, png);
  }
  assert.ok(sources.size > 0);
  for (const [civ, definition] of Object.entries(CIVILIZATION_ART)) {
    if (definition.kind !== 'sheets') continue;
    for (const [key, sheet] of Object.entries(definition.sheets)) {
      const label = civ + '/' + key;
      const png = sources.get('/art/' + sheet.file);
      assert.ok(png, label + ' must have a source record');
      const dimensions = [png.readUInt32BE(16), png.readUInt32BE(20)];
      assert.deepEqual(sheet.dimensions ?? [1536, 1024], dimensions, label);
      assert.ok(sheet.frames.length > 0, label);
      for (const [x, y, width, height] of sheet.frames) {
        assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0, label);
        assert.ok(x + width <= dimensions[0] && y + height <= dimensions[1], label);
      }
    }
  }
  const metadata = JSON.parse(
    readFileSync(new URL('../src/render/daiviet-frames.json', import.meta.url), 'utf8'),
  );
  const manifest = JSON.parse(
    readFileSync(new URL('../public/art/daiviet-v3.manifest.json', import.meta.url), 'utf8'),
  );
  for (const asset of manifest.assets) {
    const file = readFileSync(new URL('../public' + asset.file, import.meta.url));
    assert.equal(createHash('sha256').update(file).digest('hex'), asset.sha256);
    assert.deepEqual([file.readUInt32BE(16), file.readUInt32BE(20)], asset.dimensions);
    for (const [x, y, width, height] of asset.frames) {
      assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0, asset.id);
      assert.ok(x + width <= asset.dimensions[0] && y + height <= asset.dimensions[1], asset.id);
    }
  }
  assert.equal(metadata['buildings-farms'].frames.length, 3);
  assert.equal(metadata['buildings-towncenter-age3'].frames.length, 1);
  assert.equal(metadata['buildings-major-age3'].frames.length, 2);
  assert.equal(metadata['units-cannon-walk-a'].frames.length, 16);
  assert.ok(
    metadata['buildings-age2'].frames[10][1] < 667,
    'tower roof extends above its former atlas-row cut',
  );
  const hall = manifest.assets.find((a: { id: string }) => a.id === 'buildings-towncenter-age3');
  assert.equal(hall.originalDesign, '/art/daiviet-v1-buildings-age3.png');
});

test('the civilization ornament keeps its registered image and intact crop', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../public/art/daiviet-v4-emblem.manifest.json', import.meta.url), 'utf8'),
  );
  const png = readFileSync(new URL('../public' + DAI_VIET_DRAGON_FILE, import.meta.url));
  assert.equal(createHash('sha256').update(png).digest('hex'), manifest.sha256);
  assert.deepEqual(
    [png.readUInt32BE(16), png.readUInt32BE(20)],
    [DAI_VIET_DRAGON_SIZE, DAI_VIET_DRAGON_SIZE],
  );
  assert.deepEqual([...DAI_VIET_DRAGON_FRAME], manifest.frame);
  const [x, y, width, height] = DAI_VIET_DRAGON_FRAME;
  assert.ok(
    x >= 0 && y >= 0 && x + width <= DAI_VIET_DRAGON_SIZE && y + height <= DAI_VIET_DRAGON_SIZE,
  );
});

test('age III architecture keeps its registered base atlas and hall/house revision', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../public/art/daiviet-v9.manifest.json', import.meta.url), 'utf8'),
  );
  const metadata = JSON.parse(
    readFileSync(new URL('../src/render/daiviet-frames.json', import.meta.url), 'utf8'),
  );
  assert.equal(manifest.modelOrder.length, 17);
  assert.equal(new Set(manifest.modelOrder).size, 17);
  const revision = JSON.parse(
    readFileSync(new URL('../public/art/daiviet-v10.manifest.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(revision.modelOrder, ['towncenter', 'house']);
  for (const asset of [manifest, revision]) {
    const png = readFileSync(new URL('../public' + asset.file, import.meta.url));
    assert.equal(createHash('sha256').update(png).digest('hex'), asset.sha256);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], asset.dimensions);
    const sheet =
      metadata[
        asset.version === 10 ? 'buildings-towncenter-house-age3-v10' : 'buildings-unified-age3'
      ];
    assert.deepEqual(sheet.frames, asset.frames);
    assert.deepEqual(sheet.foundations, asset.foundations);
    assert.deepEqual(sheet.barrierSockets, asset.barrierSockets);
    assert.equal('/art/' + sheet.file, asset.file);
    for (const [x, y, width, height] of asset.frames)
      assert.ok(
        x >= 0 && y >= 0 && x + width <= asset.dimensions[0] && y + height <= asset.dimensions[1],
      );
  }
});
