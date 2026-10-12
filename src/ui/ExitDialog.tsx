import { useI18n } from '../i18n/I18n.tsx';
import { useEffect, useRef } from 'react';
import { AGE_NAMES, CIVS, type CivId } from '../game/data.ts';
import { Emblem } from './Icons.tsx';
import './exit-dialog.css';

export function ExitDialog({
  civ,
  age,
  time,
  busy,
  error,
  onStay,
  onSaveExit,
  onDiscard,
}: {
  civ: CivId;
  age: number;
  time: string;
  busy: boolean;
  error: string;
  onStay: () => void;
  onSaveExit: () => void;
  onDiscard: () => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const stay = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    stay.current?.focus();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="exit-dialog"
      aria-labelledby="exit-title"
      aria-describedby="exit-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onStay();
      }}
    >
      <div className="exit-crest">
        <Emblem civ={civ} age={age} size={76} />
      </div>
      <span className="exit-eyebrow">{t('CHIẾN TRƯỜNG ĐANG TẠM DỪNG')}</span>
      <h2 id="exit-title">{t('Rời chiến trường?')}</h2>
      <p id="exit-description">
        {t(
          'Đế chế của bạn vẫn đang chờ lệnh. Lưu trận đấu để tiếp tục cuộc chinh phạt vào lần sau.',
        )}
      </p>
      <div className="exit-match">
        <span>{t(CIVS[civ].name)}</span>
        <span>{t(AGE_NAMES[age - 1])}</span>
        <span>{time}</span>
      </div>
      {error && (
        <p className="exit-error" role="alert">
          {t(error)}
        </p>
      )}
      <div className="exit-actions">
        <button ref={stay} className="exit-stay" disabled={busy} onClick={onStay}>
          {t('Ở lại trận đấu')}
        </button>
        <button className="exit-save" disabled={busy} onClick={onSaveExit}>
          {busy ? t('Đang lưu…') : t('Lưu & thoát')}
          <span aria-hidden="true">↗</span>
        </button>
      </div>
      <button className="exit-discard" disabled={busy} onClick={onDiscard}>
        {t('Thoát không lưu')}
      </button>
      <small>{t('Esc để ở lại · Trận đấu tiếp tục từ vị trí hiện tại')}</small>
    </dialog>
  );
}
