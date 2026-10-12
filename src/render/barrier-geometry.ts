import { buildingSize, type Point } from '../game/data.ts';
import type { Entity } from '../game/types.ts';

export type BarrierAxis = 'x' | 'y';
/** Two points on the visible front footing, and the source facade height. */
export type BarrierSockets = readonly [number, number, number, number, number];
export const isBarrier = (type: string) =>
  ['woodwall', 'woodgate', 'stonewall', 'stonegate'].includes(type);
type Barrier = Point & { type: string; civ: string; team: number; barrierAxis?: BarrierAxis };

/** Bits describe the four touching ends: +x, -x, +y, -y. */
export function barrierConnections(at: Barrier, entities: readonly Entity[]) {
  let connections = 0;
  const half = buildingSize(at.type, at.civ as Entity['civ']) / 2;
  for (const e of entities) {
    if (
      !e.alive ||
      e.kind !== 'building' ||
      e.state === 'packed' ||
      e.team !== at.team ||
      !isBarrier(e.type) ||
      e.type.startsWith('wood') !== at.type.startsWith('wood')
    )
      continue;
    const reach = half + buildingSize(e.type, e.civ) / 2,
      dx = e.x - at.x,
      dy = e.y - at.y;
    // A rotated gate connects only through its two ends.
    if (
      Math.abs(dy) < 0.01 &&
      Math.abs(Math.abs(dx) - reach) < 0.01 &&
      !(e.type.endsWith('gate') && e.barrierAxis === 'y')
    )
      connections |= dx > 0 ? 1 : 2;
    if (
      Math.abs(dx) < 0.01 &&
      Math.abs(Math.abs(dy) - reach) < 0.01 &&
      !(e.type.endsWith('gate') && e.barrierAxis === 'x')
    )
      connections |= dy > 0 ? 4 : 8;
  }
  return connections;
}

/** Choose a grid axis from touching friendly modules, including the placement ghost. */
export function barrierDirection(at: Barrier, entities: readonly Entity[]) {
  if (!isBarrier(at.type)) return 2;
  if (at.barrierAxis) return at.barrierAxis === 'x' ? 0 : 2;
  const links = barrierConnections(at, entities),
    x = Number(!!(links & 1)) + Number(!!(links & 2)),
    y = Number(!!(links & 4)) + Number(!!(links & 8));
  return x > y ? 0 : 2;
}

/** Correct an atlas facade to the actual 32×16 grid edge, preserving vertical columns. */
export function barrierProjection(
  sockets: BarrierSockets,
  tiles: number,
  height: number,
  axis: BarrierAxis,
) {
  const [lx, ly, rx, ry, sourceHeight] = sockets;
  if (rx <= lx || sourceHeight <= 0) throw new Error('Invalid barrier sockets');
  // Keep the source's slope. Mirroring selects the other axis without reversing the shear.
  const slope = ry < ly ? -1 : 1,
    a = ((axis === 'x' ? slope : -slope) * tiles * 32) / (rx - lx),
    d = height / sourceHeight,
    b = (slope * tiles * 16 - d * (ry - ly)) / (rx - lx),
    cx = (lx + rx) / 2,
    cy = (ly + ry) / 2;
  const project = (x: number, y: number): [number, number] => [
    a * (x - cx),
    b * (x - cx) + d * (y - cy),
  ];
  return { a, b, d, tx: -a * cx, ty: -b * cx - d * cy, project };
}
