import { BUILDINGS, buildingSize, type CivId, type Point } from './data.ts';
import type { Entity } from './types.ts';

/** Odd footprints have half-tile centres, so their outline and occupied cells agree. */
export function snapBuilding(type: string, p: Point, civ?: CivId): Point {
  const offset = (buildingSize(type, civ) % 2) / 2;
  return { x: Math.round(p.x - offset) + offset, y: Math.round(p.y - offset) + offset };
}
export function canPlaceBuilding(
  type: string,
  p: Point,
  size: number,
  terrain: readonly number[],
  entities: readonly Entity[],
  vision?: ArrayLike<number>,
  civ?: CivId,
): boolean {
  const d = BUILDINGS[type];
  if (!d || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
  const half = buildingSize(type, civ) / 2;
  if (p.x - half < 2 || p.y - half < 2 || p.x + half > size - 2 || p.y + half > size - 2)
    return false;
  for (let y = Math.floor(p.y - half); y < Math.ceil(p.y + half); y++)
    for (let x = Math.floor(p.x - half); x < Math.ceil(p.x + half); x++) {
      const at = y * size + x;
      if (terrain[at] === 1 || terrain[at] === 2 || (vision && !vision[at])) return false;
    }
  return !entities.some((e) => {
    if (e.kind === 'building' && e.alive && e.state !== 'packed') {
      const other = buildingSize(e.type, e.civ);
      // Wall modules share their end face; ordinary buildings retain their clearance.
      const barriers = ['woodwall', 'woodgate', 'stonewall', 'stonegate'];
      const gap = barriers.includes(type) && barriers.includes(e.type) ? 0 : 0.15;
      return (
        Math.abs(e.x - p.x) < half + other / 2 + gap && Math.abs(e.y - p.y) < half + other / 2 + gap
      );
    }
    if (e.kind === 'resource' && e.alive && e.amount > 0) {
      const r = e.type === 'tree' ? 0.75 : e.type === 'berries' ? 0.6 : 0.65;
      return Math.abs(e.x - p.x) < half + r && Math.abs(e.y - p.y) < half + r;
    }
    if (e.kind === 'animal' && (e.alive || e.amount > 0))
      return Math.abs(e.x - p.x) < half + 0.4 && Math.abs(e.y - p.y) < half + 0.4;
    return false;
  });
}
