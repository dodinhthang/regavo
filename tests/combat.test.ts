import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/engine.ts';
import { isProjectileWeapon, projectileEffects } from '../src/render/combat-effects.ts';
import {
  availableBuildings,
  civilizationUnits,
  unitDefinition,
  type CivId,
} from '../src/game/data.ts';

const arena = (civ: CivId = 'tang') => {
  const g = new Game({
    civ,
    enemy: 'roman',
    map: 'plains',
    difficulty: 'easy',
    seed: 31,
    mapSize: 64,
  });
  g.state.entities = g.state.entities.filter((e) => e.type === 'towncenter');
  g.state.terrain.fill(0);
  g.state.blockedVersion++;
  g.ai = () => {};
  return g;
};
const ticks = (g: Game, n: number) => {
  for (let i = 0; i < n; i++) g.step();
};
const melee = () => {
  const g = arena(),
    a = g.entity('unit', 'sword', 0, 30.2, 30),
    t = g.entity('building', 'house', 1, 32, 30);
  g.order(a, { kind: 'attack', target: t.id });
  a.hold = true;
  return { g, a, t };
};

test('ordinary movement interrupts combat immediately and ignores nearby enemies until arrival', () => {
  const g = arena(),
    a = g.entity('unit', 'sword', 0, 30.5, 30.5),
    t = g.entity('unit', 'spear', 1, 31.6, 30.5);
  t.hold = true;
  ticks(g, 2);
  assert.ok(a.strike && !a.strike.fired);
  const hp = t.hp;
  g.command({ type: 'orders', ids: [a.id], order: { kind: 'move', x: 25.5, y: 30.5 } });
  assert.equal(a.strike, undefined);
  g.hit(a, 0.1, 1, t);
  g.step();
  assert.ok(a.x < 30.5, 'movement must start on the next simulation tick');
  assert.equal(a.state, 'walk');
  ticks(g, 25);
  assert.equal(t.hp, hp);
  assert.ok(a.x < 29);
  assert.equal(a.orders[0].kind, 'move');
});

test('move and retreat commands release melee, ranged, worker and deployed siege wind-ups', () => {
  for (const [civ, type] of [
    ['tang', 'sword'],
    ['tang', 'archer'],
    ['daiviet', 'villager'],
    ['ottoman', 'cannon'],
    ['mongol', 'horsearcher'],
    ['persian', 'elephant'],
    ['roman', 'legionary'],
    ['daiviet', 'lancer'],
  ] as const) {
    for (const command of ['move', 'retreat'] as const) {
      const g = arena(civ),
        a = g.entity('unit', type, 0, 30.5, 30.5),
        t = g.entity('unit', 'spear', 1, 31.6, 30.5);
      t.hold = true;
      if (type === 'cannon') a.deployed = true;
      g.order(a, { kind: 'attack', target: t.id });
      ticks(g, 2);
      assert.ok(a.strike && !a.strike.fired, type + ' has an unfinished blow');
      const hp = t.hp;
      if (command === 'move')
        g.command({ type: 'orders', ids: [a.id], order: { kind: 'move', x: 20.5, y: 30.5 } });
      else g.command({ type: 'retreat', ids: [a.id], x: 20.5, y: 30.5 });
      for (let i = 0; i < 30; i++) {
        g.hit(a, 0.01, 1, t);
        g.step();
        assert.notEqual(a.state, 'attack', `${type} must obey ${command} even when hit`);
        assert.equal(a.strike, undefined);
      }
      assert.ok(a.x < 30, type + ' must leave the engagement');
      assert.equal(t.hp, hp, type + ' must cancel its unfinished blow');
      assert.equal(a.deployed, false);
      assert.equal(a.orders[0].kind, 'move');
    }
  }
});

