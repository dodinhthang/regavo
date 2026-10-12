import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/engine.ts';
import { entityAppearance } from '../src/render/appearance.ts';
import { DAI_VIET_ART } from '../src/render/civilizations/daiviet.ts';
import { selectUnitArt } from '../src/render/civilization-art-definition.ts';

const game = () =>
  new Game({ civ: 'persian', enemy: 'roman', map: 'plains', difficulty: 'easy', seed: 31 });
const worker = (g: Game) => g.owned(0).find((e) => e.type === 'villager')!;

test('new workers and workers filling their inventory keep the working tool', () => {
  const g = game(),
    v = worker(g),
    food = g.state.entities.find((e) => e.type === 'berries')!;
  assert.equal(entityAppearance(v).action, 'idle');
  v.x = food.x - 0.6;
  v.y = food.y;
  g.visibility();
  g.command({ type: 'orders', ids: [v.id], order: { kind: 'gather', target: food.id } });
  const before = g.state.players[0].resources.food;
  for (let i = 0; i < 40; i++) g.step();
  assert.ok(v.carry > 0 && v.carry < 20);
  assert.deepEqual(entityAppearance(v, food), { action: 'work', activity: 'harvest' });
  assert.equal(v.returning, false);
  assert.equal(g.state.players[0].resources.food, before);
});

test('a full inventory becomes visible cargo only on the return trip, and stop cancels it', () => {
  const g = game(),
    v = worker(g),
    food = g.state.entities.find((e) => e.type === 'berries')!;
  v.x = food.x - 0.6;
  v.y = food.y;
  v.carry = 20;
  v.carryType = 'food';
  v.carryMeat = true;
  g.command({ type: 'orders', ids: [v.id], order: { kind: 'gather', target: food.id } });
  g.step();
  assert.equal(v.returning, true);
  assert.deepEqual(entityAppearance(v, food), { action: 'carry', activity: 'meat' });
  g.command({ type: 'stop', ids: [v.id] });
  assert.equal(entityAppearance(v, food).action, 'idle');
  assert.equal(v.carry, 20);
  g.command({ type: 'orders', ids: [v.id], order: { kind: 'move', x: food.x + 2, y: food.y } });
  g.step();
  assert.equal(entityAppearance(v, food).action, 'walk');
  assert.equal(v.returning, false);
  g.command({ type: 'orders', ids: [v.id], order: { kind: 'deliver' } });
  g.step();
  assert.equal(v.returning, true);
  g.command({ type: 'hold', ids: [v.id] });
  assert.equal(v.returning, false);
  assert.equal(entityAppearance(v).action, 'idle');
});

test('explicit ore delivery carries the correct resource and clears the carrying pose at the store', () => {
  const g = game(),
    v = worker(g),
    store = g.entity('building', 'miningcamp', 0, 33, 69);
  v.x = 40;
  v.y = 69;
  v.carry = 8;
  v.carryType = 'gold';
  const before = g.state.players[0].resources.gold;
  g.command({ type: 'orders', ids: [v.id], order: { kind: 'deliver', target: store.id } });
  g.step();
  assert.deepEqual(entityAppearance(v, store), { action: 'carry', activity: 'gold' });
  assert.equal(g.state.players[0].resources.gold, before);
  for (let i = 0; i < 600 && v.carry > 0; i++) g.step();
  assert.equal(v.carry, 0);
  assert.equal(v.returning, false);
  assert.notEqual(entityAppearance(v, store).action, 'carry');
  assert.equal(g.state.players[0].resources.gold, before + 8);
});

test('reassigning a loaded worker keeps the held resource on the delivery trip to the old store', () => {
  for (const resource of ['wood', 'gold', 'stone', 'food'] as const) {
    const g = game(),
      v = worker(g);
    const target = g.entity('resource', resource === 'food' ? 'tree' : 'berries', -1, 45, 45);
    v.x = 44;
    v.y = 45;
    v.carry = 8;
    v.carryType = resource;
    v.carryMeat = resource === 'food';
    g.visibility();
    g.command({ type: 'orders', ids: [v.id], order: { kind: 'gather', target: target.id } });
    g.step();
    assert.equal(v.returning, true);
    assert.equal(v.carry, 8);
    const appearance = entityAppearance(v, target),
      held = resource === 'food' ? 'meat' : resource;
    assert.deepEqual(appearance, { action: 'carry', activity: held });
    assert.equal(
      selectUnitArt(DAI_VIET_ART, 'villager', 0, 0, 'carry', appearance.activity)!.pose.sheet,
      'units-cargo-' + held,
    );
  }
});
