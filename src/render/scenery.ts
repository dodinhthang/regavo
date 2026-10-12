import type { ArtSprite } from './art.ts';
import { assetUrl } from './asset-url.ts';
import { renderBarrier } from './barrier-raster.ts';
import { WOOD_BARRIER_SOCKETS } from './barrier-sources.ts';
import { isolatedFrame } from './isolated-frame.ts';

/** Original image_gen scenery, sampled from the unchanged source PNG. */
type SceneryFrame = {
  type: string;
  sourceRect: [number, number, number, number];
  sourceGroundAnchor: [number, number];
  displayScale: number;
  canvasWidth: number;
  canvasHeight: number;
  anchorX: number;
  anchorY: number;
};
type SceneryManifest = {
  pixelDimensions: { width: number; height: number };
  frames: SceneryFrame[];
};
const TYPES = new Set([
  'cypress',
  'bamboo',
  'shrub',
  'oak',
  'cliff',
  'woodwall',
  'woodgate',
  'grass',
]);
const geometry = new Map<string, SceneryFrame>();
const prepared = new Map<string, ArtSprite>();
let atlas: HTMLImageElement | undefined;
let pending: Promise<boolean> | undefined;

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load Regavo scenery atlas.'));
    image.src = assetUrl(source);
  });
}

function validFrame(frame: SceneryFrame, width: number, height: number): boolean {
  if (
    !frame ||
    !TYPES.has(frame.type) ||
    !Array.isArray(frame.sourceRect) ||
    frame.sourceRect.length !== 4 ||
    !Array.isArray(frame.sourceGroundAnchor) ||
    frame.sourceGroundAnchor.length !== 2
  )
    return false;
  const [x, y, w, h] = frame.sourceRect;
  const fence = frame.type === 'woodwall' || frame.type === 'woodgate';
  return (
    [
      ...frame.sourceRect,
      ...frame.sourceGroundAnchor,
      frame.displayScale,
      frame.anchorX,
      frame.anchorY,
    ].every(Number.isFinite) &&
    x >= 0 &&
    y >= 0 &&
    w > 0 &&
    h > 0 &&
    x + w <= width &&
    y + h <= height &&
    frame.displayScale > 0 &&
    frame.displayScale <= 2 &&
    frame.canvasWidth === (fence ? 180 : 146) &&
    frame.canvasHeight === (fence ? 210 : 166) &&
    frame.anchorX === (fence ? 90 : 73) &&
    frame.anchorY === (fence ? 149 : 143)
  );
}

/** Load measured frame geometry and PNG once; return false for safe art fallback. */
export function loadSceneryAtlas(): Promise<boolean> {
  if (atlas) return Promise.resolve(true);
  if (pending) return pending;
  if (typeof Image === 'undefined' || typeof fetch === 'undefined') return Promise.resolve(false);
  const base = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  pending = Promise.all([
    fetch(assetUrl(`${base}art/scenery-v3.manifest.json`)).then(async (response) => {
      if (!response.ok) throw new Error('Unable to load scenery source geometry.');
      return (await response.json()) as SceneryManifest;
    }),
    loadImage(`${base}art/scenery-v3.png`),
  ])
    .then(([manifest, image]) => {
      const width = image.naturalWidth,
        height = image.naturalHeight;
      if (
        manifest.pixelDimensions?.width !== width ||
        manifest.pixelDimensions?.height !== height ||
        !Array.isArray(manifest.frames) ||
        manifest.frames.length !== TYPES.size ||
        !manifest.frames.every((frame) => validFrame(frame, width, height))
      )
        return false;
      const unique = new Map(manifest.frames.map((frame) => [frame.type, frame]));
      if (unique.size !== TYPES.size) return false;
      for (const [type, frame] of unique) geometry.set(type, frame);
      atlas = image;
      return true;
    })
    .catch(() => false);
  return pending;
}

/** Return a cached miniature with its world ground pivot; unknown types fall back. */
export function renderScenery(type: string, direction = 2): ArtSprite | undefined {
  if (!atlas || !TYPES.has(type)) return undefined;
  const sockets = WOOD_BARRIER_SOCKETS[type],
    axis = direction % 4 === 0 ? 'x' : 'y',
    key = sockets ? `${type}:${axis}` : type;
  const cached = prepared.get(key);
  if (cached) return cached;
  const frame = geometry.get(type);
  if (!frame) return undefined;
  if (sockets) {
    const sprite = renderBarrier(isolatedFrame(atlas, frame.sourceRect), sockets, 1, true, axis);
    prepared.set(key, sprite);
    return sprite;
  }
  const canvas = document.createElement('canvas');
  canvas.width = frame.canvasWidth * 2;
  canvas.height = frame.canvasHeight * 2;
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  context.scale(2, 2);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  const [x, y, width, height] = frame.sourceRect;
  const [groundX, groundY] = frame.sourceGroundAnchor;
  const scale = frame.displayScale;
  context.drawImage(
    atlas,
    x,
    y,
    width,
    height,
    frame.anchorX - (groundX - x) * scale,
    frame.anchorY - (groundY - y) * scale,
    width * scale,
    height * scale,
  );
  const sprite = { canvas, anchorX: frame.anchorX * 2, anchorY: frame.anchorY * 2, pixelRatio: 2 };
  prepared.set(key, sprite);
  return sprite;
}
