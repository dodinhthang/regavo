import { defineConfig } from 'vite';
import { dirname, relative } from 'node:path';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { CIVILIZATION_ART } from './src/render/civilization-art-data.ts';
import { prepareRuntimeAssets } from './scripts/runtime-assets.mjs';

export default defineConfig(async ({ command }) => {
  if (command !== 'build') return {};
  const assets = await prepareRuntimeAssets(process.cwd(), CIVILIZATION_ART);
  return {
    publicDir: assets.publicDir,
    define: { __RUNTIME_ASSETS__: JSON.stringify(assets.urls) },
    plugins: [
      {
        name: 'runtime-artwork',
        enforce: 'pre',
        transform(code, id) {
          if (!id.endsWith('.css') || !code.includes('../assets/battlefield.png')) return;
          return {
            code: code.replaceAll(
              '../assets/battlefield.png',
              relative(dirname(id), assets.background).split('\\').join('/'),
            ),
            map: null,
          };
        },
        async closeBundle() {
          const manifestPath = 'dist/asset-manifest.json';
          const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
          const background = (await readdir('dist/assets')).find(
            (file) => file.startsWith('battlefield-') && file.endsWith('.webp'),
          );
          if (!background) throw new Error('Optimized UI background was not emitted.');
          manifest.images.at(-1).file = '/assets/' + background;
          await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
        },
      },
    ],
  };
});
