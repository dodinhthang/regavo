import { useI18n } from '../i18n/I18n.tsx';
import type { CivId } from '../game/data.ts';
import { Emblem } from './Icons.tsx';
import { SoundButton } from './SoundButton.tsx';
import { LanguageSelect } from './LanguageSelect.tsx';
import './brand.css';

export function BrandHeader({
  civ,
  age,
  page,
  onHome,
  onWorkshop,
}: {
  civ: CivId;
  age: number;
  page: 'home' | 'workshop';
  onHome?: () => void;
  onWorkshop?: () => void;
}) {
  const { t } = useI18n();
  const identity = (
    <>
      <Emblem civ={civ} age={age} size={50} />
      <span>
        REGAVO<small>CHRONICLES OF EMPIRES</small>
      </span>
    </>
  );
  return (
    <header className="site-header">
      {onHome ? (
        <button className="site-wordmark" onClick={onHome} aria-label={t('Về trang chủ')}>
          {identity}
        </button>
      ) : (
        <a className="site-wordmark" href="#" aria-label={t('Regavo · trang chủ')}>
          {identity}
        </a>
      )}
      <span className="site-edition">
        <i /> {t('CHIẾN THUẬT THỜI GIAN THỰC')}
      </span>
      <nav aria-label={t('Tiện ích')}>
        {page === 'workshop' ? (
          <>
            <button className="site-nav-button" onClick={onHome}>
              {t('← Trang chủ')}
            </button>
            <span className="site-current">{t('Xưởng mô hình')}</span>
          </>
        ) : (
          <button className="site-nav-button" onClick={onWorkshop}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              aria-hidden="true"
            >
              <path d="m4 19 5-5m6-4 5-5M4 5l4-1 7 8-3 3-8-6V5Zm12 11 4 4m-6-3 3-3" />
            </svg>
            {t('Xưởng mô hình')}
          </button>
        )}
        <LanguageSelect compact />
        <SoundButton />
      </nav>
    </header>
  );
}