test('retreating a group assigns separate destinations and everyone leaves the fight', () => {
  const g = arena(),
    units = [];
  for (let y = 0; y < 5; y++) {
    for (const x of [29.3, 30.5]) units.push(g.entity('unit', 'sword', 0, x, 30.5 + y * 1.2));
    const enemy = g.entity('unit', 'spear', 1, 31.6, 30.5 + y * 1.2);
    enemy.hold = true;
  }
  ticks(g, 2);
  assert.ok(units.some((e) => e.state === 'attack'));
  g.command({ type: 'retreat', ids: units.map((e) => e.id), x: 20.5, y: 32.9 });
  assert.equal(new Set(units.map((e) => `${e.orders[0].x}:${e.orders[0].y}`)).size, units.length);
  ticks(g, 180);
  for (const e of units) {
    assert.ok(e.alive && e.x < 28, e.id + ' must retreat out of melee range with the group');
    assert.notEqual(e.state, 'attack');
    assert.equal(e.strike, undefined);
  }
});

test('commanded attack target takes priority over retaliation against a different enemy', () => {
  const g = arena(),
    a = g.entity('unit', 'sword', 0, 30.5, 30.5),
    attacker = g.entity('unit', 'spear', 1, 31.6, 30.5),
    target = g.entity('unit', 'spear', 1, 30.5, 31.6);
  attacker.hold = target.hold = true;
  g.order(a, { kind: 'attack', target: attacker.id });
  ticks(g, 2);
  g.command({ type: 'orders', ids: [a.id], order: { kind: 'attack', target: target.id } });
  for (let i = 0; i < 40; i++) {
    g.hit(a, 0.01, 1, attacker);
    g.step();
    if (a.strike) assert.equal(a.strike.target, target.id);
  }
  assert.ok(target.hp < target.maxHp);
  assert.equal(attacker.hp, attacker.maxHp);
  assert.equal(a.orders[0].target, target.id);
});

test('attack-move and idle units still engage while a completed move resumes automatic defense', () => {
  for (const mode of ['attackmove', 'arrival', 'idle']) {
    const g = arena(),
      a = g.entity('unit', 'sword', 0, 30.5, 30.5),
      t = g.entity('unit', 'spear', 1, 31.6, 30.5);
    t.hold = true;
    if (mode === 'attackmove') g.order(a, { kind: 'attackmove', x: 40.5, y: 30.5 });
    if (mode === 'arrival') {
      g.order(a, { kind: 'move', x: a.x, y: a.y });
      g.step();
      assert.equal(a.orders.length, 0);
      assert.equal(a.strike, undefined, 'the last move tick must finish before auto combat');
    }
    ticks(g, 10);
    assert.ok(t.hp < t.maxHp, mode);
  }
});

test('queued movement and movement loaded from an old save keep command priority', () => {
  const g = arena(),
    a = g.entity('unit', 'archer', 0, 30.5, 30.5),
    t = g.entity('unit', 'spear', 1, 33.5, 30.5);
  t.hold = true;
  g.command({ type: 'orders', ids: [a.id], order: { kind: 'move', x: 28.5, y: 30.5 } });
  g.command({
    type: 'orders',
    ids: [a.id],
    order: { kind: 'move', x: 24.5, y: 30.5 },
    append: true,
  });
  const copy = arena();
  copy.load(g.save());
  copy.ai = () => {};
  for (const run of [g, copy]) {
    ticks(run, 75);
    assert.equal(run.get(t.id)!.hp, t.maxHp);
    assert.ok(run.get(a.id)!.x < 26);
  }
  assert.deepEqual(copy.save(), g.save());
});

test('workers retaliate against a melee attacker and then resume harvesting', () => {
  const g = arena(),
    v = g.entity('unit', 'villager', 0, 30.5, 30.5),
    tree = g.entity('resource', 'tree', -1, 30.5, 31.5),
    enemy = g.entity('unit', 'spear', 1, 31.6, 30.5);
  tree.amount = 100;
  enemy.hold = true;
  enemy.hp = 3;
  g.order(v, { kind: 'gather', target: tree.id });
  g.hit(v, 1, 1, enemy);
  ticks(g, 35);
  assert.equal(enemy.alive, false);
  assert.equal(v.orders[0].kind, 'gather');
  ticks(g, 80);
  assert.ok(v.carry > 0);
});

