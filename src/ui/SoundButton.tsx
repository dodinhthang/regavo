import { useI18n } from '../i18n/I18n.tsx';
import { useEffect, useState } from 'react';
import { sound } from '../audio/sound.ts';
export function SoundButton() {
  const { t } = useI18n();
  const [, update] = useState(0);
  useEffect(() => sound.subscribe(() => update((v) => v + 1)), []);
  return (
    <button
      className="sound-button"
      onClick={() => sound.toggle()}
      aria-label={sound.muted ? t('Bật âm thanh') : t('Tắt âm thanh')}
      title={sound.muted ? t('Bật âm thanh') : t('Tắt âm thanh')}
      aria-pressed={!sound.muted}
    >
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M3 9h4l5-4v14l-5-4H3z" />
        {sound.muted ? (
          <path d="m16 9 6 6m0-6-6 6" />
        ) : (
          <>
            <path d="M16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14" />
          </>
        )}
      </svg>
    </button>
  );
}
export function VolumeControl() {
  const { t } = useI18n();
  const [, update] = useState(0);
  useEffect(() => sound.subscribe(() => update((v) => v + 1)), []);
  return (
    <label className="volume-control">
      {t('Âm lượng')} <SoundButton />
      <input
        aria-label={t('Âm lượng')}
        type="range"
        min="0"
        max="1"
        step=".05"
        value={sound.volume}
        onChange={(e) => sound.setVolume(Number(e.target.value))}
      />
    </label>
  );
}
