import { useI18n } from '../i18n/I18n.tsx';
import { useEffect, useRef, useState } from 'react';
import {
  AGE_NAMES,
  ANIMAL_NAMES,
  BUILDINGS,
  CIVS,
  UNITS,
  availableBuildings,
  buildingName,
  buildingFootprintSize,
  civilizationUnits,
  unitDefinition,
  type CivId,
} from '../game/data.ts';
import { renderArt, type ArtSprite } from '../render/art.ts';
import { unitStrideDistance, walkFrameCount } from '../render/unit-gait.ts';
import { loadBuildingAtlas } from '../render/atlas.ts';
import { loadSecondaryBuildings } from '../render/buildings.ts';
import { loadNatureAtlas } from '../render/nature.ts';
import { loadWildlifeAtlas } from '../render/wildlife.ts';
import { loadUnitAtlases } from '../render/units.ts';
import {
  attackEffects,
  projectileEffects,
  isProjectileWeapon,
  drawCombatEffects,
} from '../render/combat-effects.ts';
import { Emblem } from './Icons.tsx';
import { BrandHeader } from './BrandHeader.tsx';
import { themeStyle, MATERIALS } from './theme.ts';
import { GameSelect } from './GameSelect.tsx';
import './workshop.css';
type Model = { kind: 'unit' | 'building' | 'animal' | 'resource'; type: string; name: string };
const civilizations = Object.keys(CIVS) as CivId[];
const loading = (civ: CivId, units = true) =>
  Promise.all([
    loadBuildingAtlas(),
    loadSecondaryBuildings(),
    loadNatureAtlas(),
    loadWildlifeAtlas(),
    ...(units ? [loadUnitAtlases([civ, 'persian'])] : []),
  ]);
const animals = Object.entries(ANIMAL_NAMES).map(([type, name]) => ({
  kind: 'animal' as const,
  type,
  name,
}));
const actions = [
  ['idle', 'Đứng nghỉ'],
  ['walk', 'Di chuyển'],
  ['chop', 'Chặt gỗ'],
  ['mine', 'Khai khoáng'],
  ['build', 'Xây dựng'],
  ['harvest', 'Thu hoạch'],
  ['attack', 'Tấn công'],
] as const;
const cargoActions = [
  ['carry-food', 'Mang lương thực'],
  ['carry-meat', 'Mang thịt'],
  ['carry-wood', 'Mang gỗ'],
  ['carry-gold', 'Mang vàng'],
  ['carry-stone', 'Mang đá'],
] as const;
const animationRate = (action: string, type: string, civ: CivId) =>
  action === 'walk' || action.startsWith('carry-')
    ? UNITS[type]
      ? (unitDefinition(type, civ).speed * walkFrameCount(civ)) / unitStrideDistance(type)
      : 7
    : action === 'idle'
      ? 1.5
      : 4;
