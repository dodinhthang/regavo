import type { ArtSprite } from './art.ts';

/** Original image_gen cutouts; source PNG is sampled without offline edits. */
type WildlifeFrame = {
  type: string;
  column: number;
  alive: boolean;
  sourceRect: [number, number, number, number];
  sourceGroundAnchor: [number, number];
  displayScale: number;
};
type WildlifeManifest = {
  pixelDimensions: { width: number; height: number };
  frames: WildlifeFrame[];
};
type Action = 'idle' | 'walk' | 'graze' | 'alert' | 'dead';
type Raster = {
  pixels: Float32Array;
  width: number;
  height: number;
  x: number;
  y: number;
  artX: number;
  artY: number;
  artWidth: number;
  artHeight: number;
};
type Pose = { turn: number; breath: number };
const PIXEL_RATIO = 4;
const OUTPUT_WIDTH = 120 * PIXEL_RATIO,
  OUTPUT_HEIGHT = 106 * PIXEL_RATIO;
const GROUND_X = 60 * PIXEL_RATIO,
  GROUND_Y = 84 * PIXEL_RATIO;
const SPECIES = new Set(['deer', 'boar', 'gazelle', 'argali', 'goat', 'fallow', 'sika']);
// Logical pixels at zoom 1, including antlers. All headings and the lying pose
// use one scale per species. The original source PNG/manifest remain unchanged.
const HEIGHTS: Record<string, number> = {
  deer: 38,
  fallow: 36,
  sika: 33,
  goat: 31,
  gazelle: 30,
  argali: 32,
  boar: 28,
};
const DIRECTION_COLUMNS = [0, 0, 0, 1, 1, 3, 3, 2] as const;
const prepared = new Map<string, ArtSprite>();
const geometry = new Map<string, WildlifeFrame>();
const scales = new Map<string, number>();
const walkGeometry = new Map<string, WildlifeFrame>();
const walkScales = new Map<string, number>();
const rasters = new Map<string, Raster>();
let atlas: HTMLImageElement | undefined;
let walkAtlas: HTMLImageElement | undefined;
let pending: Promise<boolean> | undefined;

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load Regavo wildlife atlas.'));
    image.src = source;
  });
}

function validFrame(frame: WildlifeFrame, width: number, height: number): boolean {
  if (
    !frame ||
    !SPECIES.has(frame.type) ||
    !Number.isInteger(frame.column) ||
    frame.column < 0 ||
    frame.column > 4
  )
    return false;
  if (
    frame.alive !== frame.column < 4 ||
    !Array.isArray(frame.sourceRect) ||
    frame.sourceRect.length !== 4 ||
    !Array.isArray(frame.sourceGroundAnchor) ||
    frame.sourceGroundAnchor.length !== 2
  )
    return false;
  const [x, y, w, h] = frame.sourceRect;
  return (
    [...frame.sourceRect, ...frame.sourceGroundAnchor, frame.displayScale].every(Number.isFinite) &&
    x >= 0 &&
    y >= 0 &&
    w > 0 &&
    h > 0 &&
    x + w <= width &&
    y + h <= height &&
    frame.displayScale > 0 &&
    frame.displayScale <= 2
  );
}

