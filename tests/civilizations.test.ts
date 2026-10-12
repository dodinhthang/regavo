import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/engine.ts';
import {
  CIVS,
  UNITS,
  availableUnits,
  buildingAvailable,
  civilizationUnits,
  unitAvailable,
  unitDefinition,
  type CivId,
} from '../src/game/data.ts';

const civilizations = Object.keys(CIVS) as CivId[];
const ticks = (game: Game, amount: number) => {
  for (let i = 0; i < amount; i++) game.step();
};

test('every civilization starts, saves and resumes as player or AI on every terrain layout', () => {
  for (const civ of civilizations)
    for (const map of ['plains', 'ford', 'passes'] as const)
      for (const team of [0, 1] as const) {
        const opponent = civilizations.find((other) => other !== civ)!;
        const game = new Game({
          civ: team === 0 ? civ : opponent,
          enemy: team === 1 ? civ : opponent,
          map,
          difficulty: 'normal',
          seed: 31,
          mapSize: 64,
        });
        const label = `${civ}/${map}/team ${team}`;
        assert.equal(game.state.players[team].civ, civ, label);
        assert.equal(game.population(team), 7, label);
        ticks(game, 20);
        const restored = new Game(game.state.config);
        restored.load(game.save());
        assert.deepEqual(restored.save(), game.save(), label);
        ticks(game, 20);
        ticks(restored, 20);
        assert.deepEqual(restored.save(), game.save(), label);
      }
});

test('civilization catalogs preserve unique troops, age gates and faction profiles', () => {
  for (const civ of civilizations)
    for (const age of [1, 2, 3]) {
      const game = new Game({
        civ,
        enemy: civilizations.find((other) => other !== civ)!,
        map: 'plains',
        difficulty: 'normal',
        seed: 31,
        mapSize: 64,
      });
      game.state.players[0].age = age;
      game.state.players[0].resources = { food: 10000, wood: 10000, gold: 10000, stone: 10000 };
      for (let i = 0; i < 4; i++) game.entity('building', 'house', 0, 20 + i * 3, 30);
      for (const [type, unit] of Object.entries(UNITS)) {
        const trainer = game.entity('building', unit.building, 0, 30, 35);
        const available = availableUnits(unit.building, civ, age).some(([id]) => id === type);
        const before = { ...game.state.players[0].resources };
        game.command({ type: 'train', building: trainer.id, unit: type });
        assert.deepEqual(
          trainer.queue.map((item) => item.type),
          available ? [type] : [],
          `${civ}/${age}/${type}`,
        );
        if (!available) assert.deepEqual(game.state.players[0].resources, before);
      }
    }
  // These expectations describe faction rules; all factions use the same catalog and engine.
  const roster = civilizationUnits('daiviet', 3);
  assert.equal(roster.length, 12);
  assert.equal(roster.filter(([, d]) => d.role === 'civilian').length, 2);
  assert.equal(
    availableUnits('barracks', 'daiviet', 3).some(([type]) => type === 'militia'),
    false,
  );
  assert.equal(unitAvailable('crossbowman', 'daiviet', 1), false);
  for (const civ of civilizations)
    assert.equal(unitAvailable('militia', civ, 3), civ === 'daiviet', civ);
  assert.equal(unitAvailable('elephant', 'daiviet', 2), false);
  assert.equal(unitAvailable('elephant', 'daiviet', 3), true);
  assert.equal(unitAvailable('elephant', 'persian', 3), true);
  for (const type of ['ram', 'catapult', 'cannon', 'musketeer'])
    assert.equal(unitAvailable(type, 'daiviet', 3), false);
  assert.equal(buildingAvailable('workshop', 'daiviet', 2), false);
  assert.equal(buildingAvailable('workshop', 'daiviet', 3), true);
  assert.equal(buildingAvailable('foundry', 'daiviet', 3), false);
  assert.equal(unitDefinition('elephant', 'daiviet').hp, 380);
  assert.equal(unitDefinition('elephant', 'persian').hp, 500);
  assert.equal(unitDefinition('militia', 'daiviet').bonuses?.cavalry, 2);
});
