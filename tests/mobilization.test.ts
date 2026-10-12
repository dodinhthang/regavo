import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/engine.ts';

// Mobilization currently belongs to Dai Viet; these scenarios exercise the shared engine.
const arena = () => {
  const game = new Game({
    civ: 'daiviet',
    enemy: 'roman',
    map: 'plains',
    difficulty: 'normal',
    seed: 31,
    mapSize: 64,
  });
  game.state.entities = game.state.entities.filter((e) => e.type === 'towncenter');
  game.state.terrain.fill(0);
  game.state.blockedVersion++;
  game.state.players[0].age = 2;
  game.state.players[0].resources = { food: 10000, wood: 10000, gold: 10000, stone: 10000 };
  game.ai = () => {};
  const barracks = game.entity('building', 'barracks', 0, 30, 30);
  const villager = game.entity('unit', 'villager', 0, 32.8, 30);
  return { game, barracks, villager };
};
const ticks = (game: Game, amount: number) => {
  for (let i = 0; i < amount; i++) game.step();
};
const finish = (game: Game, id: number) => {
  for (let i = 0; i < 2400 && game.get(id)?.mobilization; i++) game.step();
  assert.equal(game.get(id)?.mobilization, undefined);
};

test('invalid conversion timers and costs are rejected, and canceling demobilization retains militia', () => {
  const { game, villager } = arena();
  game.command({ type: 'mobilize', ids: [villager.id] });
  for (const invalid of [
    { remaining: -1 },
    { total: 0 },
    { cost: { food: 999, wood: 10 } },
    { target: 'elephant' },
  ]) {
    const save = JSON.parse(JSON.stringify(game.state));
    Object.assign(
      save.entities.find((e: { id: number }) => e.id === villager.id).mobilization,
      invalid,
    );
    assert.throws(() => new Game(save.config).load(save));
  }
  finish(game, villager.id);
  game.command({ type: 'demobilize', ids: [villager.id] });
  ticks(game, 20);
  game.command({ type: 'stop', ids: [villager.id] });
  assert.equal(villager.type, 'militia');
  assert.equal(game.reserveCount(0), 1);
  assert.equal(game.state.players[0].resources.food, 9980);
});

test('mobilization preserves identity, population, health ratio, cargo accounting and civilian orders', () => {
  const { game, villager } = arena();
  const tree = game.entity('resource', 'tree', -1, 24, 30);
  tree.amount = 100;
  game.order(villager, { kind: 'gather', target: tree.id });
  villager.carry = 13;
  villager.carryType = 'wood';
  villager.hp = villager.maxHp * 0.4;
  const before = { ...game.state.players[0].resources },
    id = villager.id,
    population = game.population(0);
  game.command({ type: 'mobilize', ids: [id] });
  assert.equal(villager.mobilization?.phase, 'deliver');
  assert.equal(game.state.players[0].resources.food, before.food - 20);
  finish(game, id);
  assert.equal(villager.type, 'militia');
  assert.equal(villager.carry, 0);
  assert.equal(game.state.players[0].resources.wood, before.wood - 10 + 13);
  assert.equal(game.population(0), population);
  assert.equal(villager.id, id);
  assert.ok(Math.abs(villager.hp / villager.maxHp - 0.4) < 1e-10);
  assert.deepEqual(villager.orders, []);
  game.command({ type: 'demobilize', ids: [id] });
  finish(game, id);
  assert.equal(villager.type, 'villager');
  assert.ok(Math.abs(villager.hp / villager.maxHp - 0.4) < 1e-10);
  assert.equal(game.get(id)!.orders[0]?.target, tree.id);
  assert.equal(game.state.players[0].resources.food, before.food - 20);
});

test('training is vulnerable and cannot attack, gather, heal or reset attack cooldown', () => {
  const { game, villager } = arena();
  villager.cooldown = 25;
  game.command({ type: 'mobilize', ids: [villager.id] });
  ticks(game, 10);
  assert.equal(villager.type, 'villager');
  assert.equal(villager.state, 'mobilize');
  game.hit(villager, villager.maxHp / 2, 1);
  finish(game, villager.id);
  assert.equal(villager.hp / villager.maxHp, 0.5);
  assert.ok(villager.cooldown > 16);
});

test('active and pending reserves share cap12, duplicate IDs do not spend twice, direct training is rejected', () => {
  const { game, barracks, villager } = arena();
  const villagers = [
    villager,
    ...Array.from({ length: 13 }, (_, i) =>
      game.entity('unit', 'villager', 0, 35 + (i % 4), 32 + Math.floor(i / 4)),
    ),
  ];
  game.command({ type: 'mobilize', ids: [...villagers.map((e) => e.id), villager.id] });
  assert.equal(game.reserveCount(0), 12);
  assert.equal(game.state.players[0].resources.food, 10000 - 240);
  game.command({ type: 'train', building: barracks.id, unit: 'militia' });
  assert.equal(barracks.queue.length, 0);
  finish(game, villager.id);
  game.command({ type: 'demobilize', ids: [villager.id] });
  game.command({ type: 'mobilize', ids: [villagers[13].id] });
  assert.equal(villagers[13].mobilization, undefined);
  finish(game, villager.id);
  assert.equal(game.reserveCount(0), 11);
});

