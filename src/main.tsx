import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AGE_COSTS,
  AGE_NAMES,
  ANIMAL_NAMES,
  BUILDINGS,
  CIVS,
  RESOURCE_NAMES,
  availableBuildings,
  buildingName,
  buildingFootprintSize,
  availableUnits,
  unitDefinition,
  type CivId,
  type Cost,
  type Resource,
} from './game/data.ts';
import type { Command, Config, Entity, Snapshot, WorldState } from './game/types.ts';
import { Scene } from './render/scene.ts';
import { renderArt } from './render/art.ts';
import { loadBuildingAtlas } from './render/atlas.ts';
import { loadNatureAtlas } from './render/nature.ts';
import { loadWildlifeAtlas } from './render/wildlife.ts';
import { renderUnitPortrait } from './render/units.ts';
import { loadSecondaryBuildings } from './render/buildings.ts';
import { Emblem, ResourceIcon, CommandIcon } from './ui/Icons.tsx';
import { themeStyle, MATERIALS } from './ui/theme.ts';
import { Workshop } from './ui/Workshop.tsx';
import { SoundButton, VolumeControl } from './ui/SoundButton.tsx';
import { sound } from './audio/sound.ts';
import { Menu, SAVE_KEY } from './ui/Menu.tsx';
import { I18nProvider, useI18n } from './i18n/I18n.tsx';
import { LanguageSelect } from './ui/LanguageSelect.tsx';
import { ExitDialog } from './ui/ExitDialog.tsx';
import { returnToLobby, useMatchNavigationGuard, type ExitReason } from './ui/match-navigation.ts';
import './style.css';
import './ui/theme.css';
import './ui/compact-hud.css';
import './ui/lobby.css';
const marks: Record<Resource, string> = { food: '◉', wood: '▥', gold: '◆', stone: '⬟' };
const formatTime = (n: number) =>
  `${Math.floor(n / 60)}:${Math.floor(n % 60)
    .toString()
    .padStart(2, '0')}`;
const costText = (c: Cost) =>
  Object.entries(c)
    .map(([r, n]) => `${n} ${RESOURCE_NAMES[r as Resource].toLowerCase()}`)
    .join(' · ');
