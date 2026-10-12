import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/engine.ts';
import {
  CARRY_CAPACITY,
  GATHER_RATES,
  BUILDINGS,
  mapLayout,
  buildingSize,
} from '../src/game/data.ts';
import { canPlaceBuilding, snapBuilding } from '../src/game/placement.ts';
const config = {
  civ: 'persian' as const,
  enemy: 'roman' as const,
  map: 'plains' as const,
  difficulty: 'easy' as const,
  seed: 45,
};

test('Dai Viet wall modules touch a large gate and each other without allowing overlapping construction', () => {
  const g = new Game({ ...config, civ: 'daiviet' });
  const ground = Array(g.size * g.size).fill(0);
  for (const axis of ['x', 'y'] as const) {
    const gate = g.entity('building', 'stonegate', 0, 40.5, 40.5),
      p = { x: gate.x + (axis === 'x' ? 2 : 0), y: gate.y + (axis === 'y' ? 2 : 0) };
    assert.equal(
      canPlaceBuilding('stonewall', p, g.size, ground, [gate], undefined, 'daiviet'),
      true,
    );
    const wall = g.entity('building', 'stonewall', 0, p.x, p.y),
      next = { x: p.x + (axis === 'x' ? 1 : 0), y: p.y + (axis === 'y' ? 1 : 0) };
    assert.equal(
      canPlaceBuilding('stonewall', next, g.size, ground, [gate, wall], undefined, 'daiviet'),
      true,
    );
    assert.equal(
      canPlaceBuilding('stonewall', p, g.size, ground, [gate, wall], undefined, 'daiviet'),
      false,
    );
    assert.equal(canPlaceBuilding('house', p, g.size, ground, [gate], undefined, 'daiviet'), false);
    ground[Math.floor(next.y) * g.size + Math.floor(next.x)] = 1;
    assert.equal(
      canPlaceBuilding('stonewall', next, g.size, ground, [wall], undefined, 'daiviet'),
      false,
    );
    ground.fill(0);
  }
});

test('Dai Viet large gate and fortress use the same footprint for placement, grids and restored saves', () => {
  for (const [type, width] of [
    ['stonegate', 3],
    ['fortress', 5],
  ] as const) {
    const g = new Game({ ...config, civ: 'daiviet' });
    g.state.entities = g.state.entities.filter((e) => e.kind === 'unit' && e.team === 0);
    g.state.terrain.fill(0);
    g.state.players[0].age = 3;
    g.state.players[0].resources = { food: 1000, wood: 1000, gold: 1000, stone: 1000 };
    const v = g.owned(0).find((e) => e.type === 'villager')!;
    v.x = 44;
    v.y = 40;
    g.visibility();
    g.visions[0].fill(1);
    const at = snapBuilding(type, { x: 40.1, y: 40.1 }, 'daiviet');
    assert.equal(buildingSize(type, 'daiviet'), width);
    const obstacle = Math.floor(at.y - width / 2) * g.size + Math.floor(at.x - width / 2);
    g.state.terrain[obstacle] = 1;
    assert.equal(g.canPlace(type, at, 0), false, 'outer edge of enlarged foundation is checked');
    g.state.terrain[obstacle] = 0;
    g.command({ type: 'build', building: type, ...at, builders: [v.id] });
    const b = g.owned(0).find((e) => e.type === type)!;
    assert.ok(b);
    g.rebuildGrids();
    for (let y = at.y - width / 2; y < at.y + width / 2; y++)
      for (let x = at.x - width / 2; x < at.x + width / 2; x++) {
        assert.equal(g.grids[1][y * g.size + x], 1, 'opponent cannot cross the large foundation');
        assert.equal(g.grids[0][y * g.size + x], type === 'stonegate' ? 0 : 1);
      }
    const restored = new Game({ ...config, civ: 'daiviet' });
    restored.load(g.save());
    assert.equal(buildingSize(restored.get(b.id)!.type, restored.get(b.id)!.civ), width);
    restored.rebuildGrids();
    assert.equal(restored.grids[1][obstacle], 1);
  }
  assert.equal(buildingSize('stonegate', 'roman'), 1);
  assert.equal(buildingSize('fortress', 'roman'), 4);
});

