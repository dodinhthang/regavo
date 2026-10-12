import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildingFootprintSize } from '../src/game/data.ts';
import { iso, uniso } from '../src/render/camera.ts';
import { foundationProjection, type FoundationCorners } from '../src/render/foundation-geometry.ts';

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('actual Dai Viet ground corners align with the world grid without leaning vertical columns', () => {
  const sheets = JSON.parse(
    readFileSync(new URL('../src/render/daiviet-frames.json', import.meta.url), 'utf8'),
  );
  const ordinary = [
    'towncenter',
    'house',
    'barracks',
    'stable',
    'range',
    'market',
    'granary',
    'lumbercamp',
    'miningcamp',
    'workshop',
    'tower',
    'fortress',
  ];
  const unified = [
    'towncenter',
    'house',
    'lumbercamp',
    'miningcamp',
    'granary',
    'farm',
    'barracks',
    'stable',
    'range',
    'market',
    'workshop',
    'tower',
    'woodwall',
    'woodgate',
    'stonewall',
    'stonegate',
    'fortress',
  ];
  for (const [key, age, types] of [
    ['buildings-age1', 1, ordinary],
    ['buildings-age2', 2, ordinary],
    ['buildings-farms', 1, ['farm', 'farm', 'farm']],
    ['buildings-unified-age3', 3, unified],
    ['buildings-towncenter-house-age3-v10', 3, ['towncenter', 'house']],
    ['buildings-flag-tower', 2, ['tower']],
  ] as const) {
    sheets[key].foundations.forEach((f: FoundationCorners, index: number) => {
      if (['woodwall', 'woodgate', 'stonewall', 'stonegate'].includes(types[index])) return;
      const size = buildingFootprintSize(types[index], age, 'daiviet'),
        projection = foundationProjection(f, size),
        [lx, ly, rx, ry, fx, fy] = f;
      for (const [source, expected] of [
        [
          [lx, ly],
          [-size * 32, 0],
        ],
        [
          [rx, ry],
          [size * 32, 0],
        ],
        [
          [fx, fy],
          [0, size * 16],
        ],
      ]) {
        const actual = projection.project(source[0], source[1]);
        close(actual[0], expected[0]);
        close(actual[1], expected[1]);
        const center = iso({ x: size % 2 ? 0.5 : 0, y: size % 2 ? 0.5 : 0 }),
          tile = uniso({ x: center.x + actual[0], y: center.y + actual[1] });
        close(tile.x, Math.round(tile.x));
        close(tile.y, Math.round(tile.y));
      }
      for (const x of [lx, fx, rx]) {
        const lower = projection.project(x, fy),
          upper = projection.project(x, fy - 80);
        close(lower[0], upper[0]);
        close(lower[1] - upper[1], projection.segments[0].d * 80);
      }
    });
  }
});

test('the ground correction remains continuous through the front corner at every height', () => {
  const projection = foundationProjection([6, 521, 911, 510, 404, 733], 6);
  for (const y of [0, 200, 733, 740]) {
    const [left, right] = projection.segments.map((m) => [
      m.a * 404 + m.tx,
      m.b * 404 + m.d * y + m.ty,
    ]);
    close(left[0], right[0]);
    close(left[1], right[1]);
  }
  assert.throws(() => foundationProjection([0, 10, 20, 10, 0, 20], 2));
});
