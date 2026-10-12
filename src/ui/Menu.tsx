import { useI18n } from '../i18n/I18n.tsx';
import { useState } from 'react';
import { AGE_NAMES, CIVS, type CivId } from '../game/data.ts';
import type { Config, WorldState } from '../game/types.ts';
import { Game } from '../game/engine.ts';
import { Emblem } from './Icons.tsx';
import { BrandHeader } from './BrandHeader.tsx';
import { EmpirePreview } from './EmpirePreview.tsx';
import { prefetchLobbyPreview } from './lobby-preview-art.ts';
import { themeStyle, MATERIALS } from './theme.ts';
import { GameSelect } from './GameSelect.tsx';
import { readProjectStorage, STORAGE_KEYS } from '../storage.ts';

export const SAVE_KEY = STORAGE_KEYS.save;
const civIds = Object.keys(CIVS) as CivId[];
const identities: Record<CivId, { style: string; advice: string }> = {
  roman: {
    style: 'Kỷ luật & công thành',
    advice: 'Dựng tuyến khiên vững chắc, bảo vệ khí giới tiến vào thành địch.',
  },
  mongol: {
    style: 'Cơ động & tập kích',
    advice: 'Dùng kỵ cung quấy rối, xung phong vào tuyến sau khi đối phương sơ hở.',
  },
  persian: {
    style: 'Cận vệ & voi chiến',
    advice: 'Giữ tuyến bằng cận vệ, dùng voi chiến mở đường ở đời III.',
  },
  tang: {
    style: 'Kỹ nghệ & giáp nặng',
    advice: 'Công thành từ đời II, kết hợp thương binh với kỵ binh giáp nặng.',
  },
  ottoman: {
    style: 'Hỏa khí & pháo đồng',
    advice: 'Che chắn cho bộ binh hỏa khí và triển khai pháo ở vị trí thuận lợi.',
  },
  daiviet: {
    style: 'Ngụ binh & phản công',
    advice:
      'Huy động dân khi cần giữ nhà, giải ngũ để phục hồi kinh tế; che chắn cho cung/nỏ và hỏa khí.',
  },
};
const mapOptions: { value: Config['map']; label: string; detail: string }[] = [
  { value: 'plains', label: 'Đồng bằng', detail: 'Đường mở, dễ xây dựng và điều quân.' },
  { value: 'ford', label: 'Bến cạn', detail: 'Tranh chấp các lối qua sông.' },
  { value: 'passes', label: 'Sơn ải', detail: 'Hai lối hẹp, thuận lợi cho phòng thủ.' },
];
const difficultyOptions: { value: Config['difficulty']; label: string; detail: string }[] = [
  { value: 'easy', label: 'Dễ', detail: 'Đối thủ phát triển chậm. Phù hợp trận đầu.' },
  { value: 'normal', label: 'Thường', detail: 'Nhịp phát triển và giao chiến cân bằng.' },
  { value: 'hard', label: 'Khó', detail: 'Đối thủ tấn công sớm. Cần phòng bị từ đầu.' },
];
function LobbyGlyph({ kind }: { kind: 'map' | 'battle' | 'workshop' | 'arrow' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden="true"
    >
      {kind === 'map' ? (
        <>
          <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15" />
          <path d="m5 12 2-3m10 3 2-3" />
        </>
      ) : kind === 'battle' ? (
        <>
          <path d="m7 3 5 2 5-2 3 3v7c0 5-8 9-8 9S4 18 4 13V6l3-3Z" />
          <path d="m8 9 8 8m0-8-8 8m4-12v4" />
        </>
      ) : kind === 'workshop' ? (
        <>
          <path d="m4 19 5-5m6-4 5-5M4 5l4-1 7 8-3 3-8-6V5Zm12 11 4 4m-6-3 3-3" />
        </>
      ) : (
        <>
          <path d="M5 12h14m-6-6 6 6-6 6" />
        </>
      )}
    </svg>
  );
}

