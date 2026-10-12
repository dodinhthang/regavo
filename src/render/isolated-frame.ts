/** Selects complete isolated actors, dropping tiny disconnected fragments from adjacent atlas rows. */
export function isolatedFrame(
  image: HTMLImageElement,
  frame: readonly number[],
  largestOnly = false,
): HTMLCanvasElement {
  const [sx, sy, width, height] = frame;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  context.imageSmoothingEnabled = false;
  context.drawImage(image, sx, sy, width, height, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height),
    rgba = pixels.data;
  const count = width * height,
    labels = new Int32Array(count),
    queue = new Int32Array(count);
  const components: number[][] = [];
  let largest = 0;
  for (let start = 0; start < count; start++) {
    if (labels[start] || rgba[start * 4 + 3] < 8) continue;
    const id = components.length + 1,
      component: number[] = [];
    let head = 0,
      tail = 0;
    queue[tail++] = start;
    labels[start] = id;
    while (head < tail) {
      const pixel = queue[head++];
      component.push(pixel);
      const x = pixel % width,
        y = Math.floor(pixel / width);
      for (const next of [
        x > 0 ? pixel - 1 : -1,
        x + 1 < width ? pixel + 1 : -1,
        y > 0 ? pixel - width : -1,
        y + 1 < height ? pixel + width : -1,
      ]) {
        if (next < 0 || labels[next] || rgba[next * 4 + 3] < 8) continue;
        labels[next] = id;
        queue[tail++] = next;
      }
    }
    largest = Math.max(largest, component.length);
    components.push(component);
  }
  const major = new Uint8Array(count),
    keep = new Uint8Array(count),
    threshold = largestOnly ? largest : Math.max(24, largest * 0.04);
  for (const component of components)
    if (component.length >= threshold) for (const pixel of component) major[pixel] = 1;
  // Retain small adjacent details (hair, weapon tips) while excluding distant neighboring feet/hooves.
  for (let pixel = 0; pixel < count; pixel++)
    if (major[pixel]) {
      const x = pixel % width,
        y = Math.floor(pixel / width);
      for (let yy = Math.max(0, y - 3); yy <= Math.min(height - 1, y + 3); yy++)
        for (let xx = Math.max(0, x - 3); xx <= Math.min(width - 1, x + 3); xx++)
          keep[yy * width + xx] = 1;
    }
  for (const component of components)
    if (component.length >= threshold || (!largestOnly && component.some((pixel) => keep[pixel]))) {
      for (const pixel of component) {
        const x = pixel % width,
          y = Math.floor(pixel / width);
        for (let yy = Math.max(0, y - 2); yy <= Math.min(height - 1, y + 2); yy++)
          for (let xx = Math.max(0, x - 2); xx <= Math.min(width - 1, x + 2); xx++)
            keep[yy * width + xx] = 1;
      }
    }
  for (let pixel = 0; pixel < count; pixel++) if (!keep[pixel]) rgba[pixel * 4 + 3] = 0;
  context.putImageData(pixels, 0, 0);
  return canvas;
}
