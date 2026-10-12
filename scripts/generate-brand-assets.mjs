import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import decodePng, { init as initPngDecoder } from '@jsquash/png/decode.js';
import encodePng, { init as initPngEncoder } from '@jsquash/png/encode.js';
import encodeWebp, { init as initWebp } from '@jsquash/webp/encode.js';

const root = new URL('../', import.meta.url);
const source = 'assets/branding/game-logo-crown-citadel-v1.png';
const pngWasm = await readFile(
  fileURLToPath(import.meta.resolve('@jsquash/png/codec/pkg/squoosh_png_bg.wasm')),
);
await initPngDecoder(pngWasm);
await initPngEncoder(pngWasm);
await initWebp({
  wasmBinary: await readFile(
    fileURLToPath(import.meta.resolve('@jsquash/webp/codec/enc/webp_enc_simd.wasm')),
  ),
});
const input = await readFile(new URL(source, root));
const original = await decodePng(input);
assert.equal(original.width, original.height, 'The approved logo must have a square canvas.');
const background = [13, 27, 21];
const files = [];

// Area sampling in premultiplied alpha keeps the small gold edges free of dark halos.
function resize(size, scale = 1, opaque = false) {
  const data = new Uint8ClampedArray(size * size * 4);
  if (opaque) {
    for (let i = 0; i < data.length; i += 4) data.set([...background, 255], i);
  }
  const markSize = Math.round(size * scale);
  const inset = Math.floor((size - markSize) / 2);
  const ratio = original.width / markSize;
  for (let y = 0; y < markSize; y++) {
    for (let x = 0; x < markSize; x++) {
      const left = x * ratio;
      const top = y * ratio;
      const right = Math.min((x + 1) * ratio, original.width);
      const bottom = Math.min((y + 1) * ratio, original.height);
      const channels = [0, 0, 0];
      let alpha = 0;
      for (let sy = Math.floor(top); sy < Math.ceil(bottom); sy++) {
        const height = Math.min(bottom, sy + 1) - Math.max(top, sy);
        for (let sx = Math.floor(left); sx < Math.ceil(right); sx++) {
          const weight = height * (Math.min(right, sx + 1) - Math.max(left, sx));
          const offset = (sy * original.width + sx) * 4;
          const opacity = (original.data[offset + 3] / 255) * weight;
          alpha += opacity;
          for (let c = 0; c < 3; c++) channels[c] += original.data[offset + c] * opacity;
        }
      }
      const opacity = alpha / ((right - left) * (bottom - top));
      const offset = ((y + inset) * size + x + inset) * 4;
      for (let c = 0; c < 3; c++) {
        const color = alpha ? channels[c] / alpha : 0;
        data[offset + c] = opaque ? color * opacity + background[c] * (1 - opacity) : color;
      }
      data[offset + 3] = opaque ? 255 : opacity * 255;
    }
  }
  return { width: size, height: size, data };
}

async function save(path, data, size) {
  const url = new URL(path, root);
  await mkdir(new URL('./', url), { recursive: true });
  const bytes = Buffer.from(data);
  await writeFile(url, bytes);
  files.push({
    path,
    ...(size ? { width: size, height: size } : {}),
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}

const faviconFrames = [];
for (const size of [16, 32, 48, 64]) {
  const png = Buffer.from(await encodePng(resize(size)));
  faviconFrames.push({ size, png });
  if (size === 32 || size === 64) await save(`public/favicon-${size}.png`, png, size);
}
const directory = Buffer.alloc(6 + faviconFrames.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(faviconFrames.length, 4);
let offset = directory.length;
for (const [index, frame] of faviconFrames.entries()) {
  const entry = 6 + index * 16;
  directory[entry] = frame.size;
  directory[entry + 1] = frame.size;
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(frame.png.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += frame.png.length;
}
await save('public/favicon.ico', Buffer.concat([directory, ...faviconFrames.map((f) => f.png)]));
await save('public/apple-touch-icon.png', await encodePng(resize(180, 0.9, true)), 180);
for (const size of [192, 512]) {
  await save(`public/icons/icon-${size}.png`, await encodePng(resize(size, 0.9, true)), size);
}
await save('public/icons/icon-maskable-512.png', await encodePng(resize(512, 0.72, true)), 512);
await save(
  'src/assets/regavo-logo.webp',
  await encodeWebp(resize(256), { lossless: 1, exact: 1, near_lossless: 100, method: 4 }),
  256,
);
await writeFile(
  new URL('assets/branding/derived-assets.json', root),
  JSON.stringify(
    {
      source,
      sourceSha256: createHash('sha256').update(input).digest('hex'),
      generator: 'scripts/generate-brand-assets.mjs',
      method: 'Premultiplied-alpha area resampling of the approved original ImageGen logo.',
      files,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Generated ${files.length} Regavo branding assets from the approved logo.`);