test('auto targeting ignores inaccessible enemies and prefers soldiers over nearby masonry', () => {
  const g = arena(),
    a = g.entity('unit', 'archer', 0, 30.5, 30.5),
    wall = g.entity('building', 'woodwall', 1, 30.5, 28.5),
    enemy = g.entity('unit', 'spear', 1, 33.5, 30.5);
  enemy.hold = true;
  ticks(g, 20);
  assert.ok(enemy.hp < enemy.maxHp);
  assert.equal(wall.hp, wall.maxHp);
  const h = arena(),
    soldier = h.entity('unit', 'sword', 0, 30.5, 30.5),
    blocked = h.entity('unit', 'spear', 1, 33.5, 30.5),
    reachable = h.entity('unit', 'spear', 1, 26.5, 30.5);
  for (let y = 1; y < h.size - 1; y++) h.state.terrain[y * h.size + 32] = 2;
  h.state.blockedVersion++;
  h.visibility();
  assert.equal(h.enemyTarget(soldier, 6)?.id, reachable.id);
  assert.notEqual(soldier.combatTarget, blocked.id);
  assert.ok(a.alive);
});

test('crowded soldiers strike in range without waiting for an empty contact slot', () => {
  const g = arena(),
    a = g.entity('unit', 'sword', 0, 30.5, 30.5),
    target = g.entity('unit', 'spear', 1, 31.5, 30.5);
  g.entity('unit', 'villager', 0, 30.5, 30.5);
  g.visibility();
  assert.equal(g.actorSpace(a, a), false);
  g.attack(a, target, 0.05);
  assert.equal(a.state, 'attack');
  assert.equal(a.strike?.target, target.id);
});

test('alternating attackers do not reset a defenders wind-up every tick', () => {
  for (const type of ['sword', 'villager']) {
    const g = arena(),
      defender = g.entity('unit', type, 0, 30.5, 30.5),
      enemies = [
        g.entity('unit', 'spear', 1, 31.6, 30.5),
        g.entity('unit', 'spear', 1, 30.5, 31.6),
      ];
    for (const e of enemies) e.hold = true;
    for (let i = 0; i < 12; i++) {
      g.hit(defender, 0.01, 1, enemies[i % 2]);
      g.step();
    }
    assert.ok(
      enemies.some((e) => e.hp < e.maxHp),
      type,
    );
    assert.ok(defender.alive);
  }
});

test('melee winds up, hits once at the impact pose, then recovers', () => {
  const { g, a, t } = melee(),
    before = t.hp,
    damage = g.damage(a, t);
  ticks(g, 1);
  assert.equal(a.attackPhase, 0);
  assert.equal(t.hp, before);
  ticks(g, 4);
  assert.equal(a.attackPhase, 1);
  assert.equal(t.hp, before);
  ticks(g, 2);
  assert.equal(a.attackPhase, 2);
  assert.equal(t.hp, before - damage);
  ticks(g, 10);
  assert.equal(a.attackPhase, 3);
  assert.equal(t.hp, before - damage);
  ticks(g, 15);
  assert.equal(t.hp, before - damage * 2);
});

test('moving out of reach or replacing an order cancels the pending blow', () => {
  const { g, a, t } = melee(),
    before = t.hp;
  ticks(g, 3);
  t.x += 8;
  g.state.blockedVersion++;
  ticks(g, 10);
  assert.equal(t.hp, before);
  assert.equal(a.strike, undefined);
  t.x = 32;
  g.state.blockedVersion++;
  a.cooldown = 0;
  ticks(g, 2);
  assert.ok(a.strike);
  g.command({ type: 'stop', ids: [a.id] });
  a.hold = true;
  t.x += 8;
  g.state.blockedVersion++;
  ticks(g, 10);
  assert.equal(t.hp, before);
  assert.equal(a.strike, undefined);
  assert.equal(a.attackPhase, undefined);
});

