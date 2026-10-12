/** Shared golden dragon ornament, generated from the user's sculpture reference. */
export const DAI_VIET_DRAGON_FILE = '/art/daiviet-v4-dragon-emblem.png';
export const DAI_VIET_DRAGON_SIZE = 1254;
export const DAI_VIET_DRAGON_FRAME = [195, 33, 915, 1162] as const;

let dragon: HTMLImageElement | undefined;
let pending: Promise<boolean> | undefined;

export function loadDaiVietDragon() {
  if (dragon) return Promise.resolve(true);
  if (pending) return pending;
  pending = new Promise<boolean>((resolve) => {
    const image = new Image();
    image.onload = () => {
      const valid =
        image.naturalWidth === DAI_VIET_DRAGON_SIZE && image.naturalHeight === DAI_VIET_DRAGON_SIZE;
      if (valid) dragon = image;
      resolve(valid);
    };
    image.onerror = () => resolve(false);
    image.src = DAI_VIET_DRAGON_FILE;
  }).finally(() => {
    pending = undefined;
  });
  return pending;
}

export function drawDaiVietDragon(c: CanvasRenderingContext2D) {
  if (!dragon) return;
  const [x, y, width, height] = DAI_VIET_DRAGON_FRAME;
  const targetHeight = 26,
    targetWidth = (targetHeight * width) / height;
  c.drawImage(
    dragon,
    x,
    y,
    width,
    height,
    -targetWidth / 2,
    -targetHeight / 2,
    targetWidth,
    targetHeight,
  );
}
