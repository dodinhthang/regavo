export type PreviewBounds = { left: number; top: number; right: number; bottom: number };

/** Fit complete model canvases, including tall roofs and flags, into the preview. */
export function previewSceneFit(models: PreviewBounds[]) {
  const left = Math.min(0, ...models.map((m) => m.left));
  const top = Math.min(0, ...models.map((m) => m.top));
  const right = Math.max(1000, ...models.map((m) => m.right));
  const bottom = Math.max(540, ...models.map((m) => m.bottom));
  if (left === 0 && top === 0 && right === 1000 && bottom === 540) return { zoom: 1, x: 0, y: 0 };
  const zoom = Math.min(984 / (right - left), 524 / (bottom - top));
  return {
    zoom,
    x: (1000 - (right - left) * zoom) / 2 - left * zoom,
    y: (540 - (bottom - top) * zoom) / 2 - top * zoom,
  };
}
