import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { carryResource } from '../src/render/cargo.ts';
import { DAI_VIET_ART } from '../src/render/civilizations/daiviet.ts';
import { selectUnitArt } from '../src/render/civilization-art-definition.ts';

const cargoPose = (resource: string, phase: number) =>
  selectUnitArt(DAI_VIET_ART, 'villager', phase, 0, 'carry', resource)!.pose;

test('resource aliases choose timber, ore, stone and hunting loads independently of food', () => {
  for (const activity of ['wood', 'tree', 'chop', 'lumber', 'timber'])
    assert.equal(carryResource(activity), 'wood');
  for (const activity of ['food', 'grain', 'berries', 'berry', 'farm', 'harvest'])
    assert.equal(carryResource(activity), 'food');
  for (const activity of ['meat', 'hunt', 'deer', 'boar'])
    assert.equal(carryResource(activity), 'meat');
  assert.equal(carryResource('GOLD ORE'), 'gold');
  assert.equal(carryResource('stone'), 'stone');
  assert.equal(carryResource(''), 'generic');
});

test('Dai Viet non-food cargo has distinct atlas/cache identities and four complete walking poses', () => {
  const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
  const sheets = read('../src/render/daiviet-cargo-frames.json');
  const manifest = read('../public/art/daiviet-cargo-v13.manifest.json');
  assert.equal(manifest.assets.length, 4);
  const files = new Set();
  for (const resource of ['wood', 'gold', 'stone', 'meat']) {
    const asset = manifest.assets.find((item: { resource: string }) => item.resource === resource);
    const sheet = sheets['units-cargo-' + resource];
    const png = readFileSync(new URL('../public' + asset.file, import.meta.url));
    assert.equal(createHash('sha256').update(png).digest('hex'), asset.sha256);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1536, 1024]);
    assert.deepEqual(sheet.frames, asset.frames);
    assert.equal(sheet.frames.length, 16);
    assert.ok(asset.transparentPixels > 1000000);
    files.add(sheet.file);
    for (let phase = 0; phase < 4; phase++) {
      const pose = cargoPose(resource, phase);
      assert.equal(pose.sheet, asset.runtimeKey);
      assert.equal(pose.row, phase);
      for (let direction = 0; direction < 4; direction++) {
        const [x, y, w, h, px, py] = sheet.frames[pose.row * 4 + direction];
        assert.ok(x >= 0 && y >= 0 && x + w <= 1536 && y + h <= 1024);
        assert.ok(px > 0 && px < w && py > 0 && py < h);
      }
    }
    assert.deepEqual(cargoPose(resource, 5), cargoPose(resource, 1));
  }
  assert.equal(files.size, 4);
  assert.equal(
    cargoPose('food', 0).sheet,
    'units-people-walk-a',
    'food keeps its original basket poses',
  );
  assert.equal(cargoPose('food', 0).row, 3);
});