test('firearms share projectile effects and release their shot at impact rather than while aiming', () => {
  for (const type of ['crossbowman', 'handcannoneer', 'daivietcannon'])
    assert.equal(isProjectileWeapon(type), true);
  assert.deepEqual(
    projectileEffects('handcannoneer', { x: 0, y: 0 }, { x: 100, y: 30 }, 0.5),
    projectileEffects('musketeer', { x: 0, y: 0 }, { x: 100, y: 30 }, 0.5),
  );
  const g = arena('ottoman'),
    a = g.entity('unit', 'musketeer', 0, 30, 30),
    t = g.entity('building', 'house', 1, 35, 30);
  g.order(a, { kind: 'attack', target: t.id });
  a.hold = true;
  ticks(g, 5);
  assert.equal(a.attackPhase, 1);
  assert.equal(g.state.projectiles.length, 0);
  ticks(g, 3);
  assert.equal(a.attackPhase, 2);
  assert.equal(g.state.projectiles.length, 1);
  ticks(g, 8);
  assert.ok(t.hp < t.maxHp);
  assert.equal(g.state.projectiles.length, 0);
  ticks(g, 20);
  assert.equal(a.attackPhase, 3);
  assert.equal(g.state.projectiles.length, 0);
});

test('saving in the wind-up preserves exactly one strike and the same simulation', () => {
  const { g, a } = melee();
  ticks(g, 4);
  assert.equal(a.strike?.fired, false);
  const copy = arena();
  copy.load(g.save());
  copy.ai = () => {};
  ticks(g, 20);
  ticks(copy, 20);
  assert.deepEqual(copy.save(), g.save());
});

test('crowd displacement cannot extend melee reach at the moment of impact', () => {
  const g = arena('roman'),
    a = g.entity('unit', 'spear', 0, 31.5, 30),
    t = g.entity('unit', 'villager', 1, 30, 30);
  g.order(a, { kind: 'attack', target: t.id });
  ticks(g, 6);
  const before = t.hp;
  a.x += 0.31;
  g.step();
  assert.equal(t.hp, before);
  assert.equal(a.strike, undefined);
  ticks(g, 35);
  assert.ok(t.hp < before);
});

test('a shield raised during the wind-up protects at impact while charge is retained', () => {
  const g = arena('mongol'),
    a = g.entity('unit', 'lancer', 0, 30, 30),
    t = g.entity('unit', 'legionary', 1, 31.1, 30);
  t.dir = 4;
  t.hold = true;
  a.charge = 5;
  g.order(a, { kind: 'attack', target: t.id });
  a.hold = true;
  ticks(g, 6);
  assert.equal(a.strike?.charge, 5);
  const before = t.hp;
  g.command({ type: 'shield', ids: [t.id] }, 1);
  const protectedDamage = g.damage(a, t, 5);
  g.step();
  assert.equal(t.hp, before - protectedDamage);
  assert.ok(protectedDamage < g.damage(a, { ...t, shield: false }, 5));
});

test('civilization profiles affect recruitment, and unique weapons stay with their faction', () => {
  const g = arena('ottoman'),
    b = g.entity('building', 'barracks', 0, 30, 30),
    before = { ...g.state.players[0].resources };
  g.command({ type: 'train', building: b.id, unit: 'spear' });
  assert.equal(g.state.players[0].resources.food, before.food - 40);
  assert.equal(g.state.players[0].resources.wood, before.wood - 18);
  ticks(g, 280);
  const recruit = g.owned(0).find((e) => e.type === 'spear')!;
  assert.equal(recruit.maxHp, 65);
  assert.ok(unitDefinition('sword', 'tang').damage > unitDefinition('sword', 'roman').damage);
  assert.ok(
    unitDefinition('lightcavalry', 'mongol').speed > unitDefinition('lightcavalry', 'tang').speed,
  );
  const types = (c: CivId) => civilizationUnits(c, 3).map(([type]) => type);
  assert.ok(types('ottoman').includes('musketeer') && types('ottoman').includes('cannon'));
  assert.ok(!types('tang').includes('musketeer') && types('tang').includes('heavycavalry'));
  assert.ok(types('persian').includes('elephant') && !types('roman').includes('elephant'));
});

