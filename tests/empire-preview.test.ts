import assert from 'node:assert/strict';
import test from 'node:test';
import { CIVS, unitAvailable, buildingAvailable, type CivId } from '../src/game/data.ts';
import { empirePreviewLayout, previewGroundRadius } from '../src/ui/empire-preview-layout.ts';

test('home scenes use only units and buildings unlocked for the selected civilization and age', () => {
  for (const civ of Object.keys(CIVS) as CivId[])
    for (const age of [1, 2, 3]) {
      const models = empirePreviewLayout(civ, age);
      assert.ok(models.some((m) => m.kind === 'building' && m.type === 'towncenter'));
      assert.ok(models.some((m) => m.kind === 'unit' && m.type !== 'villager'));
      for (const model of models) {
        if (model.kind === 'unit')
          assert.ok(unitAvailable(model.type, civ, age), `${civ} ${age} ${model.type}`);
        if (model.kind === 'building' && model.type !== 'towncenter')
          assert.ok(buildingAvailable(model.type, civ, age));
      }
    }
});
test('signature armies appear in their proper faction and era', () => {
  const has = (civ: CivId, age: number, type: string) =>
    empirePreviewLayout(civ, age).some((m) => m.type === type);
  assert.equal(has('persian', 2, 'elephant'), false);
  assert.equal(has('persian', 3, 'elephant'), true);
  assert.equal(has('ottoman', 2, 'cannon'), false);
  assert.equal(has('ottoman', 3, 'cannon'), true);
  assert.equal(has('tang', 2, 'catapult'), true);
  assert.equal(has('mongol', 2, 'catapult'), false);
  assert.equal(has('mongol', 3, 'catapult'), true);
  assert.equal(has('roman', 2, 'legionary'), true);
});

test('complete building foundations and cannon crews stay inside the home terrain plane', () => {
  for (const civ of Object.keys(CIVS) as CivId[])
    for (const age of [1, 2, 3])
      for (const model of empirePreviewLayout(civ, age)) {
        const radius = previewGroundRadius(model, age);
        assert.ok(Math.abs(model.x) + radius <= 7.650001, `${civ} ${age} ${model.type} x`);
        assert.ok(Math.abs(model.y) + radius <= 7.650001, `${civ} ${age} ${model.type} y`);
      }
});

test('Dai Viet hall stays on the scene centerline with clear space to the adjacent house', () => {
  for (const age of [1, 2, 3]) {
    const models = empirePreviewLayout('daiviet', age);
    const hall = models.find((m) => m.type === 'towncenter')!;
    assert.equal(hall.x - hall.y, 0);
    const house = models.find((m) => m.type === 'house' && m.y === 0)!;
    assert.ok(
      Math.abs(house.x - hall.x) >=
        previewGroundRadius(house, age) + previewGroundRadius(hall, age),
    );
  }
});
