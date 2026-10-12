import type { ArtSprite } from './art';
import { assetUrl } from './asset-url.ts';
import { loadCivilizationBuildings } from './civilization-art.ts';
import { sharedAtlasColumn } from './civilization-art-data.ts';
import { buildingFootprintSize } from '../game/data.ts';
import {
  renderRasterFoundation,
  type BuildingFoundation,
  type BuildingFrame,
} from './buildings.ts';

/** The whole generated PNG is immutable; each era has distinct original architecture. */
const URLS = [
  '/art/building-centers-v6-age1.png',
  '/art/building-centers-v7-age2.png',
  '/art/building-centers-v7-age3.png',
] as const;
const FRAMES: readonly (readonly BuildingFrame[])[] = [
  [
    [25, 65, 484, 399],
    [523, 66, 488, 402],
    [1029, 60, 487, 408],
    [24, 565, 486, 400],
    [531, 559, 480, 404],
  ],
  [
    [15, 126, 489, 343],
    [520, 103, 498, 369],
    [1032, 105, 498, 367],
    [16, 611, 489, 347],
    [520, 594, 499, 365],
  ],
  [
    [14, 80, 509, 409],
    [523, 94, 494, 393],
    [1021, 90, 505, 402],
    [24, 558, 497, 428],
    [523, 548, 496, 437],
  ],
];
// Foundation curb contours are fitted to a symmetric square; no image shear.
const FOUNDATIONS: readonly (readonly BuildingFoundation[])[] = [
  [
    [5, 243, 477, 243, 241, 392],
    [6, 242, 481, 242, 243.5, 396],
    [5, 251, 481, 251, 243, 401],
    [6, 243.5, 479, 243.5, 242.5, 394],
    [6, 246, 474, 246, 240, 397],
  ],
  [
    [2, 226, 487, 226, 244.5, 341],
    [2, 249, 496, 249, 249, 367],
    [2, 247.5, 495, 247.5, 248.5, 364],
    [1, 230, 487, 230, 244, 344],
    [2, 248, 497, 248, 249.5, 362],
  ],
  [
    [2, 280.5, 506, 280.5, 254, 406],
    [1, 266, 491, 266, 246, 391],
    [1, 270, 503, 270, 252, 399],
    [2, 295, 495, 295, 248.5, 425],
    [2, 305, 493, 305, 247.5, 435],
  ],
];
const images: (HTMLImageElement | undefined)[] = [];
const pending = new Map<number, Promise<boolean>>();
const sprites = new Map<string, ArtSprite>();

/** Load independent era palaces; a failed source resolves false for fallback. */
export async function loadBuildingAtlas(
  civs?: readonly string[],
  ages?: readonly number[],
): Promise<boolean> {
  const shared = !civs || civs.some((civ) => sharedAtlasColumn(civ) >= 0);
  const indices = shared ? (ages ?? [1, 2, 3]).map((age) => age - 1) : [];
  const results = await Promise.all([
    loadCivilizationBuildings(civs, ages),
    ...indices.map((index) => {
      if (images[index]) return Promise.resolve(true);
      const existing = pending.get(index);
      if (existing) return existing;
      const promise = new Promise<boolean>((resolve) => {
        if (images[index]) {
          resolve(true);
          return;
        }
        const candidate = new Image();
        candidate.onload = () => {
          if (candidate.naturalWidth !== 1536 || candidate.naturalHeight !== 1024) {
            resolve(false);
            return;
          }
          images[index] = candidate;
          resolve(true);
        };
        candidate.onerror = () => resolve(false);
        candidate.src = assetUrl(URLS[index]);
      }).finally(() => pending.delete(index));
      pending.set(index, promise);
      return promise;
    }),
  ]);
  return results.every(Boolean);
}

/** Visible 4/5/6-tile palaces sit within the engine's 8-tile reservation. */
export function renderCenter(civ: string, age: number, team: number): ArtSprite | undefined {
  const column = sharedAtlasColumn(civ);
  if (column < 0) return undefined;
  age = Math.max(1, Math.min(3, Math.round(age)));
  if (!images[age - 1]) return undefined;
  const key = `${civ}:${age}:${team === 0 ? 0 : 1}`;
  const cached = sprites.get(key);
  if (cached) return cached;
  const result = renderRasterFoundation(
    images[age - 1]!,
    FRAMES[age - 1][column],
    FOUNDATIONS[age - 1][column],
    buildingFootprintSize('towncenter', age),
    team,
    'towncenter',
    { civ, age },
  );
  if (result) sprites.set(key, result);
  return result;
}
