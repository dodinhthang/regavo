import type { CivId } from '../game/data.ts';

declare const __LOBBY_PREVIEWS__: Record<string, string>;

/** Production scenes are rendered from the same match models during the build. */
export function lobbyPreviewUrl(civ: CivId, age: number, width: number): string | undefined {
  if (typeof __LOBBY_PREVIEWS__ === 'undefined') return undefined;
  const url = __LOBBY_PREVIEWS__[`${civ}:${age}:${width <= 960 ? 960 : 1920}`];
  if (!url) throw new Error(`Missing lobby preview: ${civ} ${age}`);
  return url;
}

/** Warm only the selection the user points at; avoid downloading all 18 scenes. */
export function prefetchLobbyPreview(civ: CivId, age: number) {
  const frame = document.querySelector('.lobby-art');
  if (!frame) return;
  const url = lobbyPreviewUrl(civ, age, frame.clientWidth * (devicePixelRatio || 1));
  if (!url) return;
  const image = new Image();
  image.decoding = 'async';
  image.fetchPriority = 'low';
  image.src = url;
}

export async function loadLobbyPreview(
  civ: CivId,
  age: number,
  width: number,
  signal: AbortSignal,
): Promise<HTMLCanvasElement> {
  signal.throwIfAborted();
  const url = lobbyPreviewUrl(civ, age, width)!;
  const image = new Image();
  image.decoding = 'async';
  image.fetchPriority = 'high';
  await new Promise<void>((resolve, reject) => {
    const clean = () => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      image.onload = image.onerror = null;
    };
    const fail = (reason: unknown) => {
      clean();
      image.src = '';
      reject(reason);
    };
    const abort = () => fail(signal.reason);
    const timeout = setTimeout(() => fail(new Error('Preview load timed out')), 15_000);
    signal.addEventListener('abort', abort, { once: true });
    image.onload = () => {
      clean();
      resolve();
    };
    image.onerror = () => fail(new Error(`Preview unavailable: ${url}`));
    image.src = url;
  });
  signal.throwIfAborted();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.round(width * 0.54);
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}
