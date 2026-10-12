import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/engine.ts';
import { BUILDINGS, CARRY_CAPACITY } from '../src/game/data.ts';
import { actorRadius, ACTOR_GAP } from '../src/game/spacing.ts';
import type { Entity } from '../src/game/types.ts';

function arena() {
  const g = new Game({
    civ: 'persian',
    enemy: 'roman',
    map: 'plains',
    difficulty: 'easy',
    seed: 31,
  });
  g.state.terrain.fill(0);
  g.state.entities = g.state.entities.filter((e) => e.type === 'towncenter');
  const [a, b] = g.state.entities;
  a.x = a.y = 12;
  b.x = b.y = 84;
  a.rally = undefined;
  b.rally = undefined;
  g.state.blockedVersion++;
  g.state.players[0].resources = { food: 20000, wood: 20000, gold: 20000, stone: 20000 };
  g.ai = () => {};
  return g;
}
const advance = (g: Game, seconds: number) => {
  for (let i = 0; i < Math.ceil(seconds / 0.05); i++) g.step();
};
function assertSpaced(a: Entity[], margin = 0.04) {
  for (let i = 0; i < a.length; i++)
    for (const b of a.slice(i + 1))
      assert.ok(
        Math.hypot(a[i].x - b.x, a[i].y - b.y) >=
          actorRadius(a[i]) + actorRadius(b) + ACTOR_GAP - margin,
        `${a[i].type}/${b.type} overlap`,
      );
}

test('recruits get different unoccupied exits and continue to separate when idle', () => {
  const g = arena(),
    tc = g.state.entities[0];
  for (let i = 0; i < 4; i++) g.command({ type: 'train', building: tc.id, unit: 'villager' });
  advance(g, 41);
  const recruits = g.owned(0).filter((e) => e.kind === 'unit');
  assert.equal(recruits.length, 4);
  assertSpaced(recruits);
  assert.ok(recruits.every((e) => g.walkable(e, 0)));
  const colocated = Array.from({ length: 5 }, () => g.entity('unit', 'villager', 0, 30, 30));
  advance(g, 2);
  assertSpaced(colocated);
});
test('mixed formations reserve enough space for elephants, horses and infantry', () => {
  const g = arena(),
    types = ['elephant', 'elephant', 'scout', 'lightcavalry', 'sword', 'spear'];
  const units = types.map((type, i) => g.entity('unit', type, 0, 25 + i * 3, 24));
  g.command({ type: 'orders', ids: units.map((e) => e.id), order: { kind: 'move', x: 48, y: 48 } });
  const goals = units.map((e) => ({ ...e, x: e.orders[0].x!, y: e.orders[0].y! }));
  assertSpaced(goals, 0);
  advance(g, 25);
  assertSpaced(units);
  assert.ok(units.every((e) => Math.hypot(e.x - 48, e.y - 48) < 7 && e.orders.length === 0));
});
test('workers and melee attackers spread around their target and all keep acting', () => {
  for (const mode of ['gather', 'attack'] as const) {
    const g = arena(),
      target = g.entity(
        mode === 'gather' ? 'resource' : 'building',
        mode === 'gather' ? 'tree' : 'house',
        mode === 'gather' ? -1 : 1,
        48,
        48,
      );
    target.amount = target.hp = 1e8;
    const units = Array.from({ length: 4 }, () =>
      g.entity('unit', mode === 'gather' ? 'villager' : 'sword', 0, 46.3, 48),
    );
    units.forEach((e) => g.order(e, { kind: mode, target: target.id }));
    advance(g, 7);
    assertSpaced(units);
    assert.ok(units.every((e) => e.state === (mode === 'gather' ? 'work' : 'attack')));
    if (mode === 'gather') assert.ok(units.every((e) => e.carry > 0 && e.carry < CARRY_CAPACITY));
    else assert.ok(target.hp < 1e8);
  }
});

