import type { ArtSprite } from './art.ts';

/** Runtime samples of the original generated atlas; source PNG is unmodified. */
type NatureType = 'tree' | 'berry' | 'gold' | 'stone';
type Frame = {
  column: number;
  row: number;
  anchor: [number, number];
  visibleWidth: number;
  displayWidth: number;
};
const CELL = 627;
const FRAMES: Record<NatureType, Frame> = {
  tree: { column: 0, row: 0, anchor: [323, 589], visibleWidth: 435, displayWidth: 118 },
  berry: { column: 1, row: 0, anchor: [334.5, 600], visibleWidth: 348, displayWidth: 69 },
  gold: { column: 0, row: 1, anchor: [329, 554], visibleWidth: 413, displayWidth: 76 },
  stone: { column: 1, row: 1, anchor: [324.5, 560], visibleWidth: 420, displayWidth: 77 },
};
let atlas: HTMLImageElement | undefined;
let pending: Promise<boolean> | undefined;
const prepared = new Map<NatureType, ArtSprite>();

/** Resolve once. A failed load returns false so authored Canvas art can remain. */
export function loadNatureAtlas(): Promise<boolean> {
  if (atlas) return Promise.resolve(true);
  if (pending) return pending;
  if (typeof Image === 'undefined') return Promise.resolve(false);
  pending = new Promise<boolean>((resolve) => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth !== CELL * 2 || image.naturalHeight !== CELL * 2) {
        resolve(false);
        return;
      }
      atlas = image;
      resolve(true);
    };
    image.onerror = () => resolve(false);
    const base = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
    image.src = `${base}art/nature-v2.png`;
  });
  return pending;
}

/** Accept engine `berries` and Scene's `berry` alias; unknown resources fall back. */
export function renderNature(type: string): ArtSprite | undefined {
  const key = type === 'berries' ? 'berry' : type;
  if (!atlas || !Object.hasOwn(FRAMES, key)) return undefined;
  const natureType = key as NatureType;
  const cached = prepared.get(natureType);
  if (cached) return cached;
  const frame = FRAMES[natureType];
  const canvas = document.createElement('canvas');
  canvas.width = 292;
  canvas.height = 332;
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  context.scale(2, 2);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  const scale = frame.displayWidth / frame.visibleWidth;
  context.drawImage(
    atlas,
    frame.column * CELL,
    frame.row * CELL,
    CELL,
    CELL,
    73 - frame.anchor[0] * scale,
    143 - frame.anchor[1] * scale,
    CELL * scale,
    CELL * scale,
  );
  const result = { canvas, anchorX: 146, anchorY: 286, pixelRatio: 2 };
  prepared.set(natureType, result);
  return result;
}
