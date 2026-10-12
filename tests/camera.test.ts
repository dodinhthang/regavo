import test from 'node:test';
import assert from 'node:assert/strict';
import { iso, uniso, panCamera, zoomCamera } from '../src/render/camera.ts';
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
test('isometric camera preserves sub-tile positions through projection', () => {
  for (const p of [
    { x: 18, y: 69 },
    { x: 23.5, y: 70.5 },
    { x: 78, y: 27 },
    { x: 0, y: 95 },
  ]) {
    const copy = uniso(iso(p));
    close(copy.x, p.x);
    close(copy.y, p.y);
  }
});
test('trackpad panning moves the view by the requested screen distance at every zoom and respects map bounds', () => {
  for (const z of [0.55, 1, 1.65]) {
    const a = iso({ x: 45, y: 45 }),
      b = iso(panCamera({ x: 45, y: 45 }, 130, -75, z, 96));
    close((b.x - a.x) * z, 130);
    close((b.y - a.y) * z, -75);
  }
  const edge = panCamera({ x: 3, y: 3 }, -100000, -100000, 1, 96);
  assert.ok(edge.x >= 2 && edge.y >= 2 && edge.x <= 94 && edge.y <= 94);
});
test('pinch zoom keeps the terrain under the cursor fixed', () => {
  const viewport = { x: 1440, y: 900 },
    center = { x: 45, y: 45 };
  for (const cursor of [
    { x: 200, y: 220 },
    { x: 720, y: 396 },
    { x: 1150, y: 570 },
  ])
    for (const pair of [
      [1, 1.65],
      [1, 0.55],
      [1.65, 0.75],
    ]) {
      const [old, next] = pair,
        offset = uniso({
          x: (cursor.x - viewport.x / 2) / old,
          y: (cursor.y - viewport.y * 0.44) / old,
        }),
        point = { x: center.x + offset.x, y: center.y + offset.y },
        camera = zoomCamera(center, old, next, cursor, viewport, 96),
        world = iso(point),
        origin = iso(camera);
      close(viewport.x / 2 + (world.x - origin.x) * next, cursor.x);
      close(viewport.y * 0.44 + (world.y - origin.y) * next, cursor.y);
    }
});