/** Load the unchanged original PNG and its measured per-heading bounds. */
export function loadWildlifeAtlas(): Promise<boolean> {
  if (atlas) return Promise.resolve(true);
  if (pending) return pending;
  if (typeof Image === 'undefined' || typeof fetch === 'undefined') return Promise.resolve(false);
  const base = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  pending = Promise.all([
    fetch(`${base}art/wildlife-v3.manifest.json`).then(async (response) => {
      if (!response.ok) throw new Error('Unable to load wildlife source geometry.');
      return (await response.json()) as WildlifeManifest;
    }),
    loadImage(`${base}art/wildlife-v3.png`),
    Promise.all([
      fetch(`${base}art/wildlife-walk-b.manifest.json`).then(async (response) => {
        if (!response.ok) throw new Error('Walking contact B is unavailable.');
        return (await response.json()) as WildlifeManifest;
      }),
      loadImage(`${base}art/wildlife-walk-b.png`),
    ]).catch(() => undefined),
  ])
    .then(([manifest, image, walking]) => {
      const width = image.naturalWidth,
        height = image.naturalHeight;
      if (
        manifest.pixelDimensions?.width !== width ||
        manifest.pixelDimensions?.height !== height ||
        !Array.isArray(manifest.frames) ||
        manifest.frames.length !== 35 ||
        !manifest.frames.every((frame) => validFrame(frame, width, height))
      )
        return false;
      const unique = new Map(
        manifest.frames.map((frame) => [`${frame.type}|${frame.column}`, frame]),
      );
      if (unique.size !== 35) return false;
      for (const [key, frame] of unique) geometry.set(key, frame);
      for (const type of SPECIES) {
        const tallest = Math.max(
          ...manifest.frames
            .filter((f) => f.type === type && f.alive)
            .map((f) => f.sourceRect[3] - 4),
        );
        scales.set(type, HEIGHTS[type] / tallest);
      }
      if (walking) {
        const [walkManifest, walkImage] = walking;
        const w = walkImage.naturalWidth,
          h = walkImage.naturalHeight;
        const frames = walkManifest.frames;
        if (
          walkManifest.pixelDimensions?.width === w &&
          walkManifest.pixelDimensions?.height === h &&
          Array.isArray(frames) &&
          frames.length === 28 &&
          frames.every((f) => f.alive && validFrame(f, w, h))
        ) {
          const uniqueWalking = new Map(frames.map((f) => [`${f.type}|${f.column}`, f]));
          if (uniqueWalking.size === 28) {
            for (const [key, frame] of uniqueWalking) walkGeometry.set(key, frame);
            for (const type of SPECIES) {
              const tallest = Math.max(
                ...frames.filter((f) => f.type === type).map((f) => f.sourceRect[3] - 4),
              );
              walkScales.set(type, HEIGHTS[type] / tallest);
            }
            walkAtlas = walkImage;
          }
        }
      }
      atlas = image;
      return true;
    })
    .catch(() => false);
  return pending;
}