function drawSprite(ctx: CanvasRenderingContext2D, a: ArtSprite, x: number, y: number, scale = 1) {
  const ratio = a.pixelRatio ?? 1;
  ctx.drawImage(
    a.canvas,
    x - (a.anchorX / ratio) * scale,
    y - (a.anchorY / ratio) * scale,
    (a.canvas.width / ratio) * scale,
    (a.canvas.height / ratio) * scale,
  );
}
function Thumb({ model, civ, age }: { model: Model; civ: CivId; age: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    void loading(civ, model.kind === 'unit').then(() => {
      if (cancelled || !ref.current) return;
      const a = renderArt(model.kind, model.type, civ, age, 0, 0, 1),
        ctx = ref.current.getContext('2d')!,
        p = a.canvas.getContext('2d')!.getImageData(0, 0, a.canvas.width, a.canvas.height);
      let left = p.width,
        top = p.height,
        right = 0,
        bottom = 0;
      for (let y = 0; y < p.height; y++)
        for (let x = 0; x < p.width; x++)
          if (p.data[(y * p.width + x) * 4 + 3] > 45) {
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
      ctx.clearRect(0, 0, 208, 150);
      const w = Math.max(1, right - left + 1),
        h = Math.max(1, bottom - top + 1),
        fit = Math.min(194 / w, 138 / h);
      ctx.drawImage(
        a.canvas,
        left,
        top,
        w,
        h,
        (208 - w * fit) / 2,
        (150 - h * fit) / 2,
        w * fit,
        h * fit,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [model.kind, model.type, civ, age]);
  return <canvas width="208" height="150" ref={ref} />;
}
function ModelViewer({
  model,
  civ,
  age,
  action,
  dir,
  zoom,
  paused,
  gray,
  footprint,
  comparison = false,
}: {
  model: Model;
  civ: CivId;
  age: number;
  action: string;
  dir: number;
  zoom: number;
  paused: boolean;
  gray: boolean;
  footprint: boolean;
  comparison?: boolean;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLCanvasElement>(null),
    phaseRef = useRef(0);
  useEffect(() => {
    let stop = false,
      raf = 0,
      phase = phaseRef.current,
      last = 0;
    void loading(civ).then(() => {
      const draw = (now: number) => {
        const canvas = ref.current;
        if (stop || !canvas) return;
        const rect = canvas.getBoundingClientRect(),
          ratio = Math.min(devicePixelRatio || 1, 3),
          w = rect.width,
          h = rect.height;
        if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
          canvas.width = Math.round(w * ratio);
          canvas.height = Math.round(h * ratio);
        }
        const c = canvas.getContext('2d')!;
        c.setTransform(ratio, 0, 0, ratio, 0, 0);
        c.imageSmoothingEnabled = true;
        c.imageSmoothingQuality = 'high';
        c.clearRect(0, 0, w, h);
        if (!paused) phase += Math.min(0.05, (now - (last || now)) / 1000);
        last = now;
        phaseRef.current = phase;
        const frameCount =
          action === 'walk' || action.startsWith('carry-') ? walkFrameCount(civ) : 4;
        const frame = Math.floor(phase * animationRate(action, model.type, civ)) % frameCount;
        c.filter = gray ? 'grayscale(1)' : 'none';
        if (comparison) {
          const list = [
            ['villager', 'Dân'],
            ['scout', 'Kỵ binh'],
            ['elephant', civ === 'daiviet' ? 'Tượng binh Đại Việt' : 'Voi Ba Tư'],
            ['deer', 'Hươu'],
          ];
          list.forEach(([type, label], i) => {
            const actorCiv = type === 'elephant' && civ !== 'daiviet' ? 'persian' : civ,
              actorAction = type === 'deer' ? 'graze' : 'walk',
              actorFrames = type === 'deer' ? 4 : walkFrameCount(actorCiv),
              actorFrame =
                Math.floor(phase * animationRate(actorAction, type, actorCiv)) % actorFrames;
            const x = ((i + 0.5) * w) / 4,
              y = h - 27;
            c.strokeStyle = '#a9956740';
            c.beginPath();
            c.ellipse(x, y, 32, 12, 0, 0, Math.PI * 2);
            c.stroke();
            drawSprite(
              c,
              renderArt(
                type === 'deer' ? 'animal' : 'unit',
                type,
                actorCiv,
                age,
                0,
                actorFrame,
                dir,
                true,
                actorAction,
              ),
              x,
              y,
            );
            c.fillStyle = '#c7b58b';
            c.font = '10px Arial';
            c.textAlign = 'center';
            c.fillText(t(label), x, h - 7);
          });
        } else {
          const x = w / 2,
            y = h * (model.kind === 'building' ? 0.55 : 0.67),
            poseAction = action.startsWith('carry-') ? 'carry' : action,
            poseActivity = action.startsWith('carry-') ? action.slice(6) : action,
            a = renderArt(
              model.kind,
              model.type,
              civ,
              age,
              0,
              frame,
              dir,
              true,
              poseAction,
              poseActivity,
            ),
            modelZoom = Math.min(
              zoom,
              (y - 20) / (a.anchorY / (a.pixelRatio ?? 1)),
              Math.max(1, h - 52 - y) /
                Math.max(1, (a.canvas.height - a.anchorY) / (a.pixelRatio ?? 1)),
              (w * 0.85) / (a.canvas.width / (a.pixelRatio ?? 1)),
            );
          const g = c.createRadialGradient(x, y, 20, x, y, w * 0.5);
          g.addColorStop(0, '#58624a');
          g.addColorStop(1, '#182c25');
          c.fillStyle = g;
          c.fillRect(0, 0, w, h);
          c.strokeStyle = '#cebd8920';
          c.lineWidth = 1;
          const gridY =
            y -
            (model.kind === 'building' ? buildingFootprintSize(model.type, age, civ) % 2 : 0) *
              16 *
              modelZoom;
          for (let i = -7; i <= 7; i++) {
            c.beginPath();
            c.moveTo(x + i * 64 * modelZoom - 240 * modelZoom, gridY - 120 * modelZoom);
            c.lineTo(x + i * 64 * modelZoom + 240 * modelZoom, gridY + 120 * modelZoom);
            c.stroke();
            c.beginPath();
            c.moveTo(x + i * 64 * modelZoom + 240 * modelZoom, gridY - 120 * modelZoom);
            c.lineTo(x + i * 64 * modelZoom - 240 * modelZoom, gridY + 120 * modelZoom);
            c.stroke();
          }
          if (footprint) {
            const shape =
              a.footprint ??
              (model.kind === 'building'
                ? [
                    [0, -BUILDINGS[model.type].size * 16],
                    [BUILDINGS[model.type].size * 32, 0],
                    [0, BUILDINGS[model.type].size * 16],
                    [-BUILDINGS[model.type].size * 32, 0],
                  ]
                : undefined);
            c.strokeStyle = '#b9e5c1';
            c.fillStyle = '#b9e5c115';
            if (shape) {
              c.beginPath();
              shape.forEach(([dx, dy], i) =>
                i
                  ? c.lineTo(x + dx * modelZoom, y + dy * modelZoom)
                  : c.moveTo(x + dx * modelZoom, y + dy * modelZoom),
              );
              c.closePath();
              c.fill();
              c.stroke();
            } else {
              c.beginPath();
              c.ellipse(
                x,
                y,
                model.type === 'elephant' ? 45 * modelZoom : 17 * modelZoom,
                model.type === 'elephant' ? 22 * modelZoom : 8 * modelZoom,
                0,
                0,
                Math.PI * 2,
              );
              c.stroke();
            }
          }
          if (footprint && a.connectionPoints) {
            const [start, end] = a.connectionPoints;
            c.strokeStyle = '#b9e5c180';
            c.beginPath();
            c.moveTo(x + start[0] * modelZoom, y + start[1] * modelZoom);
            c.lineTo(x + end[0] * modelZoom, y + end[1] * modelZoom);
            c.stroke();
          }
          drawSprite(c, a, x, y, modelZoom);
          if (footprint && a.connectionPoints) {
            c.fillStyle = '#b9e5c1';
            for (const [dx, dy] of a.connectionPoints) {
              c.beginPath();
              c.arc(x + dx * modelZoom, y + dy * modelZoom, 2.5, 0, Math.PI * 2);
              c.fill();
            }
          }
          if (model.kind === 'unit' && action === 'attack') {
            const angle = (dir * Math.PI) / 4,
              cycle = (phase * 4) % 4;
            c.save();
            c.translate(x, y);
            c.scale(modelZoom, modelZoom);
            drawCombatEffects(c, attackEffects(model.type, { x: 0, y: 0 }, angle, frame));
            if (isProjectileWeapon(model.type) && cycle >= 2)
              for (let i = 0; i < (model.type === 'guardarcher' ? 3 : 1); i++) {
                const spread = model.type === 'guardarcher' ? (i - 1) * 3.5 : 0;
                drawCombatEffects(
                  c,
                  projectileEffects(
                    model.type,
                    { x: 0, y: spread },
                    { x: Math.cos(angle) * 115, y: Math.sin(angle) * 60 + spread },
                    (cycle - 2) / 2,
                  ),
                );
              }
            c.restore();
          }
          c.fillStyle = '#e4d3a4';
          c.font = '10px Arial';
          c.textAlign = 'left';
          c.fillText(t('64 px · một ô đất'), 22, h - 20);
          c.strokeStyle = '#e4d3a4';
          c.beginPath();
          c.moveTo(22, h - 36);
          c.lineTo(22 + 64 * modelZoom, h - 36);
          c.stroke();
        }
        c.filter = 'none';
        raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);
    });
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
    };
  }, [model.kind, model.type, civ, age, action, dir, zoom, paused, gray, footprint, comparison, t]);
  return (
    <canvas
      ref={ref}
      className={comparison ? 'scale-comparison' : 'model-viewer'}
      aria-label={
        comparison
          ? t('So sánh tỉ lệ dân, kỵ binh, voi và hươu')
          : t('Mô hình {name}, {action}', {
              name: model.name,
              action:
                [...actions, ...cargoActions, ['graze', 'Gặm cỏ']].find(
                  ([state]) => state === action,
                )?.[1] ?? action,
            })
      }
    />
  );
}
export function Workshop({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const [civ, setCiv] = useState<CivId>('persian'),
    [age, setAge] = useState(3),
    [category, setCategory] = useState<'unit' | 'building' | 'nature'>('unit'),
    [type, setType] = useState('elephant'),
    [action, setAction] = useState('walk'),
    [dir, setDir] = useState(1),
    [zoom, setZoom] = useState(1.7),
    [paused, setPaused] = useState(false),
    [gray, setGray] = useState(false),
    [footprint, setFootprint] = useState(true);
  const models: Model[] =
    category === 'unit'
      ? civilizationUnits(civ, age).map(([type, d]) => ({ kind: 'unit', type, name: d.name }))
      : category === 'building'
        ? [['towncenter', BUILDINGS.towncenter] as const, ...availableBuildings(civ, age)].map(
            ([type]) => ({ kind: 'building', type, name: buildingName(type, civ) }),
          )
        : [
            ...animals,
            { kind: 'resource', type: 'tree', name: 'Cây rừng' },
            { kind: 'resource', type: 'berry', name: 'Bụi quả' },
            { kind: 'resource', type: 'gold', name: 'Mỏ vàng' },
            { kind: 'resource', type: 'stone', name: 'Mỏ đá' },
          ];
  const model = models.find((m) => m.type === type) ?? models[0];
  const isAnimal = model.kind === 'animal',
    isWorker = ['villager', 'engineer'].includes(model.type),
    states = isAnimal
      ? [
          ['graze', 'Gặm cỏ'],
          ['walk', 'Di chuyển'],
          ['attack', 'Cảnh giác'],
        ]
      : isWorker
        ? [...actions, ...cargoActions]
        : model.kind === 'unit'
          ? [
              actions[0],
              actions[1],
              ...(unitDefinition(model.type, civ).damage > 0 ? [actions[6]] : []),
            ]
          : [actions[0]];
  const currentAction = states.some((s) => s[0] === action) ? action : states[0][0];
  const definition = model.kind === 'unit' ? unitDefinition(model.type, civ) : undefined;
  const bonusNames: Record<string, string> = {
    civilian: 'dân',
    infantry: 'bộ binh',
    ranged: 'quân bắn xa',
    cavalry: 'kỵ binh',
    siege: 'máy công thành',
    building: 'công trình',
    elephant: 'voi',
  };
  const counters = definition
    ? Object.entries(definition.bonuses ?? {})
        .filter(([, multiplier]) => multiplier > 1)
        .map(([kind, multiplier]) =>
          t('×{multiplier} trước {target}', { multiplier, target: bonusNames[kind] }),
        )
        .join(' · ')
    : '';
  return (
    <main
      className="workshop"
      data-civ={civ}
      data-age={age}
      style={themeStyle(civ, age) as React.CSSProperties}
    >
      <BrandHeader civ={civ} age={age} page="workshop" onHome={onBack} />
      <section className="workshop-intro">
        <div>
          <span className="eyebrow">{t('XƯỞNG MÔ HÌNH')}</span>
          <h1>
            {t('Sáu bản sắc.')}
            <br />
            <em>{t('Mỗi đời một diện mạo.')}</em>
          </h1>
          <p>
            {t('Ngắm trang phục, vũ khí và kiến trúc của từng đế chế.')}
            <br />
            {t('Đổi hướng, thử chuyển động và so sánh tỉ lệ ngay trên bàn mô hình.')}
          </p>
        </div>
        <button
          className={gray ? 'active' : ''}
          onClick={() => setGray((v) => !v)}
          aria-pressed={gray}
        >
          {t('◐ Kiểm tra thang xám')}
        </button>
      </section>
      <nav className="workshop-civs" aria-label={t('Nền văn minh trong xưởng')}>
        {civilizations.map((id) => (
          <button key={id} className={civ === id ? 'active' : ''} onClick={() => setCiv(id)}>
            <Emblem civ={id} age={age} size={35} />
            {t(CIVS[id].name)}
          </button>
        ))}
      </nav>
      <div className="workshop-age">
        {AGE_NAMES.map((name, i) => (
          <button
            key={name}
            className={age === i + 1 ? 'active' : ''}
            onClick={() => setAge(i + 1)}
          >
            <b>{['I', 'II', 'III'][i]}</b>
            {t(name)}
          </button>
        ))}
        <span>{t(MATERIALS[civ][age - 1])}</span>
      </div>
      <section className="workshop-body">
        <aside className="model-catalog">
          <nav>
            {(
              [
                ['unit', 'Quân & dân'],
                ['building', 'Kiến trúc'],
                ['nature', 'Thiên nhiên'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                className={category === id ? 'active' : ''}
                onClick={() => setCategory(id)}
              >
                {t(label)}
              </button>
            ))}
          </nav>
          {category === 'unit' && <p className="catalog-identity">{t(CIVS[civ].description)}</p>}
          <div className="model-grid">
            {models.map((m) => (
              <button
                key={m.type}
                className={model.type === m.type ? 'active' : ''}
                onClick={() => setType(m.type)}
              >
                <Thumb model={m} civ={civ} age={age} />
                <span>{t(m.name)}</span>
              </button>
            ))}
          </div>
        </aside>
        <article className="model-detail">
          <header>
            <div>
              <span className="eyebrow">
                {t(CIVS[civ].name).toUpperCase()} · {t('ĐỜI')} {['I', 'II', 'III'][age - 1]}
              </span>
              <h2>{t(model.name)}</h2>
            </div>
            <span className="model-count">{t('{count} mô hình', { count: models.length })}</span>
          </header>
          <ModelViewer
            model={model}
            civ={civ}
            age={age}
            action={currentAction}
            dir={dir}
            zoom={zoom}
            paused={paused}
            gray={gray}
            footprint={footprint}
          />
          <div className="model-controls">
            <GameSelect
              label="Hành động"
              value={currentAction}
              onChange={setAction}
              options={states.map(([value, label]) => ({ value, label }))}
            />
            <GameSelect
              label="Hướng nhìn"
              value={String(dir)}
              onChange={(value) => setDir(Number(value))}
              options={[1, 3, 5, 7].map((direction, index) => ({
                value: String(direction),
                label: ['Đông nam', 'Tây nam', 'Tây bắc', 'Đông bắc'][index],
              }))}
            />
            <button onClick={() => setPaused((v) => !v)} aria-pressed={paused}>
              {paused ? t('▶ Chạy chuyển động') : t('Ⅱ Dừng chuyển động')}
            </button>
          </div>
          <div className="model-adjust">
            <label>
              {t('Thu phóng')}
              <input
                aria-label={t('Thu phóng mô hình')}
                type="range"
                min=".75"
                max="2.2"
                step=".05"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={footprint}
                onChange={(e) => setFootprint(e.target.checked)}
              />{' '}
              {t('Hiện chân đế')}
            </label>
          </div>
          <p className="model-description">
            {model.kind === 'unit'
              ? t(unitDefinition(model.type, civ).description)
              : model.kind === 'building'
                ? t(BUILDINGS[model.type].description)
                : t(
                    'Động vật có nhịp bước và động tác cúi đầu riêng. Các nguồn tài nguyên dùng chung tỉ lệ với chiến trường.',
                  )}
          </p>
          {definition && (
            <div className="model-facts">
              <span>{definition.hp} HP</span>
              <span>
                {definition.damage} {t('sát thương')}
              </span>
              <span>
                {t('Tầm')} {definition.range}
              </span>
              <span>
                {definition.speed} {t('ô/s')}
              </span>
            </div>
          )}
          {counters && <p className="model-counters">{counters}</p>}
          <div className="comparison-label">{t('CÙNG MỘT TỈ LỆ · DÂN / NGỰA / VOI / HƯƠU')}</div>
          <ModelViewer
            model={model}
            civ={civ}
            age={age}
            action="walk"
            dir={dir}
            zoom={1}
            paused={paused}
            gray={gray}
            footprint={false}
            comparison
          />
        </article>
      </section>
      <section className="architecture-line">
        <div>
          <span className="eyebrow">{t('KIẾN TRÚC CÁC ĐẾ CHẾ')}</span>
          <h2>{t('Nhận ra một nền văn minh từ mái nhà.')}</h2>
          <p>{t('Thành chính cùng đời, cùng kích thước ô đất.')}</p>
        </div>
        <div className="architecture-cards">
          {civilizations.map((id) => (
            <button
              key={id}
              onClick={() => {
                setCiv(id);
                setCategory('building');
                setType('towncenter');
                window.scrollTo({ top: 250, behavior: 'smooth' });
              }}
            >
              <Thumb
                model={{ kind: 'building', type: 'towncenter', name: 'Thành chính' }}
                civ={id}
                age={age}
              />
              <Emblem civ={id} age={age} size={28} />
              <span>{t(CIVS[id].name)}</span>
            </button>
          ))}
        </div>
      </section>
      <footer className="workshop-footer">
        <span>{t('REGAVO · Mô hình 2D dùng trực tiếp trong trận đấu')}</span>
        <button onClick={onBack}>{t('Trở về màn hình chơi ↗')}</button>
      </footer>
    </main>
  );
}
