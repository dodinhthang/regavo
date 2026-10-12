import assert from 'node:assert/strict';
import test from 'node:test';
import { Game } from '../src/game/engine.ts';

function arena() {
  const g = new Game({
    civ: 'daiviet',
    enemy: 'roman',
    map: 'plains',
    difficulty: 'easy',
    seed: 17,
    mapSize: 64,
  });
  g.state.entities = g.state.entities.filter((e) => e.type === 'towncenter');
  g.state.terrain.fill(0);
  g.state.blockedVersion++;
  g.ai = () => {};
  return g;
}
function advance(g: Game, seconds: number) {
  for (let i = 0; i < seconds * 20; i++) g.step();
}

test('a walker rounds a tight masonry corner without skipping into the blocked tile', () => {
  const g = arena(),
    v = g.entity('unit', 'villager', 0, 29.8, 30.2);
  for (let y = 27; y <= 33; y++) g.state.terrain[y * g.size + 31] = 2;
  g.state.blockedVersion++;
  g.order(v, { kind: 'move', x: 34.5, y: 30.5 });
  advance(g, 14);
  assert.equal(v.orders.length, 0);
  assert.ok(Math.hypot(v.x - 34.5, v.y - 30.5) < 0.2);
  assert.ok(g.walkable(v, 0));
});

test('a stalled walker replans around stationary soldiers and resumes its original order', () => {
  const g = arena(),
    v = g.entity('unit', 'villager', 0, 28.5, 30.5);
  for (let x = 30; x <= 32; x++)
    for (let y = 28; y <= 32; y++) g.entity('unit', 'spear', 0, x + 0.5, y + 0.5);
  g.order(v, { kind: 'move', x: 37.5, y: 30.5 });
  advance(g, 22);
  assert.equal(v.orders.length, 0);
  assert.ok(Math.hypot(v.x - 37.5, v.y - 30.5) < 0.2);
});

test('a newly blocked destination finishes at a free adjacent tile instead of retrying forever', () => {
  const g = arena(),
    v = g.entity('unit', 'villager', 0, 27.5, 30.5);
  g.order(v, { kind: 'move', x: 34.5, y: 30.5 });
  advance(g, 0.5);
  g.entity('building', 'house', 0, 34.5, 30.5);
  advance(g, 12);
  assert.equal(v.orders.length, 0);
  assert.ok(g.walkable(v, 0));
  assert.ok(Math.hypot(v.x - 34.5, v.y - 30.5) < 3);
});

test('working slots choose the reachable side of a resource and survive save/load', () => {
  const g = arena(),
    v = g.entity('unit', 'villager', 0, 30.5, 30.5),
    source = g.entity('resource', 'tree', -1, 32.5, 30.5);
  source.amount = 100;
  for (let y = 1; y < g.size - 1; y++) g.state.terrain[y * g.size + 33] = 2;
  g.state.blockedVersion++;
  g.order(v, { kind: 'gather', target: source.id });
  advance(g, 2);
  const copy = arena();
  copy.load(g.save());
  copy.ai = () => {};
  advance(copy, 4);
  assert.ok(copy.get(v.id)!.carry > 0);
  assert.ok(copy.get(v.id)!.x < 33);
});
