import { useI18n } from '../i18n/I18n.tsx';
import { useEffect, useRef, useState } from 'react';
import { AGE_NAMES, CIVS, type CivId } from '../game/data.ts';
import { renderArt } from '../render/art.ts';
import { loadBuildingAtlas } from '../render/atlas.ts';
import { loadSecondaryBuildings } from '../render/buildings.ts';
import { loadNatureAtlas } from '../render/nature.ts';
import { loadSceneryAtlas } from '../render/scenery.ts';
import { loadUnitAtlases } from '../render/units.ts';
import { loadGroundAtlas, paintGround } from '../render/ground.ts';
import { empirePreviewLayout } from './empire-preview-layout.ts';
import { PreviewSceneCache } from './preview-scene-cache.ts';
import { previewSceneFit } from './preview-scene-fit.ts';

const scenes = new PreviewSceneCache<HTMLCanvasElement>(48 * 1024 * 1024);
const civIds = Object.keys(CIVS) as CivId[];

function prepareScene(civ: CivId, age: number, width: number, signal: AbortSignal) {
  const height = Math.round(width * 0.54);
  return scenes.load(`${civ}:${age}:${width}`, width * height * 4, signal, async () => {
    const loaded = await Promise.all([
      loadBuildingAtlas(),
      loadSecondaryBuildings(),
      loadNatureAtlas(),
      loadSceneryAtlas(),
      loadGroundAtlas(),
      loadUnitAtlases([civ]),
    ]);
    signal.throwIfAborted();
    if (!loaded.every(Boolean)) throw new Error('Preview assets unavailable');
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
    const models = empirePreviewLayout(civ, age).map((model) => {
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
  });
}

/** Keep the last complete Retina scene visible until the next one is ready to crossfade. */
export function EmpirePreview({ civ, age }: { civ: CivId; age: number }) {
  const { t } = useI18n();
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previousRef = useRef<HTMLCanvasElement>(null);
  const displayedRef = useRef<HTMLCanvasElement | null>(null);
  const [shown, setShown] = useState<{ civ: CivId; age: number } | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const frame = frameRef.current!;
    const canvas = canvasRef.current!;
    const previous = previousRef.current!;
    let controller: AbortController | undefined;
    let warmup: ReturnType<typeof setTimeout> | undefined;
    let physicalWidth = 0;
    let fading: Animation | undefined;

    const draw = () => {
      const bounds = frame.getBoundingClientRect();
      const width = Math.round(
        Math.min(bounds.width, bounds.height / 0.54) * Math.min(devicePixelRatio || 1, 3),
      );
      if (!width || width === physicalWidth) return;
      physicalWidth = width;
      controller?.abort();
      clearTimeout(warmup);
      controller = new AbortController();
      const signal = controller.signal;
      void Promise.resolve().then(() => {
        if (!signal.aborted) setStatus('loading');
      });
      void prepareScene(civ, age, width, signal).then(
        (scene) => {
          if (signal.aborted) return;
          fading?.cancel();
          const last = displayedRef.current;
          previous.width = scene.width;
          previous.height = scene.height;
          if (last) previous.getContext('2d')!.drawImage(last, 0, 0, scene.width, scene.height);
          canvas.width = scene.width;
          canvas.height = scene.height;
          canvas.getContext('2d')!.drawImage(scene, 0, 0);
          displayedRef.current = scene;
          if (last && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
            fading = canvas.animate([{ opacity: 0 }, { opacity: 1 }], {
              duration: 220,
              easing: 'ease-out',
            });
          }
          setShown({ civ, age });
          setStatus('ready');
          // Warm one civilization at a time after painting. A new selection cancels queued work.
          warmup = setTimeout(() => {
            void (async () => {
              for (const id of civIds) {
                if (signal.aborted) return;
                if (id !== civ) await prepareScene(id, age, width, signal);
              }
            })().catch(() => {});
          }, 350);
        },
        () => {
          if (!signal.aborted) setStatus('error');
        },
      );
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(frame);
    return () => {
      controller?.abort();
      clearTimeout(warmup);
      observer.disconnect();
      fading?.cancel();
    };
  }, [civ, age]);

  return (
    <div ref={frameRef} className="lobby-art" aria-busy={status === 'loading'}>
      <canvas ref={previousRef} aria-hidden="true" className="lobby-art-previous" />
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={
          shown
            ? t(
                `Toàn cảnh quân và kiến trúc ${CIVS[shown.civ].name}, đời ${shown.age}: ${AGE_NAMES[shown.age - 1]}`,
              )
            : t('Toàn cảnh quân và kiến trúc')
        }
      />
      {!shown && status !== 'ready' && (
        <span className="lobby-preview-status" role="status">
          {status === 'loading'
            ? t('Đang chuẩn bị toàn cảnh…')
            : t('Chưa tải được hình ảnh. Hãy thử chọn lại nền văn minh.')}
        </span>
      )}
      {shown && status !== 'ready' && (
        <span className="lobby-preview-note" role="status">
          {status === 'loading'
            ? t(`Đang chuẩn bị ${CIVS[civ].name}…`)
            : t('Chưa tải được cảnh mới. Hãy thử chọn lại.')}
        </span>
      )}
      <span className="lobby-art-label">{t('QUÂN & KIẾN TRÚC TRONG GAME')}</span>
      <span className="lobby-art-era">
        <b>{['I', 'II', 'III'][(shown?.age ?? age) - 1]}</b>
        {t(AGE_NAMES[(shown?.age ?? age) - 1])}
      </span>
    </div>
  );
}