function Costs({ cost }: { cost: Cost }) {
  return (
    <span className="costs">
      {Object.entries(cost).map(([r, n]) => (
        <span key={r} className={`resource-${r}`}>
          <ResourceIcon type={r as Resource} size={13} />
          {n}
        </span>
      ))}
    </span>
  );
}
function MiniArt({
  entity,
  size = 88,
}: {
  entity: Pick<Entity, 'kind' | 'type' | 'civ' | 'age' | 'team'> & { alive?: boolean };
  size?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    const draw = () => {
      if (cancelled || !ref.current) return;
      const a = renderArt(
          entity.kind,
          entity.type === 'berries' ? 'berry' : entity.type,
          entity.civ,
          entity.age,
          entity.team,
          0,
          1,
          entity.alive ?? true,
        ),
        source =
          (entity.kind === 'unit'
            ? renderUnitPortrait(entity.type, entity.civ, entity.age)
            : undefined) ?? a.canvas,
        ctx = source.getContext('2d')!;
      const pixels = ctx.getImageData(0, 0, source.width, source.height).data;
      let left = source.width,
        top = source.height,
        right = 0,
        bottom = 0;
      for (let y = 0; y < source.height; y++)
        for (let x = 0; x < source.width; x++)
          if (pixels[(y * source.width + x) * 4 + 3] > 35) {
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
      const picture = document.createElement('canvas');
      picture.width = Math.max(1, right - left + 9);
      picture.height = Math.max(1, bottom - top + 9);
      picture
        .getContext('2d')!
        .drawImage(
          source,
          Math.max(0, left - 4),
          Math.max(0, top - 4),
          picture.width,
          picture.height,
          0,
          0,
          picture.width,
          picture.height,
        );
      picture.style.maxWidth = `${size}px`;
      picture.style.maxHeight = '100%';
      picture.style.width = 'auto';
      picture.style.height = 'auto';
      ref.current.replaceChildren(picture);
    };
    draw();
    if (entity.kind === 'building' && entity.type === 'towncenter')
      void loadBuildingAtlas().then(draw);
    else if (entity.kind === 'building') void loadSecondaryBuildings().then(draw);
    else if (entity.kind === 'resource') void loadNatureAtlas().then(draw);
    else if (entity.kind === 'animal') void loadWildlifeAtlas().then(draw);
    return () => {
      cancelled = true;
    };
  }, [entity.kind, entity.type, entity.civ, entity.age, entity.team, entity.alive, size]);
  return <div className="mini-art" ref={ref} />;
}
type ActionTip = {
  label: string;
  description: string;
  cost?: Cost;
  visual?: { kind: 'unit' | 'building'; type: string };
  x: number;
  y: number;
};
function ActionTooltip({ tip, civ, age }: { tip: ActionTip; civ: CivId; age: number }) {
  const { t } = useI18n();
  const ref = useRef<HTMLElement>(null),
    [position, setPosition] = useState({ left: tip.x, top: tip.y });
  useLayoutEffect(() => {
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      if (r)
        setPosition({
          left: Math.max(8, Math.min(window.innerWidth - r.width - 8, tip.x)),
          top: Math.max(8, tip.y - r.height - 8),
        });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [tip]);
  return (
    <aside
      ref={ref}
      id="action-tooltip"
      role="tooltip"
      className={`game-tooltip${tip.visual ? ' illustrated-tooltip' : ''}`}
      style={position}
    >
      <strong>{t(tip.label)}</strong>
      <div className="tooltip-content">
        {tip.visual && (
          <div className="tooltip-preview">
            <MiniArt entity={{ ...tip.visual, civ, age, team: 0 }} size={112} />
          </div>
        )}
        <div className="tooltip-details">
          <p>{t(tip.description.split('\n')[0])}</p>
          {tip.cost && <Costs cost={tip.cost} />}
        </div>
      </div>
    </aside>
  );
}
function ProductionQueue({
  building,
  paused,
  onCancel,
}: {
  building: Entity;
  paused: boolean;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className={`production-queue${paused ? ' queue-paused' : ''}`}>
      <span className="queue-heading">
        {t('HÀNG CHỜ')} <b>{building.queue.length}</b>
        {paused && <small>{t('TẠM DỪNG')}</small>}
      </span>
      <ol className="queue-list" aria-label={t('Hàng chờ tuyển quân')}>
        {building.queue.map((q, i) => {
          const name = t(unitDefinition(q.type, building.civ).name),
            remaining = Math.max(0, Math.ceil(q.remaining)),
            progress = Math.max(
              0,
              Math.min(100, q.total > 0 ? (1 - q.remaining / q.total) * 100 : 0),
            );
          const status = t(i === 0 ? (paused ? 'Tạm dừng' : 'Đang tuyển') : 'Đang chờ');
          return (
            <li
              key={i}
              className={`queue-item${i === 0 ? ' queue-active' : ''}`}
              title={`${name} · ${status} · ${remaining}s${q.quality ? ` · ${t('Giáp tốt')}` : ''}`}
            >
              <MiniArt
                entity={{
                  kind: 'unit',
                  type: q.type,
                  civ: building.civ,
                  age: building.age,
                  team: building.team,
                }}
                size={36}
              />
              <span className="queue-time" aria-hidden="true">
                {i === 0 ? `${remaining}s` : `#${i + 1}`}
              </span>
              {q.quality && (
                <span className="queue-quality" title={t('Giáp tốt')}>
                  ⬟
                </span>
              )}
              <div
                className="queue-progress"
                role="progressbar"
                aria-label={`${name} · ${status}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
              >
                <i style={{ width: `${progress}%` }} />
              </div>
            </li>
          );
        })}
      </ol>
      <button
        onClick={onCancel}
        disabled={!building.queue.length}
        aria-label={t('Hủy mục cuối trong hàng chờ')}
        title={t('Hủy mục cuối và hoàn phần chưa thực hiện')}
      >
        ×
      </button>
    </div>
  );
}
function Minimap({ s, scene }: { s: Snapshot; scene: Scene | null }) {
  const { t } = useI18n();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const c = canvas.getContext('2d')!;
    const n = 220 / s.mapSize;
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.fillStyle = '#111c18';
    c.fillRect(0, 0, 220, 220);
    for (let y = 0; y < s.mapSize; y++)
      for (let x = 0; x < s.mapSize; x++) {
        const t = s.terrain[y * s.mapSize + x];
        c.fillStyle = s.vision[y * s.mapSize + x]
          ? t === 1
            ? '#536e72'
            : t === 2
              ? '#797d64'
              : '#71805b'
          : '#15201a';
        c.fillRect(x * n, y * n, n + 0.3, n + 0.3);
      }
    for (const e of s.entities) {
      c.fillStyle =
        e.team === 0
          ? '#a4d9c5'
          : e.team === 1
            ? '#df8270'
            : e.kind === 'animal'
              ? '#d0c29d'
              : e.type === 'gold'
                ? '#d3b869'
                : e.type === 'tree'
                  ? '#426044'
                  : '#929988';
      const size =
        e.kind === 'building'
          ? buildingFootprintSize(e.type, e.age, e.civ) * n
          : e.team >= 0
            ? 3
            : 2;
      c.fillRect(e.x * n - size / 2, e.y * n - size / 2, size, size);
    }
    if (scene) {
      c.strokeStyle = '#e4d8b0';
      c.lineWidth = 1;
      const top =
          scene.host.parentElement?.querySelector('.game-bar')?.getBoundingClientRect().bottom ??
          60,
        bottom = scene.viewportBottom;
      const a = scene.screenToWorld({ x: 0, y: top }),
        b = scene.screenToWorld({ x: scene.host.clientWidth, y: top }),
        d = scene.screenToWorld({ x: scene.host.clientWidth, y: bottom }),
        f = scene.screenToWorld({ x: 0, y: bottom });
      c.beginPath();
      c.moveTo(a.x * n, a.y * n);
      for (const p of [b, d, f]) c.lineTo(p.x * n, p.y * n);
      c.closePath();
      c.stroke();
    }
  }, [s, scene]);
  const focus = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    scene?.focus({
      x: ((e.clientX - r.left) / r.width) * s.mapSize,
      y: ((e.clientY - r.top) / r.height) * s.mapSize,
    });
  };
  return (
    <div className="minimap">
      <div className="minimap-title">
        <span className="compass">✥</span> {t('CHIẾN TRƯỜNG')}{' '}
        <span>
          {s.config.map === 'plains'
            ? t('ĐỒNG BẰNG')
            : s.config.map === 'ford'
              ? t('BẾN CẠN')
              : t('SƠN ẢI')}
        </span>
      </div>
      <canvas
        width="440"
        height="440"
        ref={ref}
        onPointerDown={focus}
        onPointerMove={(e) => {
          if (e.buttons === 1) focus(e);
        }}
        aria-label={t('Bản đồ nhỏ, bấm để di chuyển góc nhìn')}
      />
    </div>
  );
}
function ActionButton({
  label,
  icon,
  onClick,
  disabled = false,
  title = '',
  cost,
  visual,
  tip,
  onTip,
  civ,
  age,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  cost?: Cost;
  visual?: { kind: 'unit' | 'building'; type: string };
  tip: ActionTip | null;
  onTip: (tip: ActionTip | null) => void;
  civ: CivId;
  age: number;
}) {
  const { t } = useI18n();
  const symbol: Record<string, string> = {
    '↑': 'advance',
    '×': 'close',
    '⚔': 'attack',
    '■': 'stop',
    '⚑': 'hold',
    '⬟': 'shield',
    '◈': 'deploy',
    '⇢': 'pack',
    '⌂': 'pack',
    '»': 'speed',
  };
  const showTip = (element: HTMLElement) => {
    const r = element.getBoundingClientRect();
    onTip({ label, description: title, cost, visual, x: r.left, y: r.top });
  };
  return (
    <button
      className={`action ${visual ? 'illustrated-action' : ''}`}
      key={label}
      onClick={onClick}
      disabled={disabled}
      aria-label={t(label)}
      aria-describedby={tip?.label === label ? 'action-tooltip' : undefined}
      onMouseEnter={(e) => showTip(e.currentTarget)}
      onMouseLeave={() => onTip(null)}
      onFocus={(e) => showTip(e.currentTarget)}
      onBlur={() => onTip(null)}
    >
      <div className="action-picture">
        {visual ? (
          <MiniArt
            entity={{ ...visual, civ, age, team: 0 }}
            size={visual.kind === 'building' ? 88 : 68}
          />
        ) : (
          <CommandIcon
            kind={
              symbol[icon] ??
              (label.startsWith('Bán') || label.startsWith('Mua') ? 'trade' : 'advance')
            }
            size={31}
          />
        )}
      </div>
      {!visual && <span className="action-label">{t(label)}</span>}
      {cost && <Costs cost={cost} />}
    </button>
  );
}

function MarketActions({
  sell,
  resources,
  civ,
  age,
  tip,
  onTip,
  onCommand,
}: {
  sell: boolean;
  resources: Record<Resource, number>;
  civ: CivId;
  age: number;
  tip: ActionTip | null;
  onTip: (tip: ActionTip | null) => void;
  onCommand: (command: Command) => void;
}) {
  return (['food', 'wood', 'stone'] as const).map((resource) => (
    <ActionButton
      key={resource}
      label={`${sell ? 'Bán' : 'Mua'} ${RESOURCE_NAMES[resource]}`}
      icon={marks[resource]}
      onClick={() => onCommand({ type: 'exchange', resource, sell })}
      disabled={sell ? resources[resource] < 100 : resources.gold < 130}
      title={sell ? 'Bán 100 tài nguyên lấy 70 vàng.' : 'Mua 100 tài nguyên bằng 130 vàng.'}
      civ={civ}
      age={age}
      tip={tip}
      onTip={onTip}
    />
  ));
}

function GameView({
  config,
  initial,
  onExit,
}: {
  config: Config;
  initial?: WorldState;
  onExit: () => void;
}) {
  const { t, number } = useI18n();
  const host = useRef<HTMLDivElement>(null),
    sceneRef = useRef<Scene | null>(null),
    workerRef = useRef<Worker | null>(null),
    snapshotRef = useRef<Snapshot | null>(null),
    exitReason = useRef<ExitReason | null>(null),
    previouslyPaused = useRef(false);
  const [confirmExit, setConfirmExit] = useState(false),
    [savingExit, setSavingExit] = useState(false),
    [exitError, setExitError] = useState('');
  const [sceneState, setSceneState] = useState<Scene | null>(null),
    [panMode, setPanMode] = useState(false);
  const [s, setS] = useState<Snapshot | null>(null),
    [selection, setSelection] = useState<number[]>([]),
    [mode, setMode] = useState(''),
    [help, setHelp] = useState(false),
    [menu, setMenu] = useState(false),
    [tab, setTab] = useState<'build' | 'orders'>('build'),
    [toast, setToast] = useState(''),
    [tip, setTip] = useState<ActionTip | null>(null);
  const command = useCallback((c: Command) => {
    sound.play(c.type === 'build' ? 'build' : 'order');
    workerRef.current?.postMessage({ type: 'command', command: c });
  }, []);
  const requestExit = useCallback((reason: ExitReason) => {
    if (exitReason.current || snapshotRef.current?.winner != null) return;
    exitReason.current = reason;
    previouslyPaused.current = snapshotRef.current?.paused ?? false;
    if (!previouslyPaused.current)
      workerRef.current?.postMessage({ type: 'command', command: { type: 'pause' } });
    setMenu(false);
    setHelp(false);
    setExitError('');
    setConfirmExit(true);
  }, []);
  const backFromMatch = useCallback(() => requestExit('history'), [requestExit]);
  const leaveMatch = useMatchNavigationGuard(s?.winner === null, backFromMatch);
  const finishExit = useCallback(async () => {
    // Confirmed exits always return home; the history guard must finish first.
    await leaveMatch('menu');
    onExit();
  }, [leaveMatch, onExit]);
  const stayInMatch = () => {
    if (savingExit) return;
    if (!previouslyPaused.current)
      workerRef.current?.postMessage({ type: 'command', command: { type: 'pause' } });
    exitReason.current = null;
    setConfirmExit(false);
    setExitError('');
    document.querySelector<HTMLButtonElement>('.game-brand')?.focus();
  };
  const notify = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(''), 5500);
  };
  const save = (action: 'manual' | 'download' | 'quit') => {
    if (action === 'quit') setSavingExit(true);
    workerRef.current?.postMessage({
      type: 'save',
      action,
      ...(action === 'quit' ? { pausedOnLoad: previouslyPaused.current } : {}),
    });
  };
  useEffect(() => {
    const worker = new Worker(new URL('./game/worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    sound.reset();
    const scene = new Scene(host.current!, {
      command: (c) => {
        sound.play(c.type === 'build' ? 'build' : 'order');
        worker.postMessage({ type: 'command', command: c });
      },
      selection: (ids) => {
        setSelection(ids);
        setTip(null);
        if (ids.length) sound.play('select');
      },
      mode: setMode,
      cameraMode: setPanMode,
    });
    sceneRef.current = scene;
    void scene
      .init([config.civ, config.enemy])
      .then(() => {
        if (scene.destroyed) return;
        setSceneState(scene);
        if (initial) worker.postMessage({ type: 'load', state: initial });
        else worker.postMessage({ type: 'start', config });
      })
      .catch((e) =>
        notify(`Không mở được WebGL: ${e.message}. Thử bật tăng tốc đồ họa trình duyệt.`),
      );
    let first = true;
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'snapshot') {
        snapshotRef.current = m.snapshot;
        setS(m.snapshot);
        scene.setSnapshot(m.snapshot);
        sound.observe(m.snapshot, scene.center);
        if (first) {
          const capital = m.snapshot.entities.find(
            (ent: Entity) => ent.type === 'towncenter' && ent.team === 0,
          );
          if (capital) scene.focus(capital);
          first = false;
        }
      }
      if (m.type === 'error') {
        notify(m.message);
        if (m.action === 'quit') {
          setSavingExit(false);
          setExitError('Không thể lưu trận đấu. Hãy thử lại hoặc ở lại chiến trường.');
        }
      }
      if (m.type === 'save') {
        const action = m.action ?? 'auto';
        if (action === 'download') {
          const text = JSON.stringify(m.state);
          const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
          const link = document.createElement('a');
          link.href = url;
          link.download = `regavo-${config.civ}-${Math.floor(m.state.tick * 0.05)}.json`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          notify('Đã xuất tệp lưu.');
          return;
        }
        try {
          const text = JSON.stringify(m.state);
          localStorage.setItem(SAVE_KEY, text);
          if (action === 'manual') notify('Đã lưu trận đấu trên trình duyệt này.');
          if (action === 'quit') {
            void finishExit();
          }
        } catch {
          notify('Bộ nhớ trình duyệt đã đầy. Bạn vẫn có thể xuất tệp lưu.');
          if (action === 'quit') {
            setSavingExit(false);
            setExitError(
              'Không thể lưu trên trình duyệt này. Hãy ở lại để xuất tệp lưu, hoặc chọn thoát không lưu.',
            );
          }
        }
      }
    };
    const auto = setInterval(() => {
      if (!exitReason.current) worker.postMessage({ type: 'save' });
    }, 30000);
    const visibility = () => {
      if (document.visibilityState === 'hidden' && !exitReason.current)
        worker.postMessage({ type: 'save' });
    };
    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if ((e.target as HTMLElement).matches('input,select,textarea')) return;
      if (e.code === 'KeyP' && !scene.blocked)
        worker.postMessage({ type: 'command', command: { type: 'pause' } });
      if (e.code === 'F1' || e.code === 'Slash') {
        e.preventDefault();
        setHelp((v) => !v);
      }
      if (e.code === 'Escape') {
        setMenu(false);
        setHelp(false);
      }
    };
    window.addEventListener('keydown', key);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clearInterval(auto);
      sound.setActive(false);
      worker.terminate();
      scene.destroy();
      window.removeEventListener('keydown', key);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [config, initial, finishExit]);
  const winner = s?.winner;
  useEffect(() => {
    if (sceneRef.current) sceneRef.current.blocked = help || menu || confirmExit || winner != null;
  }, [help, menu, confirmExit, winner]);
  const selected = s?.entities.filter((e) => selection.includes(e.id)) ?? [],
    own = selected.filter((e) => e.team === 0),
    main = selected[0],
    building =
      own.length === 1 && own[0].kind === 'building' && own[0].state !== 'packed'
        ? own[0]
        : undefined;
  const builders = own.filter((e) => e.type === 'villager' || e.type === 'engineer');
  const affordable = (cost: Cost) =>
    !!s && Object.entries(cost).every(([r, n]) => s.player.resources[r as Resource] >= n!);

  return (
    <main
      className={`game-view${main ? ' has-selection' : ''}`}
      data-civ={s?.player.civ ?? config.civ}
      data-age={s?.player.age ?? 1}
      style={themeStyle(s?.player.civ ?? config.civ, s?.player.age ?? 1) as React.CSSProperties}
    >
      <div className="battle-canvas" ref={host} />
      {(!s || !sceneState) && <div className="loading">{t('Đang dựng chiến trường…')}</div>}
      {s && (
        <>
          <header className="game-bar">
            <button
              className="game-brand"
              aria-label={t('Mở menu trận đấu')}
              onClick={() => setMenu(true)}
            >
              <Emblem civ={s.player.civ} age={s.player.age} size={49} />
              <span className="brand-title">
                REGAVO<small>{t(CIVS[s.player.civ].name)}</small>
              </span>
              <CommandIcon kind="menu" size={17} />
            </button>
            <div className="resource-bar">
              {(['food', 'wood', 'gold', 'stone'] as Resource[]).map((r) => (
                <div className={`resource resource-${r}`} key={r} title={t(RESOURCE_NAMES[r])}>
                  <ResourceIcon type={r} size={34} />
                  <span>
                    <small>{t(RESOURCE_NAMES[r])}</small>
                    <b>{number(Math.floor(s.player.resources[r]))}</b>
                  </span>
                </div>
              ))}
              <div className="resource population" title={t('Dân số / sức chứa, tối đa 200')}>
                <ResourceIcon type="population" size={34} />
                <span>
                  <small>{t('Dân số')}</small>
                  <b className={s.population >= s.capacity ? 'full' : ''}>
                    {s.population}
                    <em> / {s.capacity}</em>
                  </b>
                </span>
              </div>
            </div>
            <div className="match-clock">
              <small>{t(CIVS[s.player.civ].name)}</small>
              <b>{formatTime(s.tick * 0.05)}</b>
            </div>
            <SoundButton />
            <button
              className="pause-button"
              title={t('Tạm dừng (P)')}
              onClick={() => command({ type: 'pause' })}
            >
              <CommandIcon kind={s.paused ? 'play' : 'pause'} size={20} />
            </button>
            <button
              className="help-button"
              title={t('Hướng dẫn (?)')}
              onClick={() => setHelp(true)}
            >
              <CommandIcon kind="help" size={20} />
            </button>
          </header>
          <div className={`age-banner${s.player.research ? ' is-researching' : ''}`}>
            <span className="age-number">{['I', 'II', 'III'][s.player.age - 1]}</span>
            <div>
              <b>{t(AGE_NAMES[s.player.age - 1])}</b>
              <small>
                {s.player.research
                  ? t(`Lên đời ${s.player.age + 1} · ${Math.ceil(s.player.research.remaining)}s`)
                  : t(MATERIALS[s.player.civ][s.player.age - 1])}
              </small>
              {s.player.research && (
                <div className="tiny-progress">
                  <i
                    style={{
                      width: `${(1 - s.player.research.remaining / s.player.research.total) * 100}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="opponent-badge">
            <Emblem civ={config.enemy} age={2} size={30} />
            <span className="enemy-dot" /> {t(CIVS[config.enemy].name)}{' '}
            <small>
              AI ·{' '}
              {config.difficulty === 'easy'
                ? t('Dễ')
                : config.difficulty === 'hard'
                  ? t('Khó')
                  : t('Thường')}
            </small>
          </div>
          {mode && <div className="mode-hint">{t(mode)}</div>}
          <div className="events" aria-live="polite">
            {toast && <div className="toast">{t(toast)}</div>}
            {s.messages
              .filter((m) => s.tick - m.tick < 140)
              .slice(-2)
              .map((m, i) => (
                <div key={`${m.tick}-${i}`}>{t(m.text)}</div>
              ))}
          </div>
          {main && (
            <div className="bottom-area">
              <section
                className={`selection-panel${selected.length > 1 ? ' group-selection' : ''}`}
              >
                <div className="selection-heading">
                  <span>
                    {selected.length > 1
                      ? t(`${selected.length} đơn vị`)
                      : main.kind === 'unit'
                        ? t(unitDefinition(main.type, main.civ).name)
                        : main.kind === 'building'
                          ? t(buildingName(main.type, main.civ))
                          : main.kind === 'animal'
                            ? t(ANIMAL_NAMES[main.type])
                            : main.type === 'berries'
                              ? t('Bụi quả')
                              : main.type === 'tree'
                                ? t('Cây rừng')
                                : main.type === 'gold'
                                  ? t('Mỏ vàng')
                                  : t('Mỏ đá')}
                  </span>
                  <small>
                    {main.team === 0
                      ? t('QUÂN TA')
                      : main.team === 1
                        ? t('ĐỐI THỦ')
                        : t('TỰ NHIÊN')}
                  </small>
                </div>
                <div className="selection-info">
                  <MiniArt entity={main} size={main.kind === 'building' ? 130 : 100} />
                  <div>
                    {main.team >= 0 ? (
                      <>
                        <div className="hp-line">
                          <i style={{ width: `${Math.max(0, main.hp / main.maxHp) * 100}%` }} />
                        </div>
                        <b>
                          {Math.ceil(Math.max(0, main.hp))} / {Math.ceil(main.maxHp)}{' '}
                          <small>HP</small>
                        </b>
                        {main.kind === 'unit' && (
                          <div className="unit-stats">
                            <span title={t('Sát thương')}>
                              <CommandIcon kind="attack" size={15} />
                              {unitDefinition(main.type, main.civ).damage}
                            </span>
                            <span title={t('Tầm đánh')}>
                              <CommandIcon kind="advance" size={15} />
                              {unitDefinition(main.type, main.civ).range}
                            </span>
                            <span title={t('Tốc độ')}>
                              <CommandIcon kind="speed" size={15} />
                              {unitDefinition(main.type, main.civ).speed}
                            </span>
                          </div>
                        )}
                        {main.mobilization && (
                          <p>
                            {t(
                              main.mobilization.target === 'militia'
                                ? 'Đang huy động dân binh'
                                : 'Đang giải ngũ',
                            )}
                            {' · '}
                            {t(
                              main.mobilization.phase === 'train'
                                ? 'Huấn luyện'
                                : main.mobilization.phase === 'deliver'
                                  ? 'Giao tài nguyên'
                                  : 'Đến doanh trại',
                            )}
                            {' · '}
                            {Math.ceil(main.mobilization.remaining)}s
                          </p>
                        )}
                        {main.progress < 1 && (
                          <p>
                            {t('Đang xây {percent}%', { percent: Math.floor(main.progress * 100) })}
                          </p>
                        )}
                        {main.carry > 0 && (
                          <p className="cargo">
                            {t('Mang {amount} {resource}', {
                              amount: Math.floor(main.carry),
                              resource: main.carryMeat
                                ? 'thịt'
                                : RESOURCE_NAMES[main.carryType ?? 'food'].toLowerCase(),
                            })}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <b>
                          {Math.floor(main.amount)}{' '}
                          <small>
                            {main.kind === 'animal'
                              ? t('THỊT')
                              : main.type === 'tree'
                                ? t('GỖ')
                                : main.type === 'gold'
                                  ? t('VÀNG')
                                  : main.type === 'stone'
                                    ? t('ĐÁ')
                                    : t('LƯƠNG THỰC')}
                          </small>
                        </b>
                        {main.kind === 'animal' && (
                          <p>
                            {main.alive
                              ? t('Dân có thể săn bằng chuột phải')
                              : t('Xác đang hao thịt theo thời gian')}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {selected.length > 1 && (
                  <div className="group-roster">
                    {[...new Set(selected.map((e) => e.type))].slice(0, 6).map((type) => {
                      const e = selected.find((ent) => ent.type === type)!;
                      return (
                        <button
                          key={type}
                          onClick={() =>
                            sceneRef.current?.select(
                              selected.filter((ent) => ent.type === type).map((ent) => ent.id),
                            )
                          }
                          title={t(unitDefinition(type, e.civ)?.name ?? buildingName(type, e.civ))}
                        >
                          <MiniArt entity={e} size={40} />
                          <b>{selected.filter((ent) => ent.type === type).length}</b>
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="selection-description">
                  {selected.length > 1
                    ? t('Chuột phải để ra lệnh cho nhóm. Shift để xếp lệnh.')
                    : main.kind === 'unit'
                      ? t(unitDefinition(main.type, main.civ).description)
                      : main.kind === 'building'
                        ? t(BUILDINGS[main.type].description)
                        : main.kind === 'animal'
                          ? t(
                              'Thịt phải được dân mang về thành chính hoặc kho lương để cộng vào lương thực.',
                            )
                          : t('Tài nguyên hữu hạn. Đặt trại gần nguồn để giảm quãng vận chuyển.')}
                </p>
              </section>
              {own.length > 0 && (
                <section className="command-panel">
                  <div className="command-header">
                    <span>
                      {building
                        ? t('CÔNG TRÌNH')
                        : builders.length
                          ? t('DÂN & XÂY DỰNG')
                          : t('ĐIỀU QUÂN')}
                    </span>
                    {builders.length > 0 && (
                      <div className="tabs">
                        <button
                          className={tab === 'build' ? 'active' : ''}
                          onClick={() => setTab('build')}
                        >
                          {t('Xây dựng')}
                        </button>
                        <button
                          className={tab === 'orders' ? 'active' : ''}
                          onClick={() => setTab('orders')}
                        >
                          {t('Thao tác')}
                        </button>
                      </div>
                    )}
                    <small>{t('Shift + bấm: giữ chế độ xây')}</small>
                  </div>
                  <div className="action-grid">
                    {building && building.progress >= 1 && (
                      <>
                        {availableUnits(building.type, s.player.civ, s.player.age).map(
                          ([id, d]) => (
                            <ActionButton
                              key={d.name}
                              label={d.name}
                              icon={
                                id === 'elephant'
                                  ? '♜'
                                  : d.role === 'cavalry'
                                    ? '♞'
                                    : d.role === 'ranged'
                                      ? '↗'
                                      : d.role === 'siege'
                                        ? '◈'
                                        : d.role === 'civilian'
                                          ? '♙'
                                          : '⚔'
                              }
                              onClick={() =>
                                command({ type: 'train', building: building.id, unit: id })
                              }
                              disabled={!affordable(d.cost) || s.population >= s.capacity}
                              title={`${d.description}\n${costText(d.cost)} · ${d.time}s`}
                              cost={d.cost}
                              visual={{ kind: 'unit', type: id }}
                              tip={tip}
                              onTip={setTip}
                              civ={s.player.civ}
                              age={s.player.age}
                            />
                          ),
                        )}
                        {building.type === 'towncenter' &&
                          s.player.age < 3 &&
                          (s.player.research ? (
                            <ActionButton
                              key={'Hủy lên đời'}
                              label={'Hủy lên đời'}
                              icon={'×'}
                              onClick={() => command({ type: 'canceladvance' })}
                              disabled={false}
                              title={'Hoàn tài nguyên theo phần tiến độ còn lại.'}
                              tip={tip}
                              onTip={setTip}
                              civ={s.player.civ}
                              age={s.player.age}
                            />
                          ) : (
                            <ActionButton
                              key={`Lên đời ${s.player.age + 1}`}
                              label={`Lên đời ${s.player.age + 1}`}
                              icon={'↑'}
                              onClick={() => command({ type: 'advance' })}
                              disabled={!affordable(AGE_COSTS[s.player.age - 1])}
                              title={'Tạm dừng hàng tuyển dân tại thành chính.'}
                              cost={AGE_COSTS[s.player.age - 1]}
                              tip={tip}
                              onTip={setTip}
                              civ={s.player.civ}
                              age={s.player.age}
                            />
                          ))}
                        {building.type === 'armory' && (
                          <>
                            {
                              <ActionButton
                                key={'Tuyển nhanh'}
                                label={'Tuyển nhanh'}
                                icon={'»'}
                                onClick={() => command({ type: 'armory', mode: 'speed' })}
                                disabled={!!s.player.armoryChange || s.player.armory === 'speed'}
                                title={'Quân đặt hàng mới tuyển nhanh hơn 30%.'}
                                tip={tip}
                                onTip={setTip}
                                civ={s.player.civ}
                                age={s.player.age}
                              />
                            }
                            {
                              <ActionButton
                                key={'Giáp tốt'}
                                label={'Giáp tốt'}
                                icon={'⬟'}
                                onClick={() => command({ type: 'armory', mode: 'quality' })}
                                disabled={!!s.player.armoryChange || s.player.armory === 'quality'}
                                title={'Quân đặt hàng mới +10% HP, +2 giáp, tuyển chậm hơn 15%.'}
                                tip={tip}
                                onTip={setTip}
                                civ={s.player.civ}
                                age={s.player.age}
                              />
                            }
                            <span className="armory-status">
                              {s.player.armoryChange
                                ? t(`Chuyển chế độ: ${Math.ceil(s.player.armoryChange.remaining)}s`)
                                : t(
                                    `Chế độ: ${s.player.armory === 'speed' ? 'Tuyển nhanh' : 'Giáp tốt'}`,
                                  )}
                            </span>
                          </>
                        )}
                        {building.type === 'market' && (
                          <MarketActions
                            sell={true}
                            resources={s.player.resources}
                            civ={s.player.civ}
                            age={s.player.age}
                            tip={tip}
                            onTip={setTip}
                            onCommand={command}
                          />
                        )}
                        {building.type === 'market' && (
                          <MarketActions
                            sell={false}
                            resources={s.player.resources}
                            civ={s.player.civ}
                            age={s.player.age}
                            tip={tip}
                            onTip={setTip}
                            onCommand={command}
                          />
                        )}
                        {s.player.civ === 'mongol' &&
                          s.player.age >= 2 &&
                          ['lumbercamp', 'miningcamp', 'granary'].includes(building.type) && (
                            <ActionButton
                              key={'Thu trại'}
                              label={'Thu trại'}
                              icon={'⇢'}
                              onClick={() => command({ type: 'pack', ids: [building.id] })}
                              disabled={false}
                              title={'Thu trại để chuột phải chuyển vị trí rồi dựng lại.'}
                              tip={tip}
                              onTip={setTip}
                              civ={s.player.civ}
                              age={s.player.age}
                            />
                          )}
                        {!availableUnits(building.type, s.player.civ, s.player.age).length &&
                          !['towncenter', 'market', 'armory'].includes(building.type) && (
                            <p className="quiet-action">
                              {t('Chuột phải trên chiến trường để đặt điểm tập kết.')}
                            </p>
                          )}
                      </>
                    )}
                    {builders.length > 0 &&
                      tab === 'build' &&
                      availableBuildings(s.player.civ, s.player.age).map(([id, d]) => (
                        <ActionButton
                          key={d.name}
                          label={buildingName(id, s.player.civ)}
                          icon={
                            id === 'farm'
                              ? '≋'
                              : id.includes('wall')
                                ? '▥'
                                : id.includes('gate')
                                  ? 'Π'
                                  : id === 'stable'
                                    ? '♞'
                                    : id === 'tower'
                                      ? '♜'
                                      : '⌂'
                          }
                          onClick={() => sceneRef.current?.setBuild(id)}
                          disabled={!affordable(d.cost)}
                          title={`${d.description}\n${costText(d.cost)} · ${d.time}s`}
                          cost={d.cost}
                          visual={{ kind: 'building', type: id }}
                          tip={tip}
                          onTip={setTip}
                          civ={s.player.civ}
                          age={s.player.age}
                        />
                      ))}
                    {own.length > 0 && !building && (!builders.length || tab === 'orders') && (
                      <>
                        {
                          <ActionButton
                            key={'Tấn công (A)'}
                            label={'Tấn công (A)'}
                            icon={'⚔'}
                            onClick={() => sceneRef.current?.setCombatMode('attack')}
                            tip={tip}
                            onTip={setTip}
                            civ={s.player.civ}
                            age={s.player.age}
                          />
                        }
                        <ActionButton
                          label="Rút lui (D)"
                          icon="↶"
                          onClick={() => sceneRef.current?.setCombatMode('retreat')}
                          tip={tip}
                          onTip={setTip}
                          civ={s.player.civ}
                          age={s.player.age}
                        />
                        {
                          <ActionButton
                            key={'Dừng (S)'}
                            label={'Dừng (S)'}
                            icon={'■'}
                            onClick={() => command({ type: 'stop', ids: selection })}
                            tip={tip}
                            onTip={setTip}
                            civ={s.player.civ}
                            age={s.player.age}
                          />
                        }
                        {
                          <ActionButton
                            key={'Giữ chỗ (H)'}
                            label={'Giữ chỗ (H)'}
                            icon={'⚑'}
                            onClick={() => command({ type: 'hold', ids: selection })}
                            tip={tip}
                            onTip={setTip}
                            civ={s.player.civ}
                            age={s.player.age}
                          />
                        }
                        {s.player.civ === 'daiviet' &&
                          s.player.age >= 2 &&
                          own.some((e) => e.type === 'villager' && !e.mobilization) && (
                            <ActionButton
                              label="Huy động dân binh"
                              icon="⚔"
                              cost={{ food: 20, wood: 10 }}
                              title="Mỗi dân: 20 lương thực, 10 gỗ; giao tài nguyên rồi huấn luyện 8s tại doanh trại. Tối đa 12 dân binh; giảm nhân lực kinh tế."
                              onClick={() => command({ type: 'mobilize', ids: selection })}
                              disabled={
                                !affordable({ food: 20, wood: 10 }) ||
                                !s.entities.some(
                                  (e) => e.team === 0 && e.type === 'barracks' && e.progress >= 1,
                                )
                              }
                              tip={tip}
                              onTip={setTip}
                              civ={s.player.civ}
                              age={s.player.age}
                            />
                          )}
                        {s.player.civ === 'daiviet' &&
                          own.some((e) => e.type === 'militia' && !e.mobilization) && (
                            <ActionButton
                              label="Giải ngũ"
                              icon="⌂"
                              title="Trở về doanh trại trong 8s để làm dân, giữ tỷ lệ máu và quay lại công việc cũ; không hoàn trang bị."
                              onClick={() => command({ type: 'demobilize', ids: selection })}
                              disabled={
                                !s.entities.some(
                                  (e) => e.team === 0 && e.type === 'barracks' && e.progress >= 1,
                                )
                              }
                              tip={tip}
                              onTip={setTip}
                              civ={s.player.civ}
                              age={s.player.age}
                            />
                          )}
                        {own.some((e) => e.type === 'legionary') && (
                          <ActionButton
                            key={'Dựng khiên'}
                            label={'Dựng khiên'}
                            icon={'⬟'}
                            onClick={() => command({ type: 'shield', ids: selection })}
                            disabled={false}
                            title={'Bật/tắt khiên, giảm đòn từ phía trước và giảm tốc.'}
                            tip={tip}
                            onTip={setTip}
                            civ={s.player.civ}
                            age={s.player.age}
                          />
                        )}
                        {own.some((e) => e.type === 'cannon') && (
                          <ActionButton
                            key={'Triển khai'}
                            label={'Triển khai'}
                            icon={'◈'}
                            onClick={() => command({ type: 'deploy', ids: selection })}
                            disabled={false}
                            title={'Bật/tắt triển khai; đứng yên để bắn nhanh hơn.'}
                            tip={tip}
                            onTip={setTip}
                            civ={s.player.civ}
                            age={s.player.age}
                          />
                        )}
                        {own.some((e) => e.state === 'packed') && (
                          <ActionButton
                            key={'Dựng trại'}
                            label={'Dựng trại'}
                            icon={'⌂'}
                            onClick={() => command({ type: 'pack', ids: selection })}
                            disabled={false}
                            title={'Cần vị trí đủ đất trống.'}
                            tip={tip}
                            onTip={setTip}
                            civ={s.player.civ}
                            age={s.player.age}
                          />
                        )}
                      </>
                    )}
                    {building && building.progress < 1 && (
                      <p className="quiet-action">
                        {t('Dân đang dựng công trình.')}
                        <br />
                        {t('Chọn thêm dân rồi chuột phải vào nền móng để hỗ trợ.')}
                      </p>
                    )}
                  </div>
                  {building &&
                    building.progress >= 1 &&
                    availableUnits(building.type, s.player.civ, s.player.age).length > 0 && (
                      <ProductionQueue
                        building={building}
                        paused={s.paused || (building.type === 'towncenter' && !!s.player.research)}
                        onCancel={() => command({ type: 'cancelqueue', building: building.id })}
                      />
                    )}
                </section>
              )}
            </div>
          )}
          <Minimap s={s} scene={sceneState} />
          <div className="bottom-hint">
            <span>
              {t('Hai ngón: kéo map · Space + kéo · Ctrl/cuộn: zoom · F: về quân · I: dân rảnh')}
            </span>
            <div className="camera-controls">
              <button
                className="pan-toggle"
                aria-pressed={panMode}
                title={t('Bật để kéo bản đồ bằng một ngón; bấm lại để chọn quân')}
                onClick={() => {
                  const next = !panMode;
                  setPanMode(next);
                  sceneRef.current?.setPanMode(next);
                }}
              >
                ✥ {panMode ? t('Đang kéo map') : t('Kéo bản đồ')}
              </button>
              <button
                onClick={() =>
                  command({ type: 'speed', value: s.speed === 1 ? 1.5 : s.speed === 1.5 ? 2 : 1 })
                }
              >
                {t('Tốc độ')} {s.speed}×
              </button>
            </div>
          </div>
          {tip && main && !help && !menu && (
            <ActionTooltip tip={tip} civ={s.player.civ} age={s.player.age} />
          )}
          {s.paused && !menu && (
            <div className="paused-label">
              {t('ĐANG TẠM DỪNG')}{' '}
              <button onClick={() => command({ type: 'pause' })}>{t('Tiếp tục (P)')}</button>
            </div>
          )}
          {help && (
            <div className="overlay" onClick={() => setHelp(false)}>
              <section className="modal help-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close" onClick={() => setHelp(false)}>
                  ×
                </button>
                <span className="eyebrow">{t('CẨM NANG CHIẾN TRƯỜNG')}</span>
                <h2>{t('Từ làng nhỏ đến đế chế.')}</h2>
                <div className="help-columns">
                  <div>
                    <h3>{t('Khởi đầu')}</h3>
                    <ol>
                      <li>
                        {t(
                          'Tuyển dân ở thành chính. Chọn dân rồi chuột phải vào quả, cây, mỏ hoặc động vật.',
                        )}
                      </li>
                      <li>
                        {t(
                          'Mỗi dân mang tối đa 10 tài nguyên. Xây kho gần nguồn để giảm thời gian đi về.',
                        )}
                      </li>
                      <li>
                        {t(
                          'Xây nhà tăng dân số; doanh trại để tuyển giáo binh. Thu 400 lương thực + 180 vàng rồi lên đời II.',
                        )}
                      </li>
                      <li>
                        {t(
                          'Lên đời III mở quân và kiến trúc cao cấp. Phá thành chính của đối thủ để thắng.',
                        )}
                      </li>
                    </ol>
                  </div>
                  <div>
                    <h3>{t('Điều khiển')}</h3>
                    <dl>
                      <dt>{t('Trái / kéo khung')}</dt>
                      <dd>{t('Chọn quân; Shift thêm vào nhóm')}</dd>
                      <dt>{t('Chuột phải')}</dt>
                      <dd>{t('Đi, đánh, khai thác, xây, sửa')}</dd>
                      <dt>{t('Shift + chuột phải')}</dt>
                      <dd>{t('Xếp hàng nhiều lệnh')}</dd>
                      <dt>{t('A, rồi bấm trái')}</dt>
                      <dd>{t('Di chuyển và tìm địch để đánh')}</dd>
                      <dt>{t('D, rồi bấm trái')}</dt>
                      <dd>{t('Rút lui khỏi giao chiến')}</dd>
                      <dt>S / H</dt>
                      <dd>{t('Dừng / bật giữ vị trí')}</dd>
                      <dt>R</dt>
                      <dd>{t('Xoay hàng rào / cổng khi xây')}</dd>
                      <dt>{t('Vuốt hai ngón')}</dt>
                      <dd>{t('Kéo bản đồ trên touchpad')}</dd>
                      <dt>{t('Space + kéo / Alt + kéo')}</dt>
                      <dd>{t('Kéo bản đồ bằng một ngón')}</dd>
                      <dt>{t('Ctrl + cuộn / chụm ngón')}</dt>
                      <dd>{t('Thu phóng tại vị trí con trỏ')}</dd>
                      <dt>{t('Nút Kéo bản đồ')}</dt>
                      <dd>{t('Bật chế độ kéo; bấm lại để chọn quân')}</dd>
                      <dt>{t('Phím mũi tên / mép màn')}</dt>
                      <dd>{t('Di chuyển góc nhìn')}</dd>
                      <dt>{t('Ctrl + số / số')}</dt>
                      <dd>{t('Lưu / gọi nhóm quân')}</dd>
                      <dt>I / F / P</dt>
                      <dd>{t('Dân rảnh / về quân chọn / tạm dừng')}</dd>
                    </dl>
                  </div>
                </div>
                <p className="help-faction">
                  {t(CIVS[s.player.civ].name)}: {t(CIVS[s.player.civ].description)}
                </p>
                <p className="help-note">
                  {t(
                    'Sương mù chỉ hiển thị vùng đang nhìn thấy. Voi chiến thuộc Ba Tư đời III, tối đa 6 con; giáo binh là khắc chế trực tiếp. Thương nhân đi giữa hai chợ của mình. Trại Mông Cổ có thể di chuyển từ đời II.',
                  )}
                </p>
                <button className="primary" onClick={() => setHelp(false)}>
                  {t('Trở lại chiến trường')}
                </button>
              </section>
            </div>
          )}
          {menu && (
            <div className="overlay">
              <section className="modal pause-menu">
                <span className="eyebrow">REGAVO</span>
                <h2>{t('Trận đấu của bạn')}</h2>
                <button className="primary" onClick={() => setMenu(false)}>
                  {t('Trở lại chiến trường')}
                </button>
                <button onClick={() => command({ type: 'pause' })}>
                  {s.paused ? t('Tiếp tục mô phỏng') : t('Tạm dừng mô phỏng')}
                </button>
                <button onClick={() => save('manual')}>{t('Lưu trên trình duyệt')}</button>
                <button onClick={() => save('download')}>{t('Xuất tệp lưu JSON')}</button>
                <button
                  onClick={() => {
                    setMenu(false);
                    setHelp(true);
                  }}
                >
                  {t('Hướng dẫn điều khiển')}
                </button>
                <LanguageSelect />
                <VolumeControl />
                <button onClick={() => requestExit('menu')}>{t('Về màn hình đầu')}</button>
                <a href="/third-party-licenses.txt" target="_blank" rel="noreferrer">
                  {t('Giấy phép thư viện ↗')}
                </a>
              </section>
            </div>
          )}
          {confirmExit && (
            <ExitDialog
              civ={s.player.civ}
              age={s.player.age}
              time={formatTime(s.tick * 0.05)}
              busy={savingExit}
              error={exitError}
              onStay={stayInMatch}
              onSaveExit={() => save('quit')}
              onDiscard={() => void finishExit()}
            />
          )}
          {s.winner !== null && (
            <div className="overlay victory">
              <section className="modal">
                <span className="eyebrow">{t('TRẬN ĐẤU KẾT THÚC')}</span>
                <h2>
                  {s.winner === 'draw'
                    ? t('Bất phân thắng bại')
                    : s.winner === 0
                      ? t('Đế chế chiến thắng.')
                      : t('Thành chính đã thất thủ.')}
                </h2>
                <p>
                  {s.winner === 'draw'
                    ? t('Hai thành chính bị phá trong cùng một nhịp mô phỏng.')
                    : s.winner === 0
                      ? t('Bạn đã phá thành chính của đối thủ.')
                      : t('Đạo quân đối phương đã phá thành chính của bạn.')}
                </p>
                <div className="result-stats">
                  <span>
                    <b>{formatTime(s.tick * 0.05)}</b>
                    {t('Thời gian')}
                  </span>
                  <span>
                    <b>{s.stats.kills[0]}</b>
                    {t('Địch bị hạ')}
                  </span>
                  <span>
                    <b>{number(Math.floor(s.stats.gathered[0]))}</b>
                    {t('Tài nguyên đã nhận')}
                  </span>
                </div>
                <button className="primary" onClick={onExit}>
                  {t('Trở về màn hình đầu')}
                </button>
              </section>
            </div>
          )}
        </>
      )}
    </main>
  );
}
function App() {
  const [match, setMatch] = useState<{ config: Config; initial?: WorldState } | null>(null),
    [workshop, setWorkshop] = useState(() => location.hash === '#workshop');
  useEffect(() => {
    const route = () => setWorkshop(location.hash === '#workshop'),
      unlock = () => {
        void sound.unlock();
      },
      visibility = () => sound.apply();
    window.addEventListener('hashchange', route);
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('hashchange', route);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  useEffect(() => {
    if (!match) sound.setActive(true);
  }, [match, workshop]);
  const exitMatch = useCallback(() => {
    returnToLobby(window);
    setWorkshop(false);
    setMatch(null);
  }, []);
  if (workshop && !match)
    return (
      <Workshop
        onBack={() => {
          location.hash = '';
          setWorkshop(false);
        }}
      />
    );
  return match ? (
    <GameView
      key={`${match.config.seed}`}
      config={match.config}
      initial={match.initial}
      onExit={exitMatch}
    />
  ) : (
    <Menu
      onWorkshop={() => {
        location.hash = 'workshop';
        setWorkshop(true);
      }}
      onStart={(config) => {
        location.hash = '';
        setMatch({ config });
      }}
      onLoad={(initial) => {
        location.hash = '';
        setMatch({ config: initial.config, initial });
      }}
    />
  );
}
createRoot(document.getElementById('root')!).render(
  <I18nProvider>
    <App />
  </I18nProvider>,
);
