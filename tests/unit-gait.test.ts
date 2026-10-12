import assert from 'node:assert/strict';
import test from 'node:test';
import { Game } from '../src/game/engine.ts';
import { movementFrame, unitStrideDistance, walkFrameCount } from '../src/render/unit-gait.ts';
import { DAI_VIET_ART } from '../src/render/civilizations/daiviet.ts';
import { selectUnitArt } from '../src/render/civilization-art-definition.ts';

test('Dai Viet walking alternates complete contacts with passing poses and loops at the same distance', () => {
  for (const type of ['villager', 'militia', 'spear', 'scout', 'elephant']) {
    const stride = unitStrideDistance(type);
    assert.equal(walkFrameCount('daiviet'), 4);
    const poses = Array.from({ length: 8 }, (_, quarter) =>
      selectUnitArt(
        DAI_VIET_ART,
        type,
        movementFrame(type, (stride * quarter) / 4, 'daiviet'),
        0,
        'walk',
      )!
        .pose.sheet.split('-')
        .at(-1),
    );
    const cycle = ['scout', 'elephant'].includes(type)
      ? ['a', 'c', 'b', 'd']
      : ['a', 'd', 'b', 'c'];
    assert.deepEqual(poses, [...cycle, ...cycle], type);
    assert.equal(movementFrame(type, -1, 'daiviet'), 0);
  }
  assert.deepEqual(
    Array.from(
      { length: 4 },
      (_, phase) => selectUnitArt(DAI_VIET_ART, 'daivietcannon', phase, 0, 'walk')!.pose.row,
    ),
    [0, 1, 0, 1],
  );
});

test('walking advances with distance covered and freezes when a unit stops', () => {
  const game = new Game({
    civ: 'daiviet',
    enemy: 'roman',
    map: 'plains',
    difficulty: 'easy',
    seed: 31,
  });
  const villager = game.owned(0).find((e) => e.type === 'villager')!;
  game.command({
    type: 'orders',
    ids: [villager.id],
    order: { kind: 'move', x: villager.x + 4, y: villager.y },
  });
  let distance = 0;
  const phases = new Set<number>();
  for (let i = 0; i < 100; i++) {
    const { x, y } = villager;
    game.step();
    distance += Math.hypot(villager.x - x, villager.y - y);
    phases.add(movementFrame(villager.type, distance));
  }
  assert.equal(phases.size, 4);
  assert.ok(distance > unitStrideDistance(villager.type));
  game.command({ type: 'stop', ids: [villager.id] });
  const stopped = { x: villager.x, y: villager.y, phase: movementFrame(villager.type, distance) };
  for (let i = 0; i < 30; i++) {
    const { x, y } = villager;
    game.step();
    distance += Math.hypot(villager.x - x, villager.y - y);
  }
  assert.equal(villager.x, stopped.x);
  assert.equal(villager.y, stopped.y);
  assert.equal(movementFrame(villager.type, distance), stopped.phase);
});

test('travel sampling rate and camera projection do not change the walking cycle', () => {
  for (const type of ['villager', 'scout', 'elephant', 'daivietcannon']) {
    const length = unitStrideDistance(type) * 2.7;
    const distances = [15, 60, 144].map((samples) => {
      let sum = 0;
      for (let i = 1; i <= samples; i++) {
        const previous = (length * (i - 1)) / samples;
        const current = (length * i) / samples;
        // Same diagonal world travel seen through the game's isometric projection.
        const dx = (current - previous) / Math.sqrt(2);
        const dy = dx;
        const screenX = (dx - dy) * 32;
        const screenY = (dx + dy) * 16;
        sum += Math.hypot(screenY / 32 + screenX / 64, screenY / 32 - screenX / 64);
      }
      return movementFrame(type, sum);
    });
    assert.equal(new Set(distances).size, 1, type);
  }
});