test('orders, stop and barracks destruction cancel training with proportional refund; death refunds nothing', () => {
  for (const cancel of ['orders', 'stop', 'destroy'] as const) {
    const { game, villager, barracks } = arena();
    game.command({ type: 'mobilize', ids: [villager.id] });
    ticks(game, 40);
    const remaining = villager.mobilization!.remaining;
    if (cancel === 'orders')
      game.command({ type: 'orders', ids: [villager.id], order: { kind: 'move', x: 35, y: 30 } });
    else if (cancel === 'stop') game.command({ type: 'stop', ids: [villager.id] });
    else {
      game.hit(barracks, barracks.hp, 1);
      ticks(game, 1);
    }
    assert.equal(villager.type, 'villager');
    assert.equal(villager.mobilization, undefined);
    assert.ok(
      Math.abs(game.state.players[0].resources.food - (9980 + (20 * remaining) / 8)) < 1e-7,
    );
  }
  const { game, villager } = arena();
  game.command({ type: 'mobilize', ids: [villager.id] });
  game.hit(villager, 10000, 1);
  assert.equal(game.state.players[0].resources.food, 9980);
  assert.equal(game.reserveCount(0), 0);
});

test('age, ownership, affordability and completed barracks are authoritative command gates', () => {
  const { game, barracks, villager } = arena();
  game.state.players[0].age = 1;
  game.command({ type: 'mobilize', ids: [villager.id] });
  assert.equal(villager.mobilization, undefined);
  game.state.players[0].age = 2;
  barracks.progress = 0.9;
  game.command({ type: 'mobilize', ids: [villager.id] });
  assert.equal(villager.mobilization, undefined);
  barracks.progress = 1;
  game.state.players[0].resources.food = 19;
  game.command({ type: 'mobilize', ids: [villager.id] });
  assert.equal(villager.mobilization, undefined);
  game.state.players[0].resources.food = 20;
  game.command({ type: 'mobilize', ids: [villager.id] }, 1);
  assert.equal(villager.mobilization, undefined);
});

test('save/load resumes delivery, travel and training deterministically in either direction', () => {
  for (const phase of ['deliver', 'travel', 'train'] as const) {
    const { game, villager } = arena();
    if (phase === 'deliver') {
      villager.carry = 10;
      villager.carryType = 'food';
    }
    if (phase === 'travel') villager.x = 42;
    game.command({ type: 'mobilize', ids: [villager.id] });
    if (phase === 'train') ticks(game, 60);
    assert.equal(villager.mobilization?.phase, phase);
    const save = JSON.parse(JSON.stringify(game.state));
    const restored = new Game(save.config);
    restored.load(save);
    restored.ai = () => {};
    ticks(game, 500);
    ticks(restored, 500);
    assert.deepEqual(
      JSON.parse(JSON.stringify(restored.state)),
      JSON.parse(JSON.stringify(game.state)),
    );
    game.command({ type: 'demobilize', ids: [villager.id] });
    ticks(game, 50);
    restored.load(JSON.parse(JSON.stringify(game.state)));
    ticks(game, 180);
    ticks(restored, 180);
    assert.deepEqual(
      JSON.parse(JSON.stringify(restored.state)),
      JSON.parse(JSON.stringify(game.state)),
    );
  }
});

test('AI responds only to visible local threats, keeps10 villagers and demobilizes after30s', () => {
  for (const difficulty of ['easy', 'normal', 'hard'] as const) {
    const game = new Game({
      civ: 'roman',
      enemy: 'daiviet',
      map: 'plains',
      difficulty,
      seed: 31,
      mapSize: 64,
    });
    game.state.terrain.fill(0);
    game.state.blockedVersion++;
    const tc = game.owned(1).find((e) => e.type === 'towncenter')!;
    game.state.players[1].age = 2;
    game.state.players[1].resources = { food: 10000, wood: 10000, gold: 10000, stone: 10000 };
    game.entity('building', 'barracks', 1, tc.x - 7, tc.y);
    for (let i = 0; i < 14; i++)
      game.entity('unit', 'villager', 1, tc.x + (i % 4), tc.y + 5 + Math.floor(i / 4));
    const threat = game.entity('unit', 'sword', 0, tc.x + 6, tc.y + 3);
    game.visions[1].fill(0);
    game.ai();
    assert.equal(game.reserveCount(1), 0);
    game.visibility();
    game.ai();
    assert.equal(game.reserveCount(1), difficulty === 'easy' ? 2 : difficulty === 'normal' ? 6 : 8);
    assert.ok(game.owned(1).filter((e) => e.type === 'villager' && !e.mobilization).length >= 10);
    game.hit(threat, 10000, 1);
    for (const e of game.owned(1).filter((e) => e.mobilization?.target === 'militia')) {
      e.type = 'militia';
      e.mobilization = undefined;
    }
    game.state.tick += 599;
    game.ai();
    assert.equal(
      game.owned(1).some((e) => e.mobilization?.target === 'villager'),
      false,
    );
    game.state.tick += 1;
    game.ai();
    assert.equal(
      game.owned(1).filter((e) => e.mobilization?.target === 'villager').length,
      game.reserveCount(1),
    );
  }
});
