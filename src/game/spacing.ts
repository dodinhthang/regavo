import { UNITS } from './data.ts';
import type { Entity } from './types.ts';

/** Ground-space occupied by an intact actor; large mounts need wider lanes. */
export function actorRadius(e: Pick<Entity, 'kind' | 'type'>): number {
  if (e.type === 'elephant') return 1.05;
  if (e.kind === 'animal') return 0.45;
  if (['scout', 'lightcavalry', 'horsearcher', 'lancer', 'heavycavalry'].includes(e.type))
    return 0.66;
  if (UNITS[e.type]?.role === 'siege') return 0.8;
  if (e.type === 'trader' || e.kind === 'building') return 0.65;
  return 0.42;
}
export const ACTOR_GAP = 0.12;