export function Menu({
  onStart,
  onLoad,
  onWorkshop,
}: {
  onStart: (config: Config) => void;
  onLoad: (state: WorldState) => void;
  onWorkshop: () => void;
}) {
  const { t } = useI18n();
  const [previewAge, setPreviewAge] = useState(3);
  const [civ, setCiv] = useState<CivId>('persian');
  const [enemy, setEnemy] = useState<CivId>('roman');
  const [map, setMap] = useState<Config['map']>('plains');
  const [difficulty, setDifficulty] = useState<Config['difficulty']>('normal');
  const [error, setError] = useState('');
  const [saved] = useState(() => {
    try {
      const text = readProjectStorage(localStorage, SAVE_KEY);
      if (!text) return null;
      const data: WorldState = JSON.parse(text);
      return data.version === 1 && CIVS[data.config?.civ]
        ? { text, civ: data.config.civ, tick: data.tick }
        : null;
    } catch {
      return null;
    }
  });
  const load = (text: string) => {
    try {
      const data: WorldState = JSON.parse(text);
      if (data.version !== 1 || !data.config || !CIVS[data.config.civ]) throw new Error();
      new Game(data.config).load(data);
      onLoad(data);
    } catch {
      setError('Không đọc được bản lưu. Hãy chọn tệp Regavo JSON phiên bản 1.');
    }
  };
  return (
    <main
      className="menu lobby-root"
      data-civ={civ}
      data-age={previewAge}
      style={
        { ...themeStyle(civ, previewAge), '--civ-color': CIVS[civ].color } as React.CSSProperties
      }
    >
      <BrandHeader page="home" onWorkshop={onWorkshop} />
      <div className="lobby-shell">
        <header className="lobby-intro">
          <div>
            <span className="lobby-kicker">
              {t('SÁU NỀN VĂN MINH · BA ĐỜI · MỘT CHIẾN TRƯỜNG')}
            </span>
            <h1>
              {t('Chọn một nền văn minh.')}
              <br /> <em>{t('Viết nên lịch sử.')}</em>
            </h1>
          </div>
          <p>
            <i />
            {t('1 người chơi · Đấu AI · Bản đồ 96 × 96')}
          </p>
        </header>
        <section className="lobby-choice" aria-labelledby="choose-civilization">
          <div className="lobby-section-heading">
            <h2 id="choose-civilization">
              <span>01</span>
              {t('Chọn nền văn minh của bạn')}
            </h2>
          </div>
          <nav className="lobby-empires" aria-label={t('Chọn nền văn minh')}>
            {civIds.map((id) => (
              <button
                key={id}
                className={id === civ ? 'is-chosen' : ''}
                aria-pressed={id === civ}
                onPointerEnter={() => prefetchLobbyPreview(id, previewAge)}
                onFocus={() => prefetchLobbyPreview(id, previewAge)}
                onClick={() => {
                  setCiv(id);
                }}
              >
                <Emblem civ={id} age={3} size={50} />
                <span>
                  <b>{t(CIVS[id].name)}</b>
                  <small>{t(identities[id].style)}</small>
                </span>
                <i aria-hidden="true">{id === civ ? '✓' : ''}</i>
              </button>
            ))}
          </nav>
        </section>
        <div className="lobby-grid">
          <section className="lobby-dossier" aria-labelledby="empire-name">
            <header className="lobby-empire-heading">
              <Emblem civ={civ} age={previewAge} size={64} />
              <div>
                <h2 id="empire-name">{t(CIVS[civ].name)}</h2>
                <p>{t(CIVS[civ].subtitle)}</p>
              </div>
            </header>
            <EmpirePreview civ={civ} age={previewAge} />
            <div className="lobby-ages" aria-label={t('Xem quân và kiến trúc theo đời')}>
              {AGE_NAMES.map((name, index) => (
                <button
                  key={name}
                  aria-pressed={previewAge === index + 1}
                  onPointerEnter={() => prefetchLobbyPreview(civ, index + 1)}
                  onFocus={() => prefetchLobbyPreview(civ, index + 1)}
                  className={previewAge === index + 1 ? 'is-active' : ''}
                  onClick={() => setPreviewAge(index + 1)}
                >
                  <b>{['I', 'II', 'III'][index]}</b>
                  <span>
                    {t(name)}
                    <small>{t(MATERIALS[civ][index])}</small>
                  </span>
                </button>
              ))}
            </div>
            <div className="lobby-doctrine">
              <div>
                <span className="lobby-kicker">{t('DẤU ẤN CHIẾN TRƯỜNG')}</span>
                <p>{t(identities[civ].advice)}</p>
              </div>
              <ul>
                {CIVS[civ].signature.map((signature) => (
                  <li key={signature}>
                    <span aria-hidden="true">✦</span>
                    {t(signature)}
                  </li>
                ))}
              </ul>
            </div>
          </section>
          <aside className="lobby-setup" aria-labelledby="setup-match">
            <div className="lobby-section-heading">
              <h2 id="setup-match">
                <span>02</span>
                {t('Thiết lập trận đấu')}
              </h2>
            </div>
            <div className="lobby-settings">
              <GameSelect
                label="Địa hình"
                value={map}
                onChange={setMap}
                options={mapOptions}
                icon={<LobbyGlyph kind="map" />}
              />
              <GameSelect
                label="Đối thủ"
                value={enemy}
                onChange={setEnemy}
                options={civIds.map((id) => ({
                  value: id,
                  label: CIVS[id].name,
                  detail: identities[id].style,
                }))}
                icon={<Emblem civ={enemy} age={3} size={28} />}
              />
              <GameSelect
                label="Độ khó AI"
                value={difficulty}
                onChange={setDifficulty}
                options={difficultyOptions}
                icon={<LobbyGlyph kind="battle" />}
              />
            </div>
            <p className="lobby-difficulty-note">
              {t(difficultyOptions.find((option) => option.value === difficulty)?.detail ?? '')}
            </p>
            <button
              className="lobby-start"
              onClick={() =>
                onStart({ civ, enemy, map, difficulty, seed: Date.now() % 2147483647 })
              }
            >
              <span>
                {t('Bắt đầu chinh phạt')}
                <small>
                  {t(mapOptions.find((option) => option.value === map)?.label ?? '').toUpperCase()}{' '}
                  · AI{' '}
                  {t(
                    difficultyOptions.find((option) => option.value === difficulty)?.label ?? '',
                  ).toUpperCase()}
                </small>
              </span>
              <LobbyGlyph kind="arrow" />
            </button>
            <p className="lobby-start-note">{t('Mọi trận đấu bắt đầu ở đời I · Định cư')}</p>
            <div className="lobby-saves">
              {saved && (
                <button onClick={() => load(saved.text)}>
                  <span>
                    {t('Tiếp tục bản lưu')}
                    <small>
                      {t('{civilization} · {minutes} phút đã chơi', {
                        civilization: CIVS[saved.civ].name,
                        minutes: Math.floor((saved.tick * 0.05) / 60),
                      })}
                    </small>
                  </span>
                  <span aria-hidden="true">↗</span>
                </button>
              )}
              <label className="lobby-file">
                {t('Mở tệp lưu JSON')}
                <input
                  type="file"
                  aria-label={t('Mở tệp lưu JSON')}
                  accept=".json,application/json"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void file.text().then(load);
                    event.target.value = '';
                  }}
                />
                <span aria-hidden="true">＋</span>
              </label>
            </div>
            {error && (
              <p className="lobby-error" role="alert">
                {t(error)}
              </p>
            )}
            <details className="lobby-guide">
              <summary>
                {t('Lần đầu chơi Regavo?')}
                <span aria-hidden="true">＋</span>
              </summary>
              <div className="lobby-guide-content">
                <ol>
                  <li>{t('Tuyển dân ở thành chính, chọn dân rồi chuột phải vào tài nguyên.')}</li>
                  <li>{t('Xây doanh trại, tuyển quân và nâng đời để phát triển đế chế.')}</li>
                  <li>{t('Phá thành chính đối thủ để chiến thắng.')}</li>
                </ol>
                <p>{t('Touchpad: vuốt hai ngón để kéo bản đồ.')}</p>
              </div>
            </details>
          </aside>
        </div>
      </div>
      <footer className="lobby-footer">
        <span>
          REGAVO<span>CHRONICLES OF EMPIRES</span>
        </span>
        <p>{t('Xây nền móng. Dẫn quân. Để lại dấu ấn.')}</p>
        <a href="/third-party-licenses.txt" target="_blank" rel="noreferrer">
          {t('Giấy phép thư viện ↗')}
        </a>
      </footer>
    </main>
  );
}