test('counter roles change actual damage, including armor penetration and building siege', () => {
  const g = arena('ottoman'),
    spear = g.entity('unit', 'spear', 0, 30, 30),
    sword = g.entity('unit', 'sword', 0, 32, 30),
    cannon = g.entity('unit', 'cannon', 0, 34, 30),
    musket = g.entity('unit', 'musketeer', 0, 36, 30);
  const horse = g.entity('unit', 'lightcavalry', 1, 30, 32),
    bow = g.entity('unit', 'archer', 1, 32, 32),
    heavy = g.entity('unit', 'heavycavalry', 1, 34, 32),
    house = g.entity('building', 'house', 1, 40, 40);
  assert.ok(g.damage(spear, horse) > g.damage(spear, bow) * 2);
  assert.ok(g.damage(sword, bow) > g.damage(sword, horse));
  assert.ok(g.damage(cannon, house) > g.damage(cannon, bow) * 2);
  assert.equal(
    g.damage(musket, heavy),
    23 * 1.25 - unitDefinition('heavycavalry', 'roman').armor! * 0.5,
  );
});

test('curated siege rosters govern the catalog and actual recruitment', () => {
  const roster = (c: CivId, age = 3) =>
    civilizationUnits(c, age)
      .filter(([, d]) => d.role === 'siege')
      .map(([type]) => type);
  assert.deepEqual(roster('roman'), ['ram', 'catapult']);
  assert.deepEqual(roster('persian'), ['ram', 'catapult']);
  assert.deepEqual(roster('mongol'), ['catapult']);
  assert.deepEqual(roster('mongol', 2), []);
  assert.deepEqual(roster('tang', 2), ['catapult']);
  assert.deepEqual(roster('ottoman'), ['cannon']);
  for (const civ of ['mongol', 'tang', 'ottoman'] as CivId[]) {
    const g = arena(civ);
    g.state.players[0].age = 3;
    const w = g.entity('building', 'workshop', 0, 30, 30),
      before = { ...g.state.players[0].resources };
    g.command({ type: 'train', building: w.id, unit: 'ram' });
    assert.equal(w.queue.length, 0);
    assert.deepEqual(g.state.players[0].resources, before);
  }
  const g = arena('tang');
  g.state.players[0].age = 2;
  const w = g.entity('building', 'workshop', 0, 30, 30),
    before = g.state.players[0].resources.wood;
  g.command({ type: 'train', building: w.id, unit: 'catapult' });
  assert.equal(w.queue.length, 1);
  assert.equal(g.state.players[0].resources.wood, before - 130);
  assert.ok(!availableBuildings('ottoman', 3).some(([type]) => type === 'workshop'));
  assert.ok(availableBuildings('ottoman', 3).some(([type]) => type === 'foundry'));
});

