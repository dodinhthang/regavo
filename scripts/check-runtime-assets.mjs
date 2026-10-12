import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import decodePng, { init as initPng } from '@jsquash/png/decode.js';
import decodeWebp, { init as initWebp } from '@jsquash/webp/decode.js';

const hash = (data) => createHash('sha256').update(data).digest('hex');
const manifest = JSON.parse(await readFile('dist/asset-manifest.json', 'utf8'));
await initPng(
  await readFile(fileURLToPath(import.meta.resolve('@jsquash/png/codec/pkg/squoosh_png_bg.wasm'))),
);
initWebp({
  wasmBinary: await readFile(
    fileURLToPath(import.meta.resolve('@jsquash/webp/codec/dec/webp_dec.wasm')),
  ),
});

for (const image of manifest.images) {
  const source = image.source.startsWith('/art/')
    ? 'public' + image.source
    : 'src/assets/battlefield.png';
  const input = await readFile(source);
  const output = await readFile('dist' + image.file);
  assert.equal(hash(input), image.sourceSha256, source);
  assert.equal(hash(output), image.sha256, image.file);
  assert.equal(output.length, image.bytes, image.file);
  assert.ok(output.length < 25 * 1048576, image.file + ' exceeds Cloudflare asset limit');
  const before = await decodePng(input);
  const after = await decodeWebp(output);
  assert.deepEqual([after.width, after.height], [before.width, before.height], source);
  assert.ok(Buffer.from(before.data).equals(Buffer.from(after.data)), source + ' RGBA changed');
}
for (const geometry of manifest.geometry) {
  const output = await readFile('dist' + geometry.file);
  assert.equal(hash(output), geometry.sha256, geometry.file);
  assert.ok(output.equals(await readFile('public' + geometry.source)), geometry.source);
}
const art = await readdir('dist/art');
assert.equal(art.length, manifest.images.length - 1 + manifest.geometry.length);
assert.ok(
  art.every((file) => !file.endsWith('.png')),
  'source PNGs must stay outside deployment',
);
assert.ok(manifest.outputBytes < manifest.originalBytes);
console.log(
  `Verified ${manifest.images.length} pixel-identical runtime images and ${manifest.geometry.length} source geometry manifests.`,
);
