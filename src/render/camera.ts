import type { Point } from '../game/data.ts';
export const iso = (p: Point): Point => ({ x: (p.x - p.y) * 32, y: (p.x + p.y) * 16 });
export const uniso = (p: Point): Point => ({ x: p.x / 64 + p.y / 32, y: p.y / 32 - p.x / 64 });
const clamp = (p: Point, size: number): Point => ({
  x: Math.max(2, Math.min(size - 2, p.x)),
  y: Math.max(2, Math.min(size - 2, p.y)),
});
export function panCamera(
  center: Point,
  dx: number,
  dy: number,
  zoom: number,
  size: number,
): Point {
  const delta = uniso({ x: dx / zoom, y: dy / zoom });
  return clamp({ x: center.x + delta.x, y: center.y + delta.y }, size);
}
export function zoomCamera(
  center: Point,
  previous: number,
  next: number,
  cursor: Point,
  viewport: Point,
  size: number,
): Point {
  const offset = uniso({ x: cursor.x - viewport.x / 2, y: cursor.y - viewport.y * 0.44 });
  return clamp(
    {
      x: center.x + offset.x * (1 / previous - 1 / next),
      y: center.y + offset.y * (1 / previous - 1 / next),
    },
    size,
  );
}