test('unit deaths during a battle do not starve later actors of their existing paths', () => {
  const g = arena(),
    units = Array.from({ length: 40 }, (_, i) =>
      g.entity('unit', 'spear', 0, 20 + (i % 10) * 1.2, 30 + Math.floor(i / 10) * 1.2),
    );
  g.command({ type: 'orders', ids: units.map((e) => e.id), order: { kind: 'move', x: 70, y: 30 } });
  advance(g, 1);
  const versions = g.state.blockedVersion,
    before = units.slice(-10).map((e) => e.charge);
  for (let i = 0; i < 40; i++) {
    if (i % 2 === 0) {
      const casualty = g.entity('unit', 'villager', 1, 80, 60);
      g.hit(casualty, 100, 0);
    }
    g.step();
  }
  assert.equal(g.state.blockedVersion, versions);
  assert.ok(units.slice(-10).every((e, i) => e.charge > before[i] + 1));
});
test('busy resources retain their orders, and opposed gather/deposit traffic makes progress', () => {
  const g = arena(),
    source = g.entity('resource', 'berries', -1, 40, 40);
  source.amount = 1e6;
  g.entity('building', 'granary', 0, 40, 32);
  const workers = Array.from({ length: 8 }, (_, i) =>
    g.entity('unit', 'villager', 0, 36 + (i % 4) * 1.1, 36 + Math.floor(i / 4) * 1.1),
  );
  workers.forEach((e) => g.order(e, { kind: 'gather', target: source.id }));
  advance(g, 100);
  assert.ok(g.state.stats.gathered[0] >= 100);
  assert.ok(workers.every((e) => e.orders[0]?.kind === 'gather'));
  assertSpaced(workers);
});
test('the town center reserves its final courtyard before an age upgrade', () => {
  const g = arena(),
    tc = g.state.entities[0];
  assert.equal(BUILDINGS.towncenter.size, 8);
  assert.equal(g.canPlace('house', { x: tc.x + 4.5, y: tc.y }, 0, false), false);
  assert.equal(g.canPlace('house', { x: tc.x + 6, y: tc.y }, 0, false), true);
  const v = g.entity('unit', 'villager', 0, tc.x, tc.y);
  advance(g, 0.05);
  assert.ok(g.walkable(v, 0), 'an older save inside the expanded reservation needs a free exit');
});
test('switching resources finishes the previous cargo trip before finding a new working slot', () => {
  const g = arena(),
    v = g.entity('unit', 'villager', 0, 47, 48),
    tree = g.entity('resource', 'tree', -1, 48, 48);
  tree.amount = 100;
  g.entity('building', 'granary', 0, 40, 40);
  v.carry = 9;
  v.carryType = 'food';
  const food = g.state.players[0].resources.food;
  g.order(v, { kind: 'gather', target: tree.id });
  advance(g, 25);
  assert.equal(g.state.players[0].resources.food, food + 9);
  assert.ok(tree.amount < 100);
  assert.equal(v.carryType, 'wood');
});
test('completed recruits wait for an exit without a negative cancellation refund', () => {
  const g = arena(),
    tc = g.state.entities[0];
  g.command({ type: 'train', building: tc.id, unit: 'villager' });
  g.state.terrain.fill(2);
  g.state.blockedVersion++;
  tc.queue[0].remaining = 0.05;
  advance(g, 0.2);
  assert.equal(tc.queue.length, 1);
  assert.equal(tc.queue[0].remaining, 0);
  const before = g.state.players[0].resources.food;
  g.command({ type: 'cancelqueue', building: tc.id });
  assert.equal(g.state.players[0].resources.food, before);
});
test('legacy buildings move out of the future courtyard while keeping IDs and economic state', () => {
  const g = arena(),
    tc = g.state.entities[0],
    b = g.entity('building', 'house', 0, tc.x + 3.5, tc.y);
  b.hp = 200;
  const saved = g.save();
  delete saved.layoutVersion;
  const copy = arena();
  copy.load(saved);
  const moved = copy.get(b.id)!;
  assert.equal(moved.hp, 200);
  assert.equal(copy.state.layoutVersion, 2);
  assert.ok(Math.abs(moved.x - tc.x) >= 5.15 || Math.abs(moved.y - tc.y) >= 5.15);
  assert.deepEqual(copy.state.players, saved.players);
});
