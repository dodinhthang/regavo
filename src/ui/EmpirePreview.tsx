import { useI18n } from '../i18n/I18n.tsx';
import { useEffect, useRef, useState } from 'react';
import { AGE_NAMES, CIVS, type CivId } from '../game/data.ts';
import { PreviewSceneCache } from './preview-scene-cache.ts';
import { loadLobbyPreview, lobbyPreviewUrl } from './lobby-preview-art.ts';

const scenes = new PreviewSceneCache<HTMLCanvasElement>(48 * 1024 * 1024);

function prepareScene(civ: CivId, age: number, width: number, signal: AbortSignal) {
  return scenes.load(
    `${civ}:${age}:${width}`,
    width * Math.round(width * 0.54) * 4,
    signal,
    async () => {
      if (lobbyPreviewUrl(civ, age, width)) return loadLobbyPreview(civ, age, width, signal);
      const { renderEmpirePreview } = await import('./render-empire-preview.ts');
      return renderEmpirePreview(civ, age, width, signal);
    },
  );
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
    let physicalWidth = 0;
    let fading: Animation | undefined;

    const draw = () => {
      const bounds = frame.getBoundingClientRect();
      const width = Math.round(
        Math.min(
          1920,
          Math.min(bounds.width, bounds.height / 0.54) * Math.min(devicePixelRatio || 1, 3),
        ),
      );
      if (!width || width === physicalWidth) return;
      physicalWidth = width;
      controller?.abort();
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
      observer.disconnect();
      fading?.cancel();
    };
  }, [civ, age]);

  return (
    <div
      ref={frameRef}
      className="lobby-art"
      data-preview={lobbyPreviewUrl(civ, age, 1920) ? 'static' : 'rendered'}
      aria-busy={status === 'loading'}
    >
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
