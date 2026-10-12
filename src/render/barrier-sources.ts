import type { BarrierSockets } from './barrier-geometry.ts';

/** Points are local to the unchanged atlas crops, on their visible front footing. */
export const WOOD_BARRIER_SOCKETS: Readonly<Record<string, BarrierSockets>> = {
  woodwall: [32, 302, 291, 177, 160],
  woodgate: [32, 315, 335, 182, 170],
};

/** buildings-v3-d: Roman, Mongol, Persian, Tang and Ottoman columns. */
export const STONE_BARRIER_SOCKETS: Readonly<Record<string, readonly BarrierSockets[]>> = {
  stonewall: [
    [6, 137, 202.5, 211, 110],
    [7, 107, 187, 188, 100],
    [6, 129, 202, 202, 105],
    [7, 136, 209.5, 213, 110],
    [7, 144, 210, 219, 125],
  ],
  stonegate: [
    [6, 146, 224.5, 208, 110],
    [6, 180, 176, 238, 130],
    [6, 151, 186.5, 208, 120],
    [7, 168, 215, 233, 110],
    [6, 162, 206, 222, 130],
  ],
};
