import type { ArtSprite } from './art.ts';
import { barrierProjection, type BarrierAxis, type BarrierSockets } from './barrier-geometry.ts';

/** Join half facades at the centre for elbows, T junctions and crossings. */
export function joinBarrier(x: ArtSprite, y: ArtSprite, links: number): ArtSprite {
  const ratio = 2,
    left = Math.max(x.anchorX / (x.pixelRatio ?? 1), y.anchorX / (y.pixelRatio ?? 1)),
    top = Math.max(x.anchorY / (x.pixelRatio ?? 1), y.anchorY / (y.pixelRatio ?? 1)),
    right = Math.max(
      (x.canvas.width - x.anchorX) / (x.pixelRatio ?? 1),
      (y.canvas.width - y.anchorX) / (y.pixelRatio ?? 1),
    ),
    bottom = Math.max(
      (x.canvas.height - x.anchorY) / (x.pixelRatio ?? 1),
      (y.canvas.height - y.anchorY) / (y.pixelRatio ?? 1),
    ),
    canvas = document.createElement('canvas');
  canvas.width = Math.ceil((left + right) * ratio);
  canvas.height = Math.ceil((top + bottom) * ratio);
  const c = canvas.getContext('2d')!;
  c.scale(ratio, ratio);
  c.translate(left, top);
  for (const [bit, sprite, side] of [
    [1, x, 1],
    [2, x, -1],
    [4, y, -1],
    [8, y, 1],
  ] as const) {
    if (!(links & bit)) continue;
    const r = sprite.pixelRatio ?? 1;
    c.save();
    c.beginPath();
    c.rect(side > 0 ? -1 : -left, -top, (side > 0 ? right : left) + 1, top + bottom);
    c.clip();
    c.drawImage(
      sprite.canvas,
      -sprite.anchorX / r,
      -sprite.anchorY / r,
      sprite.canvas.width / r,
      sprite.canvas.height / r,
    );
    c.restore();
  }
  return {
    canvas,
    pixelRatio: ratio,
    anchorX: left * ratio,
    anchorY: top * ratio,
    footprint: x.footprint,
  };
}

/** Project measured end faces onto tile boundaries, so modules meet in world coordinates. */
export function renderBarrier(
  image: HTMLCanvasElement,
  sockets: BarrierSockets,
  tiles: number,
  wood: boolean,
  axis: BarrierAxis,
): ArtSprite {
  const m = barrierProjection(sockets, tiles, wood ? 32 : 40, axis),
    corners = [
      m.project(0, 0),
      m.project(image.width, 0),
      m.project(image.width, image.height),
      m.project(0, image.height),
    ],
    minX = Math.floor(Math.min(...corners.map(([x]) => x))) - 4,
    minY = Math.floor(Math.min(...corners.map(([, y]) => y))) - 4,
    maxX = Math.ceil(Math.max(...corners.map(([x]) => x))) + 4,
    maxY = Math.ceil(Math.max(...corners.map(([, y]) => y))) + 4,
    ratio = 2,
    canvas = document.createElement('canvas');
  canvas.width = (maxX - minX) * ratio;
  canvas.height = (maxY - minY) * ratio;
  const c = canvas.getContext('2d')!;
  c.scale(ratio, ratio);
  c.translate(-minX, -minY);
  c.transform(m.a, m.b, 0, m.d, m.tx, m.ty);
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  c.drawImage(image, 0, 0);
  return {
    canvas,
    pixelRatio: ratio,
    anchorX: -minX * ratio,
    anchorY: -minY * ratio,
    footprint: [
      [0, -tiles * 16],
      [tiles * 32, 0],
      [0, tiles * 16],
      [-tiles * 32, 0],
    ],
    connectionPoints: [m.project(sockets[0], sockets[1]), m.project(sockets[2], sockets[3])],
  };
}
