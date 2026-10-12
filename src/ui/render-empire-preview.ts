import type { CivId } from '../game/data.ts';
import { renderUnitAtlas } from '../render/units.ts';
import { renderArt } from '../render/art.ts';
import { loadBuildingAtlas } from '../render/atlas.ts';
import { loadSecondaryBuildings } from '../render/buildings.ts';
import { loadNatureAtlas } from '../render/nature.ts';
import { loadSceneryAtlas } from '../render/scenery.ts';
import { loadUnitAtlases } from '../render/units.ts';
import { loadGroundAtlas, paintGround } from '../render/ground.ts';
import { empirePreviewLayout } from './empire-preview-layout.ts';
import { previewSceneFit } from './preview-scene-fit.ts';
import { sharedAtlasColumn } from '../render/civilization-art-data.ts';

export async function renderEmpirePreview(
  civ: CivId,
  age: number,
  width: number,
  signal: AbortSignal,
) {
  const height = Math.round(width * 0.54);
  const layout = empirePreviewLayout(civ, age);
  const loaded = await Promise.all([
    loadBuildingAtlas([civ], [age]),
    loadSecondaryBuildings(
      sharedAtlasColumn(civ) >= 0
        ? layout.filter((model) => model.kind === 'building').map((model) => model.type)
        : [],
      age,
    ),
    loadNatureAtlas(),
    loadSceneryAtlas(),
    loadGroundAtlas(),
    loadUnitAtlases([civ], 'preview'),
  ]);
  signal.throwIfAborted();
  if (!loaded.every(Boolean))
    throw new Error(`Preview assets unavailable for ${civ}: ${loaded.join(', ')}`);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const scale = width / 1000;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#182b20';
  ctx.fillRect(0, 0, 1000, 540);
  const models = layout.map((model) => {
    if (model.kind === 'unit' && !renderUnitAtlas(model.type, civ, age, 0, 0, model.dir ?? 1))
      throw new Error(`Missing authored preview unit: ${civ} ${age} ${model.type}`);
    const art = renderArt(model.kind, model.type, civ, age, 0, 0, model.dir ?? 1);
    const dpr = art.pixelRatio ?? 1;
    const modelScale = model.scale ?? 1;
    const modelWidth = (art.canvas.width / dpr) * modelScale;
    const modelHeight = (art.canvas.height / dpr) * modelScale;
    const left = 500 + (model.x - model.y) * 32 - (art.anchorX / dpr) * modelScale;
    const top = 260 + (model.x + model.y) * 16 - (art.anchorY / dpr) * modelScale;
    return {
      art,
      modelWidth,
      modelHeight,
      left,
      top,
      right: left + modelWidth,
      bottom: top + modelHeight,
    };
  });
  const fit = previewSceneFit(models);
  ctx.save();
  ctx.translate(fit.x, fit.y);
  ctx.scale(fit.zoom, fit.zoom);
  const ground = paintGround(Array<number>(16 * 16).fill(0), 4271, 16, [{ x: 8, y: 6 }])!;
  ctx.drawImage(ground, -44, -20);
  for (const { art, modelWidth, modelHeight, left, top } of models) {
    ctx.drawImage(art.canvas, left, top, modelWidth, modelHeight);
  }
  ctx.restore();
  const shade = ctx.createLinearGradient(0, 400, 0, 540);
  shade.addColorStop(0, 'rgba(16,30,22,0)');
  shade.addColorStop(1, 'rgba(16,30,22,.72)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 400, 1000, 140);
  return canvas;
}
