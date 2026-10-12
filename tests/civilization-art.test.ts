import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CIVS } from '../src/game/data.ts';
import { CIVILIZATION_ART, sharedAtlasColumn } from '../src/render/civilization-art-data.ts';
import { DAI_VIET_ART } from '../src/render/civilizations/daiviet.ts';
import {
  selectBuildingArt,
  selectUnitArt,
  type SheetArtDefinition,
} from '../src/render/civilization-art-definition.ts';
import { createSheetArt } from '../src/render/sheet-art.ts';

test('every playable civilization registers its art layout without changing shared atlas columns', () => {
  assert.deepEqual(Object.keys(CIVILIZATION_ART), Object.keys(CIVS));
  assert.deepEqual(
    ['roman', 'mongol', 'persian', 'tang', 'ottoman'].map(sharedAtlasColumn),
    [0, 1, 2, 3, 4],
  );
  assert.equal(sharedAtlasColumn('daiviet'), -1);
  assert.equal(sharedAtlasColumn('unknown'), -1);
});

test('registered building and action choices resolve to complete frames in retained source PNGs', () => {
  for (const definition of Object.values(CIVILIZATION_ART)) {
    if (definition.kind !== 'sheets') continue;
    const sizes = new Map<string, number[]>();
    const checkFrame = (sheetKey: string, index: number) => {
      const sheet = definition.sheets[sheetKey];
      if (!sizes.has(sheet.file)) {
        const file = readFileSync(new URL('../public/art/' + sheet.file, import.meta.url));
        sizes.set(sheet.file, [file.readUInt32BE(16), file.readUInt32BE(20)]);
      }
      const dimensions = sizes.get(sheet.file)!;
      assert.deepEqual(sheet.dimensions ?? [1536, 1024], dimensions);
      const [x, y, width, height] = sheet.frames[index];
      assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0, sheetKey);
      assert.ok(x + width <= dimensions[0] && y + height <= dimensions[1], sheetKey);
    };
    for (const type of Object.keys(definition.buildings))
      for (let age = 1; age <= 3; age++) {
        const pose = selectBuildingArt(definition, type, age)!;
        checkFrame(pose.sheet, pose.row);
      }
    for (const [type, unit] of Object.entries(definition.units))
      for (const action of Object.keys(unit.actions))
        for (const activity of ['', 'wood', 'gold', 'stone', 'meat', 'food'])
          for (let phase = 0; phase < 4; phase++)
            for (let direction = 0; direction < 8; direction++) {
              const selected = selectUnitArt(definition, type, phase, direction, action, activity)!;
              checkFrame(selected.pose.sheet, selected.index);
              if (selected.pose.geometry === 'working')
                assert.ok(definition.workerCalibrations?.[selected.pose.sheet]?.[selected.index]);
            }
  }
});

const futureArt: SheetArtDefinition = {
  kind: 'sheets',
  id: 'future-civilization',
  headings: [0, 0, 1, 1, 1, 3, 2, 2],
  sheets: {
    actors: {
      file: 'future-actors.png',
      dimensions: [32, 16],
      frames: Array.from({ length: 8 }, (_, index) => [
        (index % 4) * 8,
        index < 4 ? 0 : 8,
        8,
        8,
        4,
        7,
      ]),
    },
    architecture: { file: 'future-hall.png', dimensions: [32, 16], frames: [[0, 0, 32, 16]] },
  },
  buildings: { towncenter: Array.from({ length: 3 }, () => ({ sheet: 'architecture', row: 0 })) },
  units: {
    guard: {
      height: 48,
      reference: { sheet: 'actors', row: 0 },
      actions: {
        idle: [{ sheet: 'actors', row: 0 }],
        walk: [
          { sheet: 'actors', row: 1 },
          { sheet: 'actors', row: 0 },
        ],
      },
    },
  },
};

test('a new civilization selects arbitrary sheet names and pose order using configuration alone', () => {
  assert.equal(selectBuildingArt(futureArt, 'towncenter', 7)?.sheet, 'architecture');
  assert.deepEqual(
    [0, 1, 2, 3].map((phase) => selectUnitArt(futureArt, 'guard', phase, 0, 'walk')?.pose.row),
    [1, 0, 1, 0],
  );
  assert.equal(selectUnitArt(futureArt, 'guard', -1, -1, 'walk')?.index, 2);
  assert.equal(selectUnitArt(futureArt, 'missing', 0, 0, 'idle'), undefined);
  assert.equal(selectBuildingArt(futureArt, 'missing', 1), undefined);
  assert.equal(selectUnitArt(DAI_VIET_ART, 'villager', 0, 0, 'build', 'wood')?.pose.row, 1);
});

test('the common loader accepts a new civilization, ignores deselected pending images and validates dimensions', async () => {
  const originalImage = globalThis.Image;
  const pending: MockImage[] = [];
  class MockImage {
    naturalWidth = 32;
    naturalHeight = 16;
    onload?: () => void;
    onerror?: () => void;
    set src(_url: string) {
      pending.push(this);
    }
  }
  globalThis.Image = MockImage as unknown as typeof Image;
  try {
    const renderer = createSheetArt(futureArt);
    const first = renderer.loadUnits(true);
    await renderer.loadUnits(false);
    pending.shift()!.onload!();
    await first;
    assert.equal(renderer.status().sheets.actors, false);
    const buildings = renderer.loadBuildings();
    pending.shift()!.onload!();
    assert.equal(await buildings, true);
    const units = renderer.loadUnits(true);
    pending.shift()!.onload!();
    assert.equal(await units, true);
    assert.equal(renderer.status().sheets.actors, true);
    await renderer.loadUnits(false);
    assert.equal(renderer.status().sheets.architecture, true);
    assert.equal(renderer.status().sheets.actors, false);
    const invalid = renderer.loadUnits(true);
    const image = pending.shift()!;
    image.naturalWidth = 31;
    image.onload!();
    assert.equal(await invalid, false);
    assert.equal(renderer.status().sheets.actors, false);
    const sharedSource = createSheetArt({
      ...futureArt,
      buildings: { towncenter: Array.from({ length: 3 }, () => ({ sheet: 'actors', row: 0 })) },
    });
    const sharedBuilding = sharedSource.loadBuildings();
    pending.shift()!.onload!();
    assert.equal(await sharedBuilding, true);
    await sharedSource.loadUnits(true);
    await sharedSource.loadUnits(false);
    assert.equal(
      sharedSource.status().sheets.actors,
      true,
      'unit eviction must retain a sheet also used by buildings',
    );
  } finally {
    globalThis.Image = originalImage;
  }
});
