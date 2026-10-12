import { parentPort } from 'node:worker_threads';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import decodePng, { init as initPng } from '@jsquash/png/decode.js';
import encodeWebp, { init as initWebp } from '@jsquash/webp/encode.js';

await initPng(
  await readFile(fileURLToPath(import.meta.resolve('@jsquash/png/codec/pkg/squoosh_png_bg.wasm'))),
);
// Node supports SIMD on all supported deployment build architectures.
await initWebp({
  wasmBinary: await readFile(
    fileURLToPath(import.meta.resolve('@jsquash/webp/codec/enc/webp_enc_simd.wasm')),
  ),
});

parentPort.on('message', async ({ source, output }) => {
  try {
    const input = await readFile(source);
    const pixels = await decodePng(input);
    const data = Buffer.from(
      await encodeWebp(pixels, {
        lossless: 1,
        exact: 1,
        near_lossless: 100,
        method: 4,
        quality: 75,
      }),
    );
    await writeFile(output, data);
    parentPort.postMessage({
      bytes: data.length,
      sha256: createHash('sha256').update(data).digest('hex'),
      width: pixels.width,
      height: pixels.height,
      rgbaSha256: createHash('sha256').update(pixels.data).digest('hex'),
    });
  } catch (error) {
    parentPort.postMessage({ error: error.stack });
  }
});
