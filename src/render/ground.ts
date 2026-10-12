/** New ground materials generated for Regavo, sampled from the preserved atlas. */
let atlas: HTMLImageElement | undefined;
let pending: Promise<boolean> | undefined;
export function loadGroundAtlas(): Promise<boolean> {
  if (atlas) return Promise.resolve(true);
  if (pending) return pending;
  pending = new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      atlas = image;
      resolve(true);
    };
    image.onerror = () => resolve(false);
    image.src = '/art/terrain-v3.png';
  });
  return pending;
}
export function paintGround(
  terrain: number[],
  seed: number,
  size = Math.sqrt(terrain.length),
  bases: { x: number; y: number }[] = [],
): HTMLCanvasElement | undefined {
  if (!atlas) return;
  const plane = document.createElement('canvas');
  plane.width = plane.height = size * 32;
  const c = plane.getContext('2d')!;
  const material = (column: number, row: number) => {
    const tile = document.createElement('canvas');
    tile.width = tile.height = 256;
    tile
      .getContext('2d')!
      .drawImage(
        atlas!,
        (column * atlas!.width) / 2,
        (row * atlas!.height) / 2,
        atlas!.width / 2,
        atlas!.height / 2,
        0,
        0,
        256,
        256,
      );
    return c.createPattern(tile, 'repeat')!;
  };
  const grass = material(0, 0),
    earth = material(1, 0),
    water = material(0, 1),
    rock = material(1, 1);
  c.fillStyle = grass;
  c.fillRect(0, 0, plane.width, plane.width);
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // Large soft patches break texture repetition without outlining simulation tiles.
  // Keep patch density stable in the small home diorama as well as the 96-tile map.
  const patchCount = Math.max(8, Math.round(350 * (size / 96) ** 2));
  for (let i = 0; i < patchCount; i++) {
    const x = random() * plane.width,
      y = random() * plane.width,
      r = 35 + random() * 130,
      g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, random() > 0.5 ? 'rgba(61,77,32,.17)' : 'rgba(194,171,95,.14)');
    g.addColorStop(1, 'rgba(80,83,40,0)');
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Dirt lanes follow the resource routes of the two settlements.
  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (const base of bases.slice(0, 2)) {
    const side = base.x < size / 2 ? 1 : -1;
    for (const end of [
      { x: base.x + side * 7, y: base.y + side * 5 },
      { x: base.x - side * 4, y: base.y + side * 7 },
      { x: base.x - side * 4, y: base.y - side * 7 },
    ]) {
      for (const [width, alpha] of [
        [42, 0.12],
        [32, 0.21],
        [24, 0.44],
        [14, 0.68],
      ]) {
        c.globalAlpha = alpha;
        c.strokeStyle = earth;
        c.lineWidth = width;
        c.beginPath();
        c.moveTo(base.x * 32, base.y * 32);
        c.bezierCurveTo(
          (base.x + (end.x - base.x) * 0.3) * 32,
          base.y * 32,
          (base.x + (end.x - base.x) * 0.65) * 32,
          end.y * 32,
          end.x * 32,
          end.y * 32,
        );
        c.stroke();
      }
    }
  }
  c.globalAlpha = 1;
  // Boundaries remain faithful to the collision grid; the shore has textured earth.
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (terrain[y * size + x] === 1) {
        c.fillStyle = earth;
        c.fillRect(x * 32 - 8, y * 32 - 8, 48, 48);
      }
  c.save();
  c.beginPath();
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) if (terrain[y * size + x] === 1) c.rect(x * 32, y * 32, 32, 32);
  c.clip();
  c.fillStyle = water;
  c.fillRect(0, 0, plane.width, plane.width);
  c.restore();
  c.save();
  c.beginPath();
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) if (terrain[y * size + x] === 2) c.rect(x * 32, y * 32, 32, 32);
  c.clip();
  c.fillStyle = rock;
  c.fillRect(0, 0, plane.width, plane.width);
  c.restore();
  const output = document.createElement('canvas');
  output.width = size * 64 + 64;
  output.height = size * 32 + 64;
  const result = output.getContext('2d')!;
  result.setTransform(1, 0.5, -1, 0.5, size * 32 + 32, 24);
  result.drawImage(plane, 0, 0);
  return output;
}
