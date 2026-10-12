import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/engine.ts';
import { AGE_TIMES, CIVS, UNITS, unitAvailable } from '../src/game/data.ts';
import type { CivId } from '../src/game/data.ts';
const make = (civ: CivId = 'persian') =>
  new Game({ civ, enemy: 'roman', map: 'plains', difficulty: 'easy', seed: 31, mapSize: 64 });
const step = (g: Game, seconds: number) => {
  for (let i = 0; i < seconds * 20; i++) g.step();
};
const riches = (g: Game) => {
  g.state.players[0].resources = { food: 20000, wood: 20000, gold: 20000, stone: 20000 };
};
const capital = (g: Game) => g.owned(0).find((e) => e.type === 'towncenter')!;
const villager = (g: Game) => g.owned(0).find((e) => e.type === 'villager')!;
test('all terrain layouts connect the two starting capitals', () => {
  for (const map of ['plains', 'ford', 'passes'] as const) {
    const g = new Game({ civ: 'roman', enemy: 'mongol', map, difficulty: 'normal', seed: 45 });
    assert.equal(g.population(0), 7);
    assert.equal(g.capacity(0), 15);
    assert.equal(g.population(1), 7);
    assert.ok(g.path({ x: 18, y: 42 }, { x: 45, y: 21 }, 0).length > 0, map);
  }
});
test('carried food is only credited at a valid dropoff; death discards cargo', () => {
  const g = make(),
    v = villager(g),
    food = g.state.entities.find((e) => e.type === 'berries')!;
  v.x = food.x - 0.6;
  v.y = food.y;
  g.visibility();
  g.command({ type: 'orders', ids: [v.id], order: { kind: 'gather', target: food.id } });
  const before = g.state.players[0].resources.food;
  step(g, 2);
  assert.ok(v.carry > 0);
  assert.equal(g.state.players[0].resources.food, before);
  step(g, 45);
  assert.ok(g.state.players[0].resources.food > before);
  v.carry = 19;
  const r = g.state.players[0].resources.food;
  g.hit(v, 100, 1);
  assert.equal(v.carry, 0);
  assert.equal(g.state.players[0].resources.food, r);
});
test('hunting leaves finite meat and the hunter deposits it as food', () => {
  const g = make(),
    v = villager(g);
  const a = g.entity('animal', 'goat', -1, 18, 44);
  a.hp = 12;
  v.x = 17;
  v.y = 44;
  g.visibility();
  g.command({ type: 'orders', ids: [v.id], order: { kind: 'gather', target: a.id } });
  const before = g.state.players[0].resources.food;
  step(g, 4);
  assert.equal(a.alive, false);
  assert.ok(a.amount < 320);
  assert.ok(v.carryMeat);
  step(g, 45);
  assert.ok(g.state.players[0].resources.food > before);
  assert.ok(a.amount < 320);
});
test('age research pauses only the capital queue and keeps existing unit health', () => {
  const g = make();
  riches(g);
  const tc = capital(g),
    v = villager(g),
    b = g.entity('building', 'barracks', 0, 20, 43);
  g.command({ type: 'train', building: tc.id, unit: 'villager' });
  g.command({ type: 'train', building: b.id, unit: 'spear' });
  g.command({ type: 'advance' });
  step(g, 14);
  assert.equal(tc.queue[0].remaining, 10);
  assert.equal(b.queue.length, 0);
  step(g, AGE_TIMES[0]);
  assert.equal(g.state.players[0].age, 2);
  assert.equal(tc.age, 2);
  assert.equal(v.age, 1);
  assert.equal(v.maxHp, 45);
  assert.equal(tc.maxHp, 2000);
});
test('cancel research refunds only its unfinished portion', () => {
  const g = make();
  riches(g);
  g.command({ type: 'advance' });
  const after = g.state.players[0].resources.food;
  step(g, 20);
  g.command({ type: 'canceladvance' });
  assert.ok(Math.abs(g.state.players[0].resources.food - after - 200) < 0.01);
});
test('war elephants are gated to their age III roster, with six reserved slots and spear counter', () => {
  const g = make();
  riches(g);
  const b = g.entity('building', 'stable', 0, 20, 42);
  g.command({ type: 'train', building: b.id, unit: 'elephant' });
  assert.equal(b.queue.length, 0);
  g.state.players[0].age = 3;
  for (let i = 0; i < 8; i++) g.command({ type: 'train', building: b.id, unit: 'elephant' });
  assert.equal(b.queue.length, 6);
  const spear = g.entity('unit', 'spear', 0, 25, 25),
    elephant = g.entity('unit', 'elephant', 1, 26, 25),
    horse = g.entity('unit', 'scout', 1, 26, 26);
  assert.ok(g.damage(spear, elephant) > g.damage(spear, horse));
  const roman = make('roman');
  riches(roman);
  roman.state.players[0].age = 3;
  const stable = roman.entity('building', 'stable', 0, 20, 42);
  roman.command({ type: 'train', building: stable.id, unit: 'elephant' });
  assert.equal(stable.queue.length, 0);
});
test('active and queued elephants share the six-unit cap in every eligible civilization', () => {
  const civilizations = (Object.keys(CIVS) as CivId[]).filter((civ) =>
    unitAvailable('elephant', civ, 3),
  );
  for (const civ of civilizations) {
    const g = make(civ);
    riches(g);
    g.state.players[0].age = 3;
    const stable = g.entity('building', 'stable', 0, 38, 30);
    for (let i = 0; i < 4; i++) g.entity('building', 'house', 0, 30 + i * 3, 38);
    g.entity('unit', 'elephant', 0, 40, 30);
    for (let i = 0; i < 8; i++) g.command({ type: 'train', building: stable.id, unit: 'elephant' });
    assert.equal(stable.queue.length, 5, civ);
  }
});
test('Roman shields reduce frontal damage while flanking bypasses them', () => {
  const g = make('roman'),
    l = g.entity('unit', 'legionary', 0, 20, 20),
    a = g.entity('unit', 'sword', 1, 21, 20);
  l.dir = 0;
  l.shield = true;
  const front = g.damage(a, l);
  a.x = 19;
  assert.ok(g.damage(a, l) > front);
});
test('Tang quality applies to new orders, keeping existing troops unchanged', () => {
  const g = make('tang');
  riches(g);
  g.state.players[0].age = 2;
  g.entity('building', 'armory', 0, 23, 43);
  const b = g.entity('building', 'barracks', 0, 20, 43),
    old = g.entity('unit', 'spear', 0, 19, 43);
  g.command({ type: 'armory', mode: 'quality' });
  step(g, 11);
  g.command({ type: 'train', building: b.id, unit: 'spear' });
  assert.equal(b.queue[0].quality, true);
  step(g, 16);
  const newTroop = g
    .owned(0)
    .filter((e) => e.type === 'spear')
    .find((e) => e.id !== old.id)!;
  assert.ok(newTroop.maxHp > old.maxHp);
  assert.equal(old.maxHp, 80);
});
test('packed Mongol camps cannot accept resources and can relocate', () => {
  const g = make('mongol');
  g.state.players[0].age = 2;
  const camp = g.entity('building', 'lumbercamp', 0, 21, 42),
    v = villager(g);
  v.carryType = 'wood';
  v.x = 23;
  v.y = 42;
  assert.equal(g.dropoff(v)?.id, camp.id);
  g.command({ type: 'pack', ids: [camp.id] });
  assert.equal(camp.state, 'packed');
  assert.notEqual(g.dropoff(v)?.id, camp.id);
  g.command({ type: 'orders', ids: [camp.id], order: { kind: 'move', x: 25, y: 42 } });
  step(g, 7);
  assert.ok(camp.x > 24);
  g.command({ type: 'pack', ids: [camp.id] });
  assert.equal(camp.state, 'idle');
});
test('Persian trade pays distance bonus without drawing from a free resource pool', () => {
  const reward = (civ: CivId) => {
    const g = make(civ),
      a = g.entity('building', 'market', 0, 20, 30),
      b = g.entity('building', 'market', 0, 30, 30),
      u = g.entity('unit', 'trader', 0, 32.2, 30);
    u.tradeHome = a.id;
    g.visibility();
    const before = g.state.players[0].resources.gold;
    g.order(u, { kind: 'trade', target: b.id, origin: a.id });
    g.step();
    return g.state.players[0].resources.gold - before;
  };
  assert.ok(reward('persian') > reward('roman'));
});
test('current fog hides enemies again when the scout leaves', () => {
  const g = make(),
    scout = g.owned(0).find((e) => e.type === 'scout')!,
    enemy = g.owned(1).find((e) => e.type === 'towncenter')!;
  assert.ok(!g.snapshot().entities.some((e) => e.id === enemy.id));
  scout.x = 45;
  scout.y = 21;
  assert.ok(g.snapshot().entities.some((e) => e.id === enemy.id));
  scout.x = 15;
  scout.y = 40;
  assert.ok(!g.snapshot().entities.some((e) => e.id === enemy.id));
});
test('queues reserve housing and cannot overrun population capacity', () => {
  const g = make();
  riches(g);
  const tc = capital(g);
  for (let i = 0; i < 12; i++) g.command({ type: 'train', building: tc.id, unit: 'villager' });
  assert.equal(tc.queue.length, 8);
  assert.equal(g.population(0) + g.reserved(0), g.capacity(0));
});
test('same tick capital destruction yields a draw', () => {
  const g = make();
  const a = capital(g),
    b = g.owned(1).find((e) => e.type === 'towncenter')!;
  a.hp = 1;
  b.hp = 1;
  g.state.projectiles = [
    {
      id: 1001,
      target: a.id,
      team: 1,
      x: 13,
      y: 42,
      tx: a.x,
      ty: a.y,
      duration: 0.05,
      remaining: 0.01,
      damage: 2,
      splash: 0,
      type: 'arrow',
    },
    {
      id: 1002,
      target: b.id,
      team: 0,
      x: 50,
      y: 21,
      tx: b.x,
      ty: b.y,
      duration: 0.05,
      remaining: 0.01,
      damage: 2,
      splash: 0,
      type: 'arrow',
    },
  ];
  g.step();
  assert.equal(g.state.winner, 'draw');
});
test('save/load preserves queues, cargo, research and deterministic simulation', () => {
  const g = make();
  riches(g);
  const v = villager(g);
  v.carry = 8;
  v.carryType = 'food';
  v.carryMeat = true;
  g.command({ type: 'train', building: capital(g).id, unit: 'villager' });
  g.command({ type: 'advance' });
  step(g, 3);
  const save = JSON.parse(JSON.stringify(g.save())),
    copy = make();
  copy.load(save);
  assert.deepEqual(copy.save(), g.save());
  step(g, 5);
  step(copy, 5);
  assert.deepEqual(copy.save(), g.save());
  assert.throws(() => copy.load({ ...save, version: 2 }));
});
test('forest edge pathing lets a worker harvest a densely packed tree cluster', () => {
  const g = make(),
    v = villager(g),
    tree = g.state.entities
      .filter((e) => e.type === 'tree')
      .sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y))[0];
  g.command({ type: 'orders', ids: [v.id], order: { kind: 'gather', target: tree.id } });
  step(g, 60);
  assert.ok(tree.amount < 180);
  assert.ok(g.state.players[0].resources.wood > 350);
});
test('Ottoman deployment improves firing cadence and is lost on movement', () => {
  const g = make('ottoman'),
    c = g.entity('unit', 'cannon', 0, 20, 25),
    t = g.entity('building', 'house', 1, 24, 25);
  g.visibility();
  g.command({ type: 'deploy', ids: [c.id] });
  c.cooldown = 0;
  g.attack(c, t, 0.05);
  assert.ok(c.cooldown < UNITS.cannon.cooldown);
  g.move(c, { x: 22, y: 25 }, 0.05);
  assert.equal(c.deployed, false);
});
test('AI develops its own economy, advances ages and recruits unique units without resource grants', () => {
  const g = new Game({
    civ: 'roman',
    enemy: 'persian',
    map: 'plains',
    difficulty: 'normal',
    seed: 31,
  });
  capital(g).hp = 1e9;
  step(g, 1500);
  assert.equal(g.state.players[1].age, 3);
  assert.ok(g.owned(1).some((e) => e.type === 'stable'));
  assert.ok(g.state.stats.gathered[1] > 2000);
  assert.ok(g.state.players[1].resources.food >= 0);
});
test('a villager delivers carried meat to an explicitly chosen valid granary', () => {
  const g = make(),
    v = villager(g),
    store = g.entity('building', 'granary', 0, 20, 40);
  v.x = 22;
  v.y = 40;
  v.carry = 17;
  v.carryType = 'food';
  v.carryMeat = true;
  const before = g.state.players[0].resources.food;
  g.command({ type: 'orders', ids: [v.id], order: { kind: 'deliver', target: store.id } });
  step(g, 3);
  assert.equal(v.carry, 0);
  assert.equal(g.state.players[0].resources.food, before + 17);
  assert.equal(v.orders.length, 0);
});
test('a new villager follows a resource rally point', () => {
  const g = make(),
    tc = capital(g),
    food = g.state.entities.find((e) => e.type === 'berries')!;
  g.command({ type: 'rally', id: tc.id, x: food.x, y: food.y, target: food.id });
  g.command({ type: 'train', building: tc.id, unit: 'villager' });
  step(g, 11);
  assert.ok(
    g
      .owned(0)
      .some(
        (e) =>
          e.type === 'villager' && e.orders[0]?.kind === 'gather' && e.orders[0].target === food.id,
      ),
  );
});
test('save import rejects invalid economy without replacing the running state', () => {
  const g = make(),
    before = g.save(),
    bad = g.save();
  bad.players[0].resources.food = -100;
  assert.throws(() => g.load(bad));
  assert.deepEqual(g.save(), before);
});
