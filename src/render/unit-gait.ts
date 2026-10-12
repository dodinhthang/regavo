import { UNITS } from '../game/data.ts';

/** Distance covered by a complete left/right walking cycle, in world tiles. */
export function unitStrideDistance(type: string) {
  if (type === 'elephant') return 2.6;
  const role = UNITS[type]?.role;
  return role === 'cavalry' ? 2.2 : role === 'siege' || type === 'trader' ? 1.8 : 1.4;
}

/** Advance feet with actual movement, so pauses and different unit speeds do not slide. */
export function walkFrameCount(_civ: string) {
  return 4;
}

export function movementFrame(type: string, distance: number, civ = '') {
  const frames = walkFrameCount(civ);
  return Math.floor((Math.max(0, distance) * frames) / unitStrideDistance(type) + 1e-10) % frames;
}
