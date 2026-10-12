import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/engine.ts';
import { CARRY_CAPACITY } from '../src/game/data.ts';

function patch() {
  const g = new Game({
    civ: 'persian',
    enemy: 'roman',
    map: 'plains',
    difficulty: 'easy',
    seed: 31,
    mapSize: 64,
  });
  g.state.terrain.fill(0);
  g.state.entities = g.state.entities.filter((e) => e.type === 'towncenter');
  const [home, enemy] = g.state.entities;
  home.x = 12;
  home.y = 12;
  enemy.x = 52;
  enemy.y = 52;
  home.rally = enemy.rally = undefined;
  g.state.blockedVersion++;
  g.ai = () => {};
  const bushes = [
    [40.5, 40.5],
    [42.5, 40.5],
    [44.5, 40.5],
    [42.5, 42.5],
    [44.5, 42.5],
  ].map(([x, y]) => g.entity('resource', 'berries', -1, x, y));
  const v = g.entity('unit', 'villager', 0, 39, 40.5);
  g.visibility();
  return { g, v, bushes };
}
function until(g: Game, done: () => boolean, seconds = 90) {
  for (let i = 0; i < seconds * 20 && !done(); i++) g.step();
  assert.ok(done(), 'simulation did not finish the expected gathering trip');
}

test('a partial load continues through five nearby bushes before its final delivery', () => {
  const { g, v, bushes } = patch();
  g.entity('building', 'granary', 0, 40, 32);
  bushes.forEach((b) => (b.amount = 1));
  g.visibility();
  g.order(v, { kind: 'gather', target: bushes[0].id });
  const before = g.state.players[0].resources.food;
  until(g, () => bushes.filter((b) => b.amount <= 0).length >= 2, 15);
  assert.ok(v.carry >= 2 - 1e-8);
  assert.equal(g.state.players[0].resources.food, before);
  assert.equal(v.returning, false);
  assert.equal(v.orders[0]?.kind, 'gather');
  until(g, () => v.orders.length === 0);
  assert.ok(bushes.every((b) => b.amount === 0));
  assert.equal(v.carry, 0);
  assert.ok(Math.abs(g.state.players[0].resources.food - before - 5) < 1e-8);
});

test('a full worker resumes the known patch after its target is removed during delivery and save/load', () => {
  const { g, v, bushes } = patch();
  bushes.forEach((b) => (b.amount = 20));
  g.order(v, { kind: 'gather', target: bushes[0].id });
  v.carry = CARRY_CAPACITY;
  v.carryType = 'food';
  const before = g.state.players[0].resources.food;
  until(g, () => v.returning === true, 1);
  // Another villager finishes this bush while our worker is on the way home.
  bushes[0].amount = 0;
  bushes[0].alive = false;
  g.state.blockedVersion++;
  until(g, () => !g.get(bushes[0].id), 6);
  assert.equal(v.carry, CARRY_CAPACITY);
  const copy = patch().g;
  copy.load(g.save());
  copy.ai = () => {};
  const resumed = copy.get(v.id)!;
  until(copy, () => copy.state.players[0].resources.food > before);
  assert.equal(copy.state.players[0].resources.food, before + CARRY_CAPACITY);
  assert.ok(
    !copy.visible(copy.get(bushes[1].id)!, 0),
    'the patch is outside current vision at home',
  );
  until(copy, () => bushes.slice(1).some((b) => copy.get(b.id)!.amount < 20));
  assert.equal(resumed.orders[0]?.kind, 'gather');
  assert.ok(resumed.carry > 0);
});

test('several workers finish the entire patch without moving to a distant patch or another food source', () => {
  const { g, v, bushes } = patch();
  g.entity('building', 'granary', 0, 40, 32);
  bushes.forEach((b) => (b.amount = 5));
  const distant = g.entity('resource', 'berries', -1, 59.5, 40.5);
  distant.amount = 100;
  const goat = g.entity('animal', 'goat', -1, 38, 44);
  const meat = goat.amount;
  const workers = [v, ...[39, 40.2, 41.4].map((x) => g.entity('unit', 'villager', 0, x, 38.5))];
  g.visibility();
  workers.forEach((w) => g.order(w, { kind: 'gather', target: bushes[0].id }));
  until(g, () => workers.every((w) => w.orders.length === 0));
  assert.ok(bushes.every((b) => b.amount === 0));
  assert.ok(Math.abs(g.state.stats.gathered[0] - 25) < 1e-8);
  assert.equal(distant.amount, 100);
  assert.equal(goat.amount, meat);
  assert.equal(goat.alive, true);
});

test('finishing a patch delivers the remainder and then runs an explicitly queued order', () => {
  const { g, v, bushes } = patch();
  g.entity('building', 'granary', 0, 40, 32);
  bushes.forEach((b) => (b.amount = 0));
  bushes[0].amount = 1;
  g.order(v, { kind: 'gather', target: bushes[0].id });
  g.order(v, { kind: 'move', x: 35, y: 30 }, true);
  until(g, () => v.orders.length === 0);
  assert.ok(Math.abs(g.state.stats.gathered[0] - 1) < 1e-8);
  assert.equal(v.carry, 0);
  assert.ok(Math.hypot(v.x - 35, v.y - 30) < 0.6);
});