test('siege wind-up, flight, splash and building damage follow the faction profile', () => {
  const shot = (civ: CivId) => {
    const g = arena(civ),
      a = g.entity('unit', 'catapult', 0, 30, 30),
      t = g.entity('building', 'house', 1, 35, 30);
    a.hold = true;
    g.order(a, { kind: 'attack', target: t.id });
    for (let i = 0; i < 20 && !g.state.projectiles.length; i++) g.step();
    assert.equal(a.attackPhase, 2);
    const p = g.state.projectiles[0];
    assert.ok(p);
    return { g, a, t, p };
  };
  const tang = shot('tang'),
    mongol = shot('mongol'),
    rome = shot('roman');
  assert.ok(tang.g.state.tick < mongol.g.state.tick);
  assert.ok(tang.p.duration < mongol.p.duration);
  assert.equal(tang.p.splash, 0.75);
  assert.equal(mongol.p.splash, 1);
  assert.equal(rome.p.splash, 1.35);
  assert.ok(mongol.p.damage > tang.p.damage * 2);
  const copy = arena('mongol');
  copy.load(mongol.g.save());
  copy.ai = () => {};
  ticks(copy, 12);
  ticks(mongol.g, 12);
  assert.deepEqual(copy.save(), mongol.g.save());
});

test('trade advantages affect real rewards and recruitment costs', () => {
  const reward = (civ: CivId) => {
    const g = arena(civ),
      home = g.entity('building', 'market', 0, 20, 30),
      destination = g.entity('building', 'market', 0, 30, 30),
      u = g.entity('unit', 'trader', 0, 32.2, 30);
    u.tradeHome = home.id;
    g.order(u, { kind: 'trade', target: destination.id, origin: home.id });
    const before = g.state.players[0].resources.gold;
    g.step();
    return g.state.players[0].resources.gold - before;
  };
  assert.equal(reward('roman'), 14);
  assert.equal(reward('persian'), 18);
  assert.ok(unitDefinition('trader', 'mongol').speed > unitDefinition('trader', 'ottoman').speed);
  const g = arena('tang');
  g.state.players[0].age = 2;
  const market = g.entity('building', 'market', 0, 30, 30),
    before = { ...g.state.players[0].resources };
  g.command({ type: 'train', building: market.id, unit: 'trader' });
  assert.equal(market.queue.length, 1);
  assert.equal(g.state.players[0].resources.food, before.food - 45);
  assert.equal(g.state.players[0].resources.wood, before.wood - 45);
});

test('splash respects each victim rather than inheriting the building hit bonus', () => {
  const g = arena('mongol'),
    a = g.entity('unit', 'catapult', 0, 30.5, 30.5),
    wall = g.entity('building', 'woodwall', 1, 35.5, 30.5),
    victim = g.entity('unit', 'legionary', 1, 35.5, 31.2);
  a.hold = true;
  victim.hold = true;
  victim.shield = true;
  victim.dir = 4;
  g.order(a, { kind: 'attack', target: wall.id });
  while (!g.state.projectiles.length) g.step();
  const p = g.state.projectiles[0],
    hp = victim.hp,
    expected = g.damage(a, victim) * 0.55;
  g.hit(a, a.hp, 1);
  const copy = arena('mongol');
  copy.load(g.save());
  copy.ai = () => {};
  const legacy = arena('mongol');
  const old = g.save();
  delete old.projectiles[0].source;
  legacy.load(old);
  legacy.ai = () => {};
  ticks(g, 20);
  ticks(copy, 20);
  ticks(legacy, 20);
  assert.equal(victim.hp, hp - expected);
  assert.ok(p.damage * 0.55 > expected * 3);
  assert.deepEqual(copy.save(), g.save());
  assert.equal(legacy.get(victim.id)!.hp, victim.hp);
});

test('elephant trample does not transfer its building bonus to nearby infantry', () => {
  const g = arena('persian'),
    a = g.entity('unit', 'elephant', 0, 30.5, 30.5),
    wall = g.entity('building', 'woodwall', 1, 32.5, 30.5),
    victim = g.entity('unit', 'legionary', 1, 32.5, 31.2);
  a.hold = true;
  victim.hold = true;
  g.order(a, { kind: 'attack', target: wall.id });
  const before = victim.hp,
    expected = g.damage(a, victim) * 0.35;
  ticks(g, 12);
  assert.equal(victim.hp, before - expected);
  assert.ok(g.damage(a, wall) * 0.35 > expected);
});