test('all civilizations can build touching walls, queue their builders, rotate gates and preserve orientation across ages and saves', () => {
  for (const civ of ['roman', 'persian', 'tang', 'mongol', 'ottoman', 'daiviet'] as const) {
    const g = new Game({ ...config, civ });
    g.state.entities = g.state.entities.filter((e) => e.type === 'towncenter');
    g.state.terrain.fill(0);
    g.state.players[0].age = 2;
    g.state.players[0].resources = { food: 1000, wood: 1000, gold: 1000, stone: 1000 };
    const v = g.entity('unit', 'villager', 0, 37.5, 40.5);
    const tree = g.entity('resource', 'tree', -1, 35.5, 40.5);
    tree.amount = 100;
    g.order(v, { kind: 'gather', target: tree.id });
    g.visions[0].fill(1);
    for (const x of [40.5, 41.5])
      g.command({
        type: 'build',
        building: 'stonewall',
        x,
        y: 40.5,
        builders: [v.id],
        axis: 'x',
        append: true,
      });
    assert.equal(v.orders.length, 2, civ);
    assert.ok(v.orders.every((o) => o.kind === 'build'));
    g.command({
      type: 'build',
      building: 'stonegate',
      x: 45.5,
      y: 40.5,
      builders: [v.id],
      axis: 'y',
      append: true,
    });
    const gate = g.owned(0).find((e) => e.type === 'stonegate')!;
    assert.equal(gate.barrierAxis, 'y', civ);
    const size = buildingSize(gate.type, gate.civ);
    g.state.players[0].research = { remaining: 0.01, total: 55, cost: {} };
    g.ai = () => {};
    g.step();
    assert.equal(gate.age, 3);
    assert.equal(buildingSize(gate.type, gate.civ), size);
    const copy = new Game({ ...config, civ });
    copy.load(g.save());
    assert.equal(copy.get(gate.id)!.barrierAxis, 'y');
    assert.deepEqual(copy.get(v.id)!.orders, v.orders);
  }
});
test('new maps have four clear, connected reserved starts and distant active capitals', () => {
  for (const map of ['plains', 'ford', 'passes'] as const) {
    const g = new Game({ ...config, map });
    assert.equal(g.size, 96);
    assert.equal(g.state.terrain.length, 9216);
    const starts = g.state.spawnPoints!;
    assert.equal(starts.length, 4);
    assert.ok(Math.hypot(starts[1].x - starts[0].x, starts[1].y - starts[0].y) > 70);
    for (const start of starts) {
      assert.notEqual(g.state.terrain[Math.floor(start.y) * 96 + Math.floor(start.x)], 1);
      assert.ok(
        g.path({ x: starts[0].x + 4, y: starts[0].y }, { x: start.x + 4, y: start.y }, 0).length ||
          start === starts[0],
      );
    }
    assert.equal(g.state.players.length, 2);
  }
});
test('preview and authoritative build reject trees, berries, mines, animals, water and occupied foundations', () => {
  for (const kind of [
    'tree',
    'berries',
    'gold',
    'stone',
    'animal',
    'building',
    'water',
    'rock',
    'fog',
  ]) {
    const g = new Game(config),
      p = { x: 22, y: 70 };
    g.state.entities = g.state.entities.filter(
      (e) =>
        (e.team === 0 && e.kind === 'unit') || Math.abs(e.x - p.x) > 5 || Math.abs(e.y - p.y) > 5,
    );
    g.state.terrain.fill(0);
    const v = g.owned(0).find((e) => e.type === 'villager')!;
    v.x = p.x + 3;
    v.y = p.y;
    g.visibility();
    if (kind === 'animal') g.entity('animal', 'goat', -1, p.x, p.y);
    else if (kind === 'building') g.entity('building', 'house', 0, p.x, p.y);
    else if (kind === 'water' || kind === 'rock')
      g.state.terrain[p.y * 96 + p.x] = kind === 'water' ? 1 : 2;
    else if (kind !== 'fog') {
      const e = g.entity('resource', kind, -1, p.x, p.y);
      e.amount = 100;
    }
    const vision = kind === 'fog' ? new Uint8Array(96 * 96) : g.visions[0];
    if (kind === 'fog') g.visions[0].fill(0);
    assert.equal(
      canPlaceBuilding('house', p, g.size, g.state.terrain, g.state.entities, vision),
      false,
      kind,
    );
    assert.equal(g.canPlace('house', p, 0), false, kind);
    const before = g.owned(0).filter((e) => e.type === 'house').length;
    g.command({ type: 'build', building: 'house', ...p, builders: [v.id] });
    assert.equal(g.owned(0).filter((e) => e.type === 'house').length, before, kind);
  }
});
test('snapped odd foundations occupy exactly their declared cells and preserve paid build coordinates', () => {
  const g = new Game(config);
  g.state.entities = g.state.entities.filter(
    (e) => (e.team === 0 && e.kind === 'unit') || e.type === 'towncenter',
  );
  g.state.terrain.fill(0);
  const v = g.owned(0).find((e) => e.type === 'villager')!;
  v.x = 25;
  v.y = 70;
  g.visibility();
  const at = snapBuilding('barracks', { x: 26.2, y: 70.1 }),
    half = BUILDINGS.barracks.size / 2;
  assert.deepEqual(at, { x: 26.5, y: 70.5 });
  assert.equal(
    (Math.ceil(at.x + half) - Math.floor(at.x - half)) *
      (Math.ceil(at.y + half) - Math.floor(at.y - half)),
    9,
  );
  assert.ok(g.canPlace('barracks', at, 0));
  const before = g.state.players[0].resources.wood;
  g.command({ type: 'build', building: 'barracks', x: 26.2, y: 70.1, builders: [v.id] });
  const b = g.owned(0).find((e) => e.type === 'barracks')!;
  assert.equal(b.x, at.x);
  assert.equal(b.y, at.y);
  assert.equal(before - g.state.players[0].resources.wood, 140);
});
test('new and legacy maps survive import without changing their terrain dimensions', () => {
  for (const size of [64, 96] as const) {
    const g = new Game({ ...config, mapSize: size }),
      save = g.save();
    if (size === 64) {
      delete save.mapSize;
      delete save.spawnPoints;
    }
    const copy = new Game(config);
    copy.load(save);
    assert.equal(copy.size, size);
    assert.deepEqual(copy.snapshot().spawnPoints, mapLayout(size));
    assert.equal(copy.snapshot().vision.length, size * size);
    assert.deepEqual(copy.save(), save);
  }
});
test('classic fast economy delivers a load every nine to thirteen seconds of actual gathering', () => {
  for (const resource of ['berries', 'tree', 'gold', 'stone'] as const) {
    const g = new Game(config),
      v = g.owned(0).find((e) => e.type === 'villager')!,
      source = g.entity('resource', resource, -1, 28, 70);
    source.amount = 200;
    v.x = 27;
    v.y = 70;
    v.orders = [{ kind: 'gather', target: source.id }];
    for (let i = 0; i < 100; i++) g.gather(v, source, 0.05);
    assert.ok(Math.abs(v.carry - GATHER_RATES[resource] * 5) < 0.00001, resource);
    assert.ok(v.carry < CARRY_CAPACITY, resource);
    assert.equal(g.state.stats.gathered[0], 0);
    assert.ok(
      CARRY_CAPACITY / GATHER_RATES[resource] >= 9 && CARRY_CAPACITY / GATHER_RATES[resource] <= 13,
    );
    for (let i = 0; i < 240 && v.carry < CARRY_CAPACITY; i++) g.gather(v, source, 0.05);
    assert.equal(v.carry, CARRY_CAPACITY);
    assert.equal(g.state.stats.gathered[0], 0);
  }
});
test('wildlife grazes, walks, flees and leaves a stationary finite carcass', () => {
  const g = new Game(config),
    a = g.state.entities.find((e) => e.kind === 'animal' && e.type === 'goat')!;
  g.step();
  assert.equal(a.state, 'graze');
  a.orders = [{ kind: 'move', x: a.x + 2, y: a.y + 1 }];
  g.step();
  assert.equal(a.state, 'walk');
  const v = g.owned(0).find((e) => e.type === 'villager')!;
  v.x = a.x - 2;
  v.y = a.y;
  v.cooldown = 0;
  g.gather(v, a, 0.05);
  assert.equal(v.state, 'attack');
  assert.equal(v.attackPhase, 0);
  for (let i = 0; i < 5; i++) g.gather(v, a, 0.05);
  assert.equal(v.strike?.fired, true);
  assert.equal(a.orders[0].kind, 'move');
  g.hit(a, 100, 0);
  assert.equal(a.state, 'carcass');
  assert.equal(a.alive, false);
  assert.equal(a.orders.length, 0);
  assert.ok(a.amount > 0);
});
test('a click on the middle of a dense mine redirects to its accessible edge and delivers ore', () => {
  const g = new Game(config),
    v = g.owned(0).find((e) => e.type === 'villager')!;
  g.state.entities = g.state.entities.filter(
    (e) => e.team >= 0 || Math.hypot(e.x - 27, e.y - 70) > 8,
  );
  g.state.terrain.fill(0);
  const ores = [];
  for (let y = 69; y <= 71; y++)
    for (let x = 26; x <= 28; x++) {
      const ore = g.entity('resource', 'gold', -1, x + 0.5, y + 0.5);
      ore.amount = 80;
      ores.push(ore);
    }
  v.x = 23.5;
  v.y = 70.5;
  g.visibility();
  const center = ores[4],
    before = g.state.players[0].resources.gold;
  g.command({ type: 'orders', ids: [v.id], order: { kind: 'gather', target: center.id } });
  for (let i = 0; i < 80 * 20; i++) g.step();
  assert.ok(ores.some((e) => e.amount < 80));
  assert.ok(g.state.players[0].resources.gold > before);
  assert.ok(v.orders[0]?.target !== center.id);
});
