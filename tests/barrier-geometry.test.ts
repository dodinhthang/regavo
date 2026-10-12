import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildingSize } from '../src/game/data.ts';
import { Game } from '../src/game/engine.ts';
import { iso } from '../src/render/camera.ts';
import { WOOD_BARRIER_SOCKETS, STONE_BARRIER_SOCKETS } from '../src/render/barrier-sources.ts';
import {
  barrierDirection,
  barrierConnections,
  barrierProjection,
  type BarrierAxis,
  type BarrierSockets,
} from '../src/render/barrier-geometry.ts';

test('actual Dai Viet wall and gate sockets meet on both grid axes with vertical columns', () => {
  const metadata = JSON.parse(
    readFileSync(new URL('../src/render/daiviet-frames.json', import.meta.url), 'utf8'),
  )['buildings-unified-age3'].barrierSockets as Record<string, BarrierSockets>;
  const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
  for (const material of ['wood', 'stone']) {
    const sockets = metadata[material + 'gate'],
      wallSockets = metadata[material + 'wall'],
      height = material === 'wood' ? 32 : 40,
      gateSize = buildingSize(material + 'gate', 'daiviet'),
      wallSize = buildingSize(material + 'wall', 'daiviet'),
      reach = (gateSize + wallSize) / 2;
    for (const axis of ['x', 'y'] as BarrierAxis[]) {
      const gate = barrierProjection(sockets, gateSize, height, axis),
        wall = barrierProjection(wallSockets, wallSize, height, axis),
        [leftGate, rightGate] = [
          gate.project(sockets[0], sockets[1]),
          gate.project(sockets[2], sockets[3]),
        ].sort((a, b) => a[0] - b[0]),
        [leftWall, rightWall] = [
          wall.project(wallSockets[0], wallSockets[1]),
          wall.project(wallSockets[2], wallSockets[3]),
        ].sort((a, b) => a[0] - b[0]);
      for (const side of [-1, 1]) {
        // Screen-left is world +y on the y axis, and world -x on the x axis.
        const world = iso({
            x: axis === 'x' ? side * reach : 0,
            y: axis === 'y' ? -side * reach : 0,
          }),
          end = side === 1 ? leftWall : rightWall,
          gateEnd = side === 1 ? rightGate : leftGate;
        close(world.x + end[0], gateEnd[0]);
        close(world.y + end[1], gateEnd[1]);
      }
      const ground = gate.project(sockets[0], sockets[1]),
        crown = gate.project(sockets[0], sockets[1] - sockets[4]);
      close(ground[0], crown[0]);
      close(ground[1] - crown[1], height);
      close((rightGate[1] - leftGate[1]) / (rightGate[0] - leftGate[0]), axis === 'x' ? 0.5 : -0.5);
    }
  }
});

test('original scenery and cultural stone facades keep their native slope when rotated', () => {
  const sources = [
    ...Object.values(WOOD_BARRIER_SOCKETS).map((sockets) => ({ sockets, height: 32 })),
    ...Object.values(STONE_BARRIER_SOCKETS)
      .flat()
      .map((sockets) => ({ sockets, height: 40 })),
  ];
  for (const { sockets, height } of sources) {
    const [lx, ly, rx, ry] = sockets,
      x = barrierProjection(sockets, 1, height, 'x'),
      y = barrierProjection(sockets, 1, height, 'y');
    // Reversing the native positive slope formerly distorted other civilizations' facades.
    assert.ok(x.a * (ry - ly) > 0);
    assert.equal(x.b, y.b);
    assert.equal(x.d, y.d);
    for (const [projection, slope] of [
      [x, 0.5],
      [y, -0.5],
    ] as const) {
      const left = projection.project(lx, ly),
        right = projection.project(rx, ry),
        crown = projection.project(lx, ly - sockets[4]);
      assert.ok(Math.abs(Math.abs(right[0] - left[0]) - 32) < 1e-8);
      assert.ok(Math.abs((right[1] - left[1]) / (right[0] - left[0]) - slope) < 1e-8);
      assert.equal(crown[0], left[0]);
      assert.ok(Math.abs(left[1] - crown[1] - height) < 1e-8);
    }
  }
});

test('Dai Viet gate wings match wall heights at the measured visible footing', () => {
  const sockets = JSON.parse(
    readFileSync(new URL('../src/render/daiviet-frames.json', import.meta.url), 'utf8'),
  )['buildings-unified-age3'].barrierSockets as Record<string, BarrierSockets>;
  // Heights independently measured on the end posts, not the taller gatehouse roof.
  for (const [material, wallHeights, gateHeights, height] of [
    ['wood', [123, 109], [101, 98], 32],
    ['stone', [121, 112], [94, 92], 40],
  ] as const) {
    const wall = sockets[material + 'wall'],
      gate = sockets[material + 'gate'];
    for (let side = 0; side < 2; side++)
      assert.ok(
        Math.abs((wallHeights[side] / wall[4] - gateHeights[side] / gate[4]) * height) < 2.2,
        material + ' end posts must have the same height after projection',
      );
  }
});

test('manual rotation overrides neighbours, while elbows and junctions retain every touching end', () => {
  const g = new Game({
    civ: 'daiviet',
    enemy: 'roman',
    map: 'plains',
    difficulty: 'easy',
    seed: 9,
  });
  const wall = g.entity('building', 'stonewall', 0, 40.5, 40.5),
    x = g.entity('building', 'stonewall', 0, 41.5, 40.5),
    y = g.entity('building', 'stonewall', 0, 40.5, 41.5);
  x.barrierAxis = 'x';
  y.barrierAxis = 'y';
  assert.equal(barrierConnections(wall, [x, y]), 5);
  wall.barrierAxis = 'x';
  assert.equal(barrierDirection(wall, [y]), 0);
  wall.barrierAxis = 'y';
  assert.equal(barrierDirection(wall, [x]), 2);
  const gate = g.entity('building', 'stonegate', 0, 42.5, 40.5);
  gate.barrierAxis = 'y';
  assert.equal(barrierConnections(wall, [gate]), 0);
  gate.barrierAxis = 'x';
  assert.equal(barrierConnections(wall, [gate]), 1);
});

test('barriers and their placement ghost choose the axis of touching friendly wall modules', () => {
  const g = new Game({
    civ: 'daiviet',
    enemy: 'roman',
    map: 'plains',
    difficulty: 'easy',
    seed: 9,
  });
  const gate = { type: 'stonegate', civ: 'daiviet', team: 0, x: 40.5, y: 40.5 },
    wall = g.entity('building', 'stonewall', 0, 42.5, 40.5);
  assert.equal(barrierDirection(gate, []), 2);
  assert.equal(barrierDirection(gate, [wall]), 0);
  wall.x = 40.5;
  wall.y = 42.5;
  assert.equal(barrierDirection(gate, [wall]), 2);
  wall.x = 42.5;
  wall.y = 40.5;
  wall.team = 1;
  assert.equal(barrierDirection(gate, [wall]), 2, 'enemy modules do not change orientation');
  wall.team = 0;
  wall.type = 'woodwall';
  assert.equal(barrierDirection(gate, [wall]), 2, 'stone does not snap visually to wood');
});