function surface(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function actionFor(value: string, alive: boolean): Action {
  if (!alive) return 'dead';
  if (['move', 'walk', 'walking', 'flee', 'run'].includes(value)) return 'walk';
  if (['gather', 'graze', 'grazing', 'eat'].includes(value)) return 'graze';
  if (['attack', 'alert', 'hunt'].includes(value)) return 'alert';
  return 'idle';
}

function smooth(from: number, to: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/** Prefilter the entire original animal at its final 4× scale before warping.
 * Every RGBA pixel remains part of one raster: no masks, extracted limbs, head
 * layers, missing shoulder pixels, or overlap patches. Premultiplication avoids
 * colored fringes when bilinear samples cross a transparent fur/antler edge. */
function rasterFor(source: WildlifeFrame, scale: number): Raster | undefined {
  const key = `${source.type}|${source.column}`;
  const cached = rasters.get(key);
  if (cached) return cached;
  if (!atlas) return undefined;
  const [sx, sy, sw, sh] = source.sourceRect;
  const artX = GROUND_X - (source.sourceGroundAnchor[0] - sx) * scale;
  const artY = GROUND_Y - (source.sourceGroundAnchor[1] - sy) * scale;
  const artWidth = sw * scale,
    artHeight = sh * scale;
  const canvas = surface(OUTPUT_WIDTH, OUTPUT_HEIGHT),
    context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return undefined;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(atlas, sx, sy, sw, sh, artX, artY, artWidth, artHeight);
  const x = Math.max(0, Math.floor(artX) - 2),
    y = Math.max(0, Math.floor(artY) - 2);
  const width = Math.min(OUTPUT_WIDTH - x, Math.ceil(artX + artWidth) + 2 - x);
  const height = Math.min(OUTPUT_HEIGHT - y, Math.ceil(artY + artHeight) + 2 - y);
  const raw = context.getImageData(x, y, width, height).data,
    pixels = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i += 4) {
    const alpha = raw[i + 3] / 255;
    pixels[i] = raw[i] * alpha;
    pixels[i + 1] = raw[i + 1] * alpha;
    pixels[i + 2] = raw[i + 2] * alpha;
    pixels[i + 3] = raw[i + 3];
  }
  const raster = { pixels, width, height, x, y, artX, artY, artWidth, artHeight };
  rasters.set(key, raster);
  return raster;
}

function poseFor(action: Action, phase: number, boar: boolean): Pose {
  return {
    turn:
      action === 'graze'
        ? (boar ? [0.08, 0.13, 0.17, 0.13] : [0.2, 0.28, 0.34, 0.28])[phase]
        : action === 'alert'
          ? [-0.03, -0.06, -0.085, -0.06][phase]
          : 0,
    breath: action === 'idle' ? [0, 0.004, 0, -0.004][phase] : 0,
  };
}

/** A smooth velocity field over the whole silhouette. Upper pixels gently bend
 * toward the feeding direction. Gradual spatial weights keep neck, torso,
 * legs and antlers connected;
 * amplitudes deliberately stay small instead of forcing a detached head pose. */
function velocity(
  x: number,
  y: number,
  raster: Raster,
  pose: Pose,
  left: boolean,
  longHorns: boolean,
  out: [number, number],
) {
  const nx = (x - raster.artX) / raster.artWidth,
    ny = (y - raster.artY) / raster.artHeight;
  const u = left ? 1 - nx : nx,
    sign = left ? -1 : 1;
  const head =
    Math.max(smooth(0.18, 0.64, u), longHorns ? 1 - smooth(0.22, 0.34, ny) : 0) *
    (1 - smooth(0.54, 0.82, ny));
  const pivotX = raster.artX + (left ? 0.46 : 0.54) * raster.artWidth,
    pivotY = raster.artY + 0.63 * raster.artHeight;
  const dx = -pose.turn * (y - pivotY) * head * sign;
  let dy = pose.turn * (x - pivotX) * head * sign;
  dy += pose.breath * (y - GROUND_Y) * (1 - smooth(0.58, 0.98, ny));
  out[0] = dx;
  out[1] = dy;
}

function drawContinuous(
  context: CanvasRenderingContext2D,
  raster: Raster,
  source: WildlifeFrame,
  phase: number,
  action: Action,
) {
  const pose = poseFor(action, phase, source.type === 'boar');
  const left = source.column === 1 || source.column === 3;
  const longHorns = ['deer', 'fallow', 'sika', 'goat'].includes(source.type);
  const output = context.createImageData(OUTPUT_WIDTH, OUTPUT_HEIGHT),
    pixels = output.data,
    velocityAt: [number, number] = [0, 0];
  const margin = Math.ceil(raster.artHeight * 0.3) + 4;
  const startX = Math.max(0, Math.floor(raster.artX) - margin),
    endX = Math.min(OUTPUT_WIDTH, Math.ceil(raster.artX + raster.artWidth) + margin);
  const startY = Math.max(0, Math.floor(raster.artY) - margin),
    endY = Math.min(OUTPUT_HEIGHT, Math.ceil(raster.artY + raster.artHeight) + margin);
  for (let y = startY; y < endY; y++)
    for (let x = startX; x < endX; x++) {
      let sx = x + 0.5,
        sy = y + 0.5;
      // Trace one continuous mapping backward. Midpoint integration keeps the
      // original silhouette closed; it never paints separate transformed pieces.
      for (let step = 0; step < 4; step++) {
        velocity(sx, sy, raster, pose, left, longHorns, velocityAt);
        const mx = sx - velocityAt[0] * 0.125,
          my = sy - velocityAt[1] * 0.125;
        velocity(mx, my, raster, pose, left, longHorns, velocityAt);
        sx -= velocityAt[0] * 0.25;
        sy -= velocityAt[1] * 0.25;
      }
      sx -= raster.x + 0.5;
      sy -= raster.y + 0.5;
      const ix = Math.floor(sx),
        iy = Math.floor(sy),
        tx = sx - ix,
        ty = sy - iy;
      let red = 0,
        green = 0,
        blue = 0,
        alpha = 0;
      for (let oy = 0; oy <= 1; oy++)
        for (let ox = 0; ox <= 1; ox++) {
          const px = ix + ox,
            py = iy + oy;
          if (px < 0 || py < 0 || px >= raster.width || py >= raster.height) continue;
          const weight = (ox ? tx : 1 - tx) * (oy ? ty : 1 - ty),
            i = (py * raster.width + px) * 4;
          red += raster.pixels[i] * weight;
          green += raster.pixels[i + 1] * weight;
          blue += raster.pixels[i + 2] * weight;
          alpha += raster.pixels[i + 3] * weight;
        }
      if (alpha < 0.5) continue;
      const i = (y * OUTPUT_WIDTH + x) * 4,
        unpremultiply = 255 / alpha;
      pixels[i] = red * unpremultiply;
      pixels[i + 1] = green * unpremultiply;
      pixels[i + 2] = blue * unpremultiply;
      pixels[i + 3] = alpha;
    }
  context.putImageData(output, 0, 0);
}

function cropSprite(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): ArtSprite {
  const data = context.getImageData(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT).data;
  let left = OUTPUT_WIDTH,
    top = OUTPUT_HEIGHT,
    right = -1,
    bottom = -1;
  for (let y = 0; y < OUTPUT_HEIGHT; y++)
    for (let x = 0; x < OUTPUT_WIDTH; x++) {
      if (data[(y * OUTPUT_WIDTH + x) * 4 + 3] <= 3) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  if (right < left)
    return { canvas, anchorX: GROUND_X, anchorY: GROUND_Y, pixelRatio: PIXEL_RATIO };
  const padding = 2 * PIXEL_RATIO;
  left = Math.max(0, left - padding);
  top = Math.max(0, top - padding);
  right = Math.min(OUTPUT_WIDTH - 1, right + padding);
  bottom = Math.min(OUTPUT_HEIGHT - 1, bottom + padding);
  const cropped = surface(right - left + 1, bottom - top + 1);
  // Integer pixel copy at 1:1. This only trims transparent runtime texture space.
  cropped
    .getContext('2d')!
    .putImageData(context.getImageData(left, top, cropped.width, cropped.height), 0, 0);
  return {
    canvas: cropped,
    anchorX: GROUND_X - left,
    anchorY: GROUND_Y - top,
    pixelRatio: PIXEL_RATIO,
  };
}

/** 4× whole silhouettes: walking alternates two native complete contact poses;
 * grazing gently bends one continuous raster. No independently cut/rotated
 * pieces. Four timing phases are not four authored gait drawings. Carcasses
 * remain the original still image. */
export function renderWildlife(
  type: string,
  frame: number,
  dir: number,
  alive = true,
  action = 'idle',
): ArtSprite | undefined {
  if (!atlas || !SPECIES.has(type)) return undefined;
  const direction = Number.isFinite(dir) ? ((Math.round(dir) % 8) + 8) % 8 : 0;
  const phase = alive && Number.isFinite(frame) ? ((Math.floor(frame) % 4) + 4) % 4 : 0;
  const column = alive ? DIRECTION_COLUMNS[direction] : 4;
  const mode = actionFor(action, alive);
  const contactB = alive && mode === 'walk' && phase >= 2 && !!walkAtlas;
  const timingFrame = mode === 'walk' && walkAtlas ? Number(contactB) : phase;
  const key = `${type}|${column}|${timingFrame}|${mode}`;
  const cached = prepared.get(key);
  if (cached) return cached;
  const source = (contactB ? walkGeometry : geometry).get(`${type}|${column}`);
  if (!source) return undefined;
  const sourceImage = contactB ? walkAtlas! : atlas;
  const canvas = surface(OUTPUT_WIDTH, OUTPUT_HEIGHT),
    context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return undefined;
  const scale =
    ((contactB ? walkScales : scales).get(type) ?? source.displayScale * 0.5) * PIXEL_RATIO;
  if (alive && mode !== 'walk') {
    const raster = rasterFor(source, scale);
    if (!raster) return undefined;
    drawContinuous(context, raster, source, phase, mode);
  } else {
    const [x, y, width, height] = source.sourceRect;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      sourceImage,
      x,
      y,
      width,
      height,
      GROUND_X - (source.sourceGroundAnchor[0] - x) * scale,
      GROUND_Y - (source.sourceGroundAnchor[1] - y) * scale,
      width * scale,
      height * scale,
    );
  }
  const sprite = cropSprite(canvas, context);
  sprite.canvas.dataset.wildlifeAction = mode;
  sprite.canvas.dataset.wildlifeDeformation =
    alive && mode !== 'walk' ? 'continuous-whole-raster' : 'none';
  sprite.canvas.dataset.wildlifeContact = mode === 'walk' ? (contactB ? 'B' : 'A') : 'none';
  prepared.set(key, sprite);
  return sprite;
}
