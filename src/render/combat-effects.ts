import { UNITS, type Point } from '../game/data.ts';

const effectWeapon = (type: string) =>
  UNITS[type]?.weapon === 'firearm'
    ? 'musketeer'
    : UNITS[type]?.weapon === 'cannon'
      ? 'cannon'
      : type;

export type EffectShape =
  | { kind: 'line'; points: number[]; color: number; width: number; alpha: number }
  | { kind: 'circle'; x: number; y: number; r: number; color: number; alpha: number }
  | { kind: 'poly'; points: number[]; color: number; alpha: number };
const bows = new Set([
  'archer',
  'crossbowman',
  'guardarcher',
  'horsearcher',
  'villager',
  'engineer',
  'tower',
  'towncenter',
  'fortress',
  'outpost',
]);
const mounted = new Set(['scout', 'lightcavalry', 'horsearcher', 'lancer', 'heavycavalry']);
export const isProjectileWeapon = (type: string) =>
  bows.has(type) || ['musketeer', 'catapult', 'cannon'].includes(effectWeapon(type));
const point = (x: number, y: number, angle: number, length: number): Point => ({
  x: x + Math.cos(angle) * length,
  y: y + Math.sin(angle) * length,
});
const line = (a: Point, b: Point, color: number, width = 1, alpha = 1): EffectShape => ({
  kind: 'line',
  points: [a.x, a.y, b.x, b.y],
  color,
  width,
  alpha,
});

/** Original vector effects. Positions are logical isometric screen pixels. */
export function projectileEffects(
  type: string,
  from: Point,
  to: Point,
  fraction: number,
): EffectShape[] {
  type = effectWeapon(type);
  const f = Math.max(0, Math.min(1, fraction)),
    angle = Math.atan2(to.y - from.y, to.x - from.x);
  const startHeight =
    type === 'arrow'
      ? 95
      : mounted.has(type)
        ? 64
        : type === 'cannon'
          ? 25
          : type === 'catapult'
            ? 32
            : 36;
  const arc = type === 'catapult' ? 75 : type === 'cannon' ? 8 : type === 'musketeer' ? 0 : 20;
  const p = {
    x: from.x + (to.x - from.x) * f,
    y: from.y + (to.y - from.y) * f - startHeight * (1 - f) - 28 * f - Math.sin(f * Math.PI) * arc,
  };
  const shapes: EffectShape[] = [];
  if (type === 'catapult' || type === 'cannon') {
    const back = point(p.x, p.y, angle, -13);
    shapes.push(line(back, p, type === 'cannon' ? 0xc0a074 : 0xb5b3a3, 2, 0.35));
    shapes.push({
      kind: 'circle',
      ...p,
      r: type === 'cannon' ? 3.2 : 4.3,
      color: type === 'cannon' ? 0x383631 : 0x8c887a,
      alpha: 1,
    });
    shapes.push({ kind: 'circle', x: p.x - 1, y: p.y - 1, r: 1, color: 0xe9dabb, alpha: 0.8 });
  } else if (type === 'musketeer') {
    shapes.push(line(point(p.x, p.y, angle, -17), p, 0xffd286, 1.6, 0.85), {
      kind: 'circle',
      ...p,
      r: 1.5,
      color: 0xffecc3,
      alpha: 1,
    });
  } else {
    const tail = point(p.x, p.y, angle, -14),
      tip = point(p.x, p.y, angle, 3),
      left = point(p.x, p.y, angle + Math.PI / 2, 2.1),
      right = point(p.x, p.y, angle - Math.PI / 2, 2.1);
    shapes.push(line(tail, p, 0xc3a76b, 1.4), {
      kind: 'poly',
      points: [tip.x, tip.y, left.x, left.y, right.x, right.y],
      color: 0xf6ead0,
      alpha: 1,
    });
    const feather = point(tail.x, tail.y, angle + Math.PI / 2, 2.4);
    shapes.push(line(feather, point(tail.x, tail.y, angle, 4), 0xe4debf, 1.2));
  }
  return shapes;
}

export function attackEffects(
  type: string,
  origin: Point,
  angle: number,
  phase: number,
): EffectShape[] {
  type = effectWeapon(type);
  if (phase !== 2) return [];
  const height =
    type === 'elephant'
      ? 82
      : mounted.has(type)
        ? 57
        : type === 'ram'
          ? 25
          : type === 'cannon'
            ? 26
            : 31;
  const hand = point(origin.x, origin.y - height, angle, mounted.has(type) ? 12 : 7),
    end = point(hand.x, hand.y, angle, type === 'elephant' ? 48 : 23);
  if (type === 'musketeer' || type === 'cannon') {
    const muzzle = point(hand.x, hand.y, angle, type === 'cannon' ? 31 : 24),
      a = point(muzzle.x, muzzle.y, angle + 1.2, 6),
      b = point(muzzle.x, muzzle.y, angle, 13),
      c = point(muzzle.x, muzzle.y, angle - 1.2, 6);
    return [
      {
        kind: 'poly',
        points: [muzzle.x, muzzle.y, a.x, a.y, b.x, b.y, c.x, c.y],
        color: 0xffd589,
        alpha: 0.85,
      },
      { kind: 'circle', ...muzzle, r: 3, color: 0xfff0c1, alpha: 1 },
      {
        kind: 'circle',
        x: muzzle.x + Math.cos(angle) * 18,
        y: muzzle.y - 4,
        r: 7,
        color: 0xe3ddce,
        alpha: 0.18,
      },
    ];
  }
  if (isProjectileWeapon(type)) return [];
  if (['spear', 'vanguard', 'lancer'].includes(type))
    return [
      line(hand, end, 0xf1ddad, 2, 0.65),
      line(point(end.x, end.y, angle, -5), end, 0xfff0cb, 2, 0.9),
    ];
  if (['ram', 'elephant'].includes(type))
    return Array.from({ length: 4 }, (_, i) => ({
      kind: 'circle' as const,
      x: end.x + (i - 1.5) * 5,
      y: end.y + 5 + (i % 2) * 4,
      r: 2 + (i % 2),
      color: 0xc6b48b,
      alpha: 0.45,
    }));
  const points: number[] = [];
  for (let i = 0; i <= 8; i++) {
    const p = point(hand.x, hand.y, angle - 0.95 + i * 0.22, 24);
    points.push(p.x, p.y);
  }
  return [
    { kind: 'line', points, color: 0xf3e0af, width: 2.2, alpha: 0.5 },
    line(
      point(end.x, end.y, angle + 0.8, -4),
      point(end.x, end.y, angle + 0.8, 4),
      0xffedc6,
      1.3,
      0.85,
    ),
  ];
}

export function drawCombatEffects(ctx: CanvasRenderingContext2D, shapes: readonly EffectShape[]) {
  for (const shape of shapes) {
    ctx.globalAlpha = shape.alpha;
    ctx.fillStyle = ctx.strokeStyle = '#' + shape.color.toString(16).padStart(6, '0');
    ctx.beginPath();
    if (shape.kind === 'circle') {
      ctx.arc(shape.x, shape.y, shape.r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      shape.points.forEach((_, i) => {
        if (i % 2) return;
        if (i) ctx.lineTo(shape.points[i], shape.points[i + 1]);
        else ctx.moveTo(shape.points[i], shape.points[i + 1]);
      });
      if (shape.kind === 'poly') {
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.lineWidth = shape.width;
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
}
