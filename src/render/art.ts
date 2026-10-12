import { renderCenter } from './atlas.ts';
import { renderNature } from './nature.ts';
import { renderWildlife } from './wildlife.ts';
import { renderUnitAtlas } from './units.ts';
import { renderScenery } from './scenery.ts';
import { renderSecondaryBuilding } from './buildings.ts';
import { civilizationRenderer } from './civilization-art.ts';
import { renderBarrier } from './barrier-raster.ts';
import { isBarrier } from './barrier-geometry.ts';
import { buildingSize, type CivId } from '../game/data.ts';
/** Project-authored Canvas miniatures and generated raster atlas samples. */
export interface ArtSprite {
  canvas: HTMLCanvasElement;
  pixelRatio?: number;
  footprint?: readonly [number, number][];
  connectionPoints?: readonly [number, number][];
  anchorX: number;
  anchorY: number;
}

type Point = [number, number];
type Context = CanvasRenderingContext2D;
type Paint = string | CanvasGradient | CanvasPattern;
type Palette = {
  wall: string;
  light: string;
  shade: string;
  roof: string;
  roofLight: string;
  timber: string;
  cloth: string;
  trim: string;
  skin: string;
};

const palettes: Record<string, Palette> = {
  daiviet: {
    wall: '#b8a187',
    light: '#dfcaae',
    shade: '#867462',
    roof: '#41624d',
    roofLight: '#78967a',
    timber: '#704636',
    cloth: '#a34f3e',
    trim: '#c19a57',
    skin: '#c2a07b',
  },
  roman: {
    wall: '#d1bd98',
    light: '#edddbb',
    shade: '#a59172',
    roof: '#934b35',
    roofLight: '#c57950',
    timber: '#594638',
    cloth: '#933c32',
    trim: '#c8b68a',
    skin: '#cfad88',
  },
  mongol: {
    wall: '#c2b293',
    light: '#e8ddbe',
    shade: '#a39579',
    roof: '#ad9b75',
    roofLight: '#e3d4ad',
    timber: '#655443',
    cloth: '#70684e',
    trim: '#7f5036',
    skin: '#c39b74',
  },
  persian: {
    wall: '#c6a97c',
    light: '#e4cca2',
    shade: '#a08762',
    roof: '#a98d64',
    roofLight: '#d0b78b',
    timber: '#69523c',
    cloth: '#547b83',
    trim: '#437d87',
    skin: '#bc926d',
  },
  tang: {
    wall: '#bba688',
    light: '#dbcfb4',
    shade: '#948570',
    roof: '#4b575b',
    roofLight: '#748082',
    timber: '#4a3c32',
    cloth: '#8f493b',
    trim: '#a95641',
    skin: '#c7a37c',
  },
  ottoman: {
    wall: '#cabc9e',
    light: '#e7ddbf',
    shade: '#a7997d',
    roof: '#82654e',
    roofLight: '#ab8865',
    timber: '#594737',
    cloth: '#526b61',
    trim: '#667f71',
    skin: '#bd9874',
  },
};

function polygon(c: Context, points: Point[], fill: Paint, stroke?: string, width = 1) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = width;
    c.stroke();
  }
}
function line(c: Context, points: Point[], color: string, width = 1) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.stroke();
}
function oval(
  c: Context,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: Paint,
  stroke?: string,
  rotation = 0,
) {
  c.beginPath();
  c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rotation, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.lineWidth = 1;
    c.strokeStyle = stroke;
    c.stroke();
  }
}
function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (n & 255) + amount));
  return `rgb(${r},${g},${b})`;
}
/** A restrained material ramp: highlights are warmer and shadows remain legible at RTS scale. */
function material(
  c: Context,
  color: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  depth = 20,
): CanvasGradient {
  const g = c.createLinearGradient(x1, y1, x2, y2);
  g.addColorStop(0, shade(color, Math.round(depth * 0.8)));
  g.addColorStop(0.34, shade(color, Math.round(depth * 0.25)));
  g.addColorStop(0.68, color);
  g.addColorStop(1, shade(color, -depth));
  return g;
}
function random(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
function hash(value: string) {
  let n = 1;
  for (const ch of value) n = (Math.imul(n, 31) + ch.charCodeAt(0)) | 0;
  return n >>> 0;
}
function iso(x: number, y: number, z = 0): Point {
  return [x - y, (x + y) / 2 - z];
}
function tile(c: Context, x: number, y: number, w: number, d: number, fill: string, z = 0) {
  polygon(
    c,
    [
      iso(x - w / 2, y - d / 2, z),
      iso(x + w / 2, y - d / 2, z),
      iso(x + w / 2, y + d / 2, z),
      iso(x - w / 2, y + d / 2, z),
    ],
    fill,
  );
}
function shadow(c: Context, x: number, y: number, rx: number, ry: number) {
  const g = c.createRadialGradient(x - 4, y - 2, 1, x, y, rx);
  g.addColorStop(0, 'rgba(22,25,20,.24)');
  g.addColorStop(1, 'rgba(22,25,20,0)');
  oval(c, x, y, rx, ry, g);
}
function box(
  c: Context,
  x: number,
  y: number,
  w: number,
  d: number,
  h: number,
  p: Palette,
  base = 0,
) {
  const a = iso(x - w / 2, y - d / 2, base + h),
    b = iso(x + w / 2, y - d / 2, base + h);
  const e = iso(x + w / 2, y + d / 2, base + h),
    f = iso(x - w / 2, y + d / 2, base + h);
  polygon(
    c,
    [b, e, iso(x + w / 2, y + d / 2, base), iso(x + w / 2, y - d / 2, base)],
    material(c, p.shade, b[0], b[1], e[0] + 9, e[1] + h, 11),
    '#645b48',
    0.65,
  );
  polygon(
    c,
    [e, f, iso(x - w / 2, y + d / 2, base), iso(x + w / 2, y + d / 2, base)],
    material(c, p.wall, f[0], f[1], e[0], e[1] + h, 17),
    '#786750',
    0.65,
  );
  polygon(c, [a, b, e, f], material(c, p.light, a[0], a[1], e[0], e[1], 9), '#8c8067', 0.6);
  line(c, [f, e, b], p.light, 0.8);
}
function facade(
  c: Context,
  x: number,
  y: number,
  w: number,
  d: number,
  h: number,
  p: Palette,
  age: number,
  timber = false,
) {
  const stroke = timber ? p.timber : 'rgba(82,70,51,.21)';
  for (let z = 8; z < h - 3; z += timber ? 7 : 12) {
    line(
      c,
      [iso(x - w / 2, y + d / 2, z), iso(x + w / 2, y + d / 2, z), iso(x + w / 2, y - d / 2, z)],
      stroke,
      timber ? 1.3 : 0.6,
    );
    if (!timber)
      for (let u = -w / 2 + ((z / 12) % 2 ? 8 : 0); u < w / 2; u += 15)
        line(
          c,
          [iso(x + u, y + d / 2, z), iso(x + u, y + d / 2, z + Math.min(12, h - z))],
          stroke,
          0.6,
        );
  }
  // Door sits on the viewer-facing facade; the lintel follows the isometric plane.
  const doorW = Math.min(11, w * 0.22),
    doorH = Math.min(25, h * 0.75);
  polygon(
    c,
    [
      iso(x - doorW / 2, y + d / 2 + 0.2, 0),
      iso(x + doorW / 2, y + d / 2 + 0.2, 0),
      iso(x + doorW / 2, y + d / 2 + 0.2, doorH),
      iso(x - doorW / 2, y + d / 2 + 0.2, doorH),
    ],
    '#403c31',
    p.trim,
    1.4,
  );
  line(c, [iso(x, y + d / 2 + 0.3, 0), iso(x, y + d / 2 + 0.3, doorH)], '#827052', 0.65);
  for (const u of [-w * 0.31, w * 0.31]) {
    const z = h * 0.6,
      ww = age === 1 ? 5 : 7;
    polygon(
      c,
      [
        iso(x + u - ww / 2, y + d / 2 + 0.4, z - 5),
        iso(x + u + ww / 2, y + d / 2 + 0.4, z - 5),
        iso(x + u + ww / 2, y + d / 2 + 0.4, z + 3),
        iso(x + u - ww / 2, y + d / 2 + 0.4, z + 3),
      ],
      '#45483e',
      p.light,
      1,
    );
    if (age > 1)
      line(
        c,
        [iso(x + u, y + d / 2 + 0.5, z - 5), iso(x + u, y + d / 2 + 0.5, z + 3)],
        p.trim,
        0.7,
      );
  }
}
function roof(
  c: Context,
  x: number,
  y: number,
  w: number,
  d: number,
  h: number,
  rise: number,
  p: Palette,
  civ: string,
  age: number,
) {
  const e = 3 + (civ === 'tang' ? 5 : 0),
    a = iso(x - w / 2 - e, y - d / 2 - e, h),
    b = iso(x + w / 2 + e, y - d / 2 - e, h);
  const f = iso(x - w / 2 - e, y + d / 2 + e, h),
    g = iso(x + w / 2 + e, y + d / 2 + e, h);
  const r1 = iso(x - w / 2 - e, y, h + rise),
    r2 = iso(x + w / 2 + e, y, h + rise);
  polygon(c, [a, b, r2, r1], material(c, p.roofLight, r1[0], r1[1], b[0], b[1], 15), p.timber, 0.7);
  polygon(
    c,
    [r1, r2, g, f],
    material(c, p.roof, r1[0], r1[1] - 3, g[0], g[1] + 4, 24),
    p.timber,
    0.7,
  );
  for (let u = -w / 2; u <= w / 2; u += 5) {
    line(
      c,
      [iso(x + u, y - d / 2 - e, h), iso(x + u, y, h + rise), iso(x + u, y + d / 2 + e, h)],
      shade(p.roof, age === 1 ? 13 : 22),
      0.7,
    );
  }
  for (let v = 1; v < 5; v++) {
    const t = v / 5;
    line(
      c,
      [
        iso(x - w / 2 - e, y + (d / 2 + e) * t, h + rise * (1 - t)),
        iso(x + w / 2 + e, y + (d / 2 + e) * t, h + rise * (1 - t)),
      ],
      shade(p.roof, -12),
      0.65,
    );
  }
  line(c, [r1, r2], p.roofLight, 2);
  if (civ === 'tang' && age > 1) {
    line(c, [[a[0] - 4, a[1] - 4], a, b, [b[0] + 4, b[1] - 4]], p.roofLight, 2.5);
    line(c, [[f[0] - 4, f[1] - 5], f, g, [g[0] + 4, g[1] - 5]], p.roofLight, 2.5);
    line(c, [[r1[0] - 5, r1[1] - 5], r1, r2, [r2[0] + 5, r2[1] - 5]], p.roofLight, 2);
  }
}
function flatRoof(
  c: Context,
  x: number,
  y: number,
  w: number,
  d: number,
  h: number,
  p: Palette,
  age: number,
) {
  const top = iso(x - w / 2, y - d / 2, h);
  const bottom = iso(x + w / 2, y + d / 2, h);
  polygon(
    c,
    [
      iso(x - w / 2 - 1, y - d / 2 - 1, h + 1),
      iso(x + w / 2 + 1, y - d / 2 - 1, h + 1),
      iso(x + w / 2 + 1, y + d / 2 + 1, h + 1),
      iso(x - w / 2 - 1, y + d / 2 + 1, h + 1),
    ],
    material(c, p.light, top[0] - 15, top[1], bottom[0] + 12, bottom[1], 13),
  );
  line(
    c,
    [
      iso(x - w / 2, y + d / 2, h + 1),
      iso(x + w / 2, y + d / 2, h + 1),
      iso(x + w / 2, y - d / 2, h + 1),
    ],
    p.shade,
    1.2,
  );
  if (age > 1) {
    box(c, x, y - d / 2, w + 4, 3, 6, p, h);
    box(c, x + w / 2, y, 3, d, 6, p, h);
    box(c, x, y + d / 2, w + 4, 3, 6, p, h);
    box(c, x - w / 2, y, 3, d, 6, p, h);
    for (let u = -w / 2 + 5; u < w / 2; u += 9)
      line(
        c,
        [iso(x + u, y + d / 2 + 2, h + 3), iso(x + u + 4, y + d / 2 + 2, h + 3)],
        p.trim,
        1.6,
      );
  }
}
function flag(c: Context, x: number, y: number, z: number, team: string, frame = 0) {
  const a = iso(x, y, z);
  line(c, [iso(x, y), a], '#594a35', 1.8);
  polygon(
    c,
    [
      [a[0], a[1] + 2],
      [a[0] + 12, a[1] + 3 + (frame % 2)],
      [a[0] + 10, a[1] + 10],
      [a[0], a[1] + 9],
    ],
    team,
    '#b5a178',
    0.5,
  );
}
function pot(c: Context, x: number, y: number, r = 3, color = '#a77f56') {
  oval(c, x, y, r, r * 0.8, shade(color, -18));
  oval(c, x, y - 3, r, r * 1.2, color);
  oval(c, x, y - 5, r * 0.7, r * 0.3, shade(color, -32));
}
function barrel(c: Context, x: number, y: number) {
  c.fillStyle = '#a07e50';
  c.fillRect(x - 3, y - 7, 6, 8);
  oval(c, x, y - 7, 3, 1.3, '#c8a571');
  line(
    c,
    [
      [x - 3, y - 5],
      [x + 3, y - 5],
    ],
    '#514b3e',
    0.8,
  );
  line(
    c,
    [
      [x - 3, y - 1],
      [x + 3, y - 1],
    ],
    '#514b3e',
    0.8,
  );
}
function dome(c: Context, x: number, y: number, w: number, h: number, color: string) {
  const g = c.createLinearGradient(x - w, y, x + w, y);
  g.addColorStop(0, shade(color, 25));
  g.addColorStop(0.45, color);
  g.addColorStop(1, shade(color, -26));
  c.beginPath();
  c.moveTo(x - w, y);
  c.bezierCurveTo(x - w, y - h * 0.8, x - w * 0.5, y - h, x, y - h);
  c.bezierCurveTo(x + w * 0.5, y - h, x + w, y - h * 0.8, x + w, y);
  c.closePath();
  c.fillStyle = g;
  c.fill();
  oval(c, x, y, w, w * 0.22, shade(color, -10));
  line(
    c,
    [
      [x, y - h],
      [x, y - h - 6],
    ],
    '#b3a07d',
    1,
  );
  oval(c, x, y - h - 7, 1.7, 1.7, '#bba773');
}
function ger(
  c: Context,
  x: number,
  y: number,
  r: number,
  h: number,
  p: Palette,
  age: number,
  team: string,
) {
  const a = iso(x, y);
  const sx = a[0],
    sy = a[1];
  const g = c.createLinearGradient(sx - r, sy, sx + r, sy);
  g.addColorStop(0, p.light);
  g.addColorStop(0.6, p.wall);
  g.addColorStop(1, p.shade);
  c.beginPath();
  c.ellipse(sx, sy - h, r, r * 0.42, 0, Math.PI, 0);
  c.lineTo(sx + r, sy);
  c.ellipse(sx, sy, r, r * 0.42, 0, 0, Math.PI);
  c.closePath();
  c.fillStyle = g;
  c.fill();
  for (let i = -r + 5; i < r; i += 7)
    line(
      c,
      [
        [sx + i, sy - h + Math.sqrt(Math.max(0, 1 - (i * i) / r / r)) * r * 0.42],
        [sx + i, sy + Math.sqrt(Math.max(0, 1 - (i * i) / r / r)) * r * 0.42],
      ],
      'rgba(101,89,65,.2)',
      0.8,
    );
  oval(c, sx, sy, r, r * 0.42, 'rgba(104,82,52,.15)');
  c.beginPath();
  c.moveTo(sx - r - 2, sy - h);
  c.quadraticCurveTo(sx - r * 0.4, sy - h - r * 0.25, sx, sy - h - r * 0.65);
  c.quadraticCurveTo(sx + r * 0.4, sy - h - r * 0.25, sx + r + 2, sy - h);
  c.ellipse(sx, sy - h, r + 2, r * 0.42, 0, 0, Math.PI);
  c.closePath();
  c.fillStyle = p.roofLight;
  c.fill();
  c.strokeStyle = p.timber;
  c.lineWidth = 0.8;
  c.stroke();
  for (let i = -r; i <= r; i += 8)
    line(
      c,
      [
        [sx, sy - h - r * 0.65],
        [sx + i, sy - h + Math.sqrt(Math.max(0, 1 - (i * i) / r / r)) * r * 0.42],
      ],
      'rgba(106,89,59,.25)',
      0.7,
    );
  oval(c, sx, sy - h - r * 0.65, 4.5, 1.8, '#5d5341');
  for (const b of [0.3, 0.7])
    line(
      c,
      [
        [sx - r, sy - h * b],
        [sx - r * 0.6, sy - h * b + r * 0.3],
        [sx, sy - h * b + r * 0.43],
        [sx + r * 0.6, sy - h * b + r * 0.3],
        [sx + r, sy - h * b],
      ],
      age > 1 ? p.trim : p.timber,
      age > 1 ? 2 : 1,
    );
  polygon(
    c,
    [
      [sx - 6, sy + r * 0.38],
      [sx + 6, sy + r * 0.38],
      [sx + 6, sy - h + 8],
      [sx - 6, sy - h + 8],
    ],
    p.timber,
    p.trim,
    1.5,
  );
  if (age > 1)
    polygon(
      c,
      [
        [sx - 7, sy - h + 8],
        [sx + 7, sy - h + 8],
        [sx + 7, sy - h + 13],
        [sx - 7, sy - h + 13],
      ],
      team,
    );
}
function fence(c: Context, x: number, y: number, w: number, d: number, p: Palette) {
  for (const [side, n] of [
    [0, Math.ceil(w / 14)],
    [1, Math.ceil(d / 14)],
  ] as [number, number][]) {
    for (let i = 0; i <= n; i++) {
      const px = side ? x + w / 2 : x - w / 2 + (w * i) / n,
        py = side ? y - d / 2 + (d * i) / n : y + d / 2;
      line(c, [iso(px, py), iso(px, py, 15)], p.timber, 2.5);
    }
    for (const z of [6, 12])
      line(
        c,
        side
          ? [iso(x + w / 2, y - d / 2, z), iso(x + w / 2, y + d / 2, z)]
          : [iso(x - w / 2, y + d / 2, z), iso(x + w / 2, y + d / 2, z)],
        shade(p.timber, 15),
        2,
      );
  }
}
function hall(
  c: Context,
  x: number,
  y: number,
  w: number,
  d: number,
  h: number,
  p: Palette,
  civ: string,
  age: number,
  team: string,
  town = false,
) {
  const b = { ...p };
  if (age === 1) {
    b.wall = '#b8a47d';
    b.light = '#d4c09a';
    b.shade = '#968360';
    b.roof = '#a39165';
    b.roofLight = '#c8b780';
  }
  if (civ === 'mongol') {
    ger(c, x, y, Math.min(w, d) * 0.73, h * 0.58, b, age, team);
    return;
  }
  box(c, x, y, w, d, h, b);
  facade(c, x, y, w, d, h, b, age, age === 1);
  if (civ === 'tang' && age > 1) {
    for (const u of [-w / 2 + 3, -w * 0.2, w * 0.2, w / 2 - 3])
      line(c, [iso(x + u, y + d / 2 + 0.8), iso(x + u, y + d / 2 + 0.8, h)], p.trim, 3);
    line(
      c,
      [iso(x - w / 2, y + d / 2 + 1, h - 4), iso(x + w / 2, y + d / 2 + 1, h - 4)],
      p.timber,
      3,
    );
  }
  if (civ === 'persian') flatRoof(c, x, y, w, d, h, b, age);
  else roof(c, x, y, w, d, h, age === 1 ? 17 : 21, b, civ, age);
  if (civ === 'roman' && age === 3 && town) {
    const fy = y + d / 2 + 12;
    for (let u = -w / 2 + 6; u <= w / 2 - 6; u += 14) {
      const q = iso(x + u, fy);
      line(c, [q, iso(x + u, fy, h - 3)], p.light, 4);
      line(
        c,
        [
          [q[0] - 3, q[1]],
          [q[0] + 3, q[1]],
        ],
        p.light,
        3,
      );
      const t = iso(x + u, fy, h - 3);
      line(
        c,
        [
          [t[0] - 4, t[1]],
          [t[0] + 4, t[1]],
        ],
        p.light,
        3,
      );
    }
    roof(c, x, fy - 3, w + 4, 20, h - 3, 10, p, civ, age);
  }
  if (civ === 'persian' && age === 3 && town) {
    for (let u = -w / 2 + 7; u < w / 2; u += 15) {
      line(c, [iso(x + u, y + d / 2 + 8), iso(x + u, y + d / 2 + 8, h - 3)], p.light, 3.2);
    }
    box(c, x, y + d / 2 + 8, w + 5, 5, 5, { ...p, wall: p.trim, shade: p.trim }, h - 5);
  }
  if (civ === 'ottoman' && age === 3 && town) {
    const q = iso(x, y, h + 13);
    dome(c, q[0], q[1], Math.min(w, d) * 0.32, 22, '#7f9188');
  }
  const trimZ = h - 5;
  if (age > 1 && civ !== 'tang')
    line(
      c,
      [iso(x - w / 2, y + d / 2 + 0.6, trimZ), iso(x + w / 2, y + d / 2 + 0.6, trimZ)],
      p.trim,
      2.2,
    );
}

function drawBuilding(
  c: Context,
  type: string,
  civ: string,
  age: number,
  team: string,
  frame: number,
) {
  const p = palettes[civ] || palettes.roman;
  const big = type === 'towncenter' || type === 'fortress';
  const small = ['house', 'lumbercamp', 'miningcamp', 'granary', 'outpost', 'tower'].includes(type);
  const size = big ? 128 : small ? 64 : 96;
  if (!isBarrier(type)) {
    shadow(c, 13, 12, size * 0.85, size * 0.38);
    tile(c, 0, 0, size - 5, size - 5, '#897f60');
    tile(c, -1, -1, size - 8, size - 8, '#b3a181');
  }
  const rng = random(hash(type + civ));
  for (let i = 0; !isBarrier(type) && i < 22; i++) {
    const x = (rng() - 0.5) * (size - 12),
      y = (rng() - 0.5) * (size - 12);
    const q = iso(x, y);
    line(
      c,
      [
        [q[0], q[1]],
        [q[0] + 3, q[1] + 1],
      ],
      'rgba(226,214,179,.35)',
      0.7,
    );
  }
  if (type === 'farm') {
    const rice = civ === 'daiviet';
    tile(c, 0, 0, 89, 89, rice ? '#657f72' : '#766344');
    for (let row = -36; row <= 36; row += 9) {
      line(c, [iso(-39, row), iso(39, row)], rice ? '#485f49' : '#534b34', 3);
      for (let col = -37; col <= 37; col += 6) {
        const q = iso(col, row);
        line(
          c,
          [
            [q[0], q[1]],
            [q[0] + 1, q[1] - 10],
          ],
          rice ? '#88a865' : '#d2b360',
          1.1,
        );
        line(
          c,
          [
            [q[0] - 3, q[1] - 5],
            [q[0] + 1, q[1] - 8],
            [q[0] + 4, q[1] - 5],
          ],
          rice ? '#b6be73' : '#e1c87d',
          1.5,
        );
      }
    }
    fence(c, 0, 0, 94, 94, p);
    return;
  }
  if (['woodwall', 'stonewall', 'woodgate', 'stonegate'].includes(type)) {
    const wood = type.startsWith('wood'),
      gate = type.endsWith('gate');
    if (wood) {
      for (let x = -39; x <= 39; x += 5) {
        const q = iso(x, 0);
        polygon(
          c,
          [
            [q[0] - 2.6, q[1]],
            [q[0] + 2.6, q[1]],
            [q[0] + 2.6, q[1] - 28],
            [q[0], q[1] - 33],
            [q[0] - 2.6, q[1] - 28],
          ],
          shade(p.timber, (x % 3) * 7),
          p.timber,
          0.7,
        );
      }
      for (const z of [8, 22]) line(c, [iso(-42, 0, z), iso(42, 0, z)], '#aa8251', 2);
    } else {
      box(c, 0, 0, 90, 13, 37, p);
      facade(c, 0, 0, 90, 13, 37, p, age);
      for (let x = -40; x <= 40; x += 10) box(c, x, 0, 6, 13, 6, p, 37);
    }
    if (gate) {
      polygon(c, [iso(-9, 8), iso(9, 8), iso(9, 8, 26), iso(-9, 8, 26)], '#3e382e', p.timber, 2);
      line(c, [iso(0, 8), iso(0, 8, 25)], '#7d6850', 1.3);
    }
    return;
  }
  if (type === 'tower' || type === 'outpost') {
    if (type === 'outpost' || age === 1) {
      for (const [x, y] of [
        [-16, -16],
        [16, -16],
        [-16, 16],
        [16, 16],
      ])
        line(c, [iso(x, y), iso(x, y, 65)], p.timber, 4);
      box(c, 0, 0, 37, 37, 15, { ...p, wall: p.timber, shade: shade(p.timber, -12) }, 49);
      roof(c, 0, 0, 40, 40, 66, 17, p, civ, age);
      for (let z = 4; z < 46; z += 7) line(c, [iso(-8, 20, z), iso(8, 20, z)], '#aa8961', 2);
    } else {
      box(c, 0, 0, 35, 35, 78, p);
      facade(c, 0, 0, 35, 35, 78, p, age);
      box(c, 0, 0, 42, 42, 7, p, 73);
      if (civ === 'tang') roof(c, 0, 0, 43, 43, 82, 19, p, civ, age);
      else if (civ === 'ottoman' && age === 3) dome(c, 0, -83, 20, 23, '#80958b');
      else
        for (let u = -16; u <= 16; u += 11) {
          box(c, u, 20, 7, 5, 9, p, 80);
          box(c, 20, u, 5, 7, 9, p, 80);
        }
    }
    flag(c, -20, -18, 84, team, frame);
    return;
  }
  if (type === 'fortress') {
    if (civ === 'mongol') {
      ger(c, -5, -12, 45, 32, p, age, team);
      ger(c, 27, 33, 23, 21, p, age, team);
      fence(c, 0, 0, 117, 117, p);
      for (const x of [-49, 49]) {
        for (const y of [-49, 49]) {
          for (const u of [-5, 5]) line(c, [iso(x + u, y), iso(x + u, y, 56)], p.timber, 3);
          roof(c, x, y, 18, 18, 58, 8, p, civ, age);
        }
      }
    } else {
      hall(c, 0, -9, 67, 59, 64, p, civ, age, team, true);
      for (const [x, y] of [
        [-43, -43],
        [43, -43],
        [-43, 43],
        [43, 43],
      ]) {
        box(c, x, y, 22, 22, 62, p);
        facade(c, x, y, 22, 22, 62, p, age);
        if (civ === 'tang') roof(c, x, y, 24, 24, 64, 16, p, civ, age);
        else
          for (let u = -7; u <= 7; u += 7) {
            box(c, x + u, y + 11, 4, 4, 7, p, 62);
            box(c, x + 11, y + u, 4, 4, 7, p, 62);
          }
      }
      box(c, 0, 45, 70, 9, 29, p);
      polygon(c, [iso(-8, 50), iso(8, 50), iso(8, 50, 24), iso(-8, 50, 24)], '#484537', p.trim, 2);
    }
    flag(c, -37, -44, 90, team, frame);
    return;
  }
  if (type === 'towncenter') {
    if (civ === 'mongol') {
      ger(c, -16, -18, 41, 27, p, age, team);
      ger(c, 29, 27, 25, 21, p, age, team);
      if (age > 1) ger(c, -40, 29, 19, 17, p, age, team);
      fence(c, 0, 0, 116, 116, p);
    } else {
      hall(c, -5, -12, 78, 58, age === 1 ? 34 : 45 + (age - 2) * 10, p, civ, age, team, true);
      hall(c, 36, 31, 28, 29, 25, p, civ, Math.max(1, age - 1), team);
      if (age > 1) {
        const q = iso(-35, 34, 0);
        line(
          c,
          [
            [q[0] - 15, q[1] + 7],
            [q[0] + 12, q[1] - 7],
          ],
          p.light,
          5,
        );
        line(
          c,
          [
            [q[0] - 14, q[1] + 11],
            [q[0] + 13, q[1] - 3],
          ],
          p.shade,
          3,
        );
      }
    }
    flag(c, -51, -42, age === 1 ? 58 : 78, team, frame);
    const a = iso(26, 50);
    barrel(c, a[0], a[1]);
    pot(c, a[0] + 8, a[1], 4);
    return;
  }
  if (type === 'house') {
    hall(c, 0, 0, 42, 36, age === 1 ? 23 : 30, p, civ, age, team);
    if (age > 1 && civ !== 'mongol') {
      const q = iso(-12, -9, 50);
      box(c, -12, -9, 6, 6, 19, p, 36);
      oval(c, q[0] + 2, q[1] - 9, 5, 3, 'rgba(137,136,124,.2)');
    }
    const q = iso(12, 25);
    pot(c, q[0], q[1]);
    return;
  }
  if (type === 'lumbercamp' || type === 'miningcamp' || type === 'granary') {
    hall(c, -5, -8, 38, 28, 24, p, civ, Math.min(age, 2), team);
    const q = iso(12, 20);
    if (type === 'lumbercamp')
      for (let i = 0; i < 5; i++) {
        line(
          c,
          [
            [q[0] - 17 + i * 4, q[1] - i * 2],
            [q[0] + 12 + i * 4, q[1] - 13 - i * 2],
          ],
          '#79603d',
          4,
        );
        oval(c, q[0] - 17 + i * 4, q[1] - i * 2, 2.4, 2, '#c09c68');
      }
    if (type === 'miningcamp') {
      for (let i = 0; i < 5; i++)
        polygon(
          c,
          [
            [q[0] + i * 4 - 12, q[1]],
            [q[0] + i * 4 - 14, q[1] - 6],
            [q[0] + i * 4 - 9, q[1] - 9],
            [q[0] + i * 4 - 5, q[1] - 3],
          ],
          i % 2 ? '#9ca095' : '#aca994',
          '#62675e',
          0.5,
        );
    }
    if (type === 'granary') {
      for (let i = 0; i < 4; i++)
        oval(c, q[0] + i * 5 - 10, q[1] - 2 - (i % 2) * 3, 4, 6, '#c4ae77', '#96855a');
    }
    return;
  }
  if (type === 'stable') {
    hall(c, -17, -21, 52, 39, 30, p, civ, age, team);
    fence(c, 10, 19, 57, 39, p);
    const q = iso(6, 15);
    drawHorse(c, q[0], q[1], 0.52, 0, 0, p, team, false);
    const h = iso(-12, 38);
    oval(c, h[0], h[1] - 3, 8, 5, '#b8a067');
    line(
      c,
      [
        [h[0] - 5, h[1] - 6],
        [h[0] + 4, h[1] - 1],
      ],
      '#dfc88c',
      1,
    );
    return;
  }
  if (type === 'market') {
    hall(c, -11, -20, 57, 44, 34, p, civ, age, team);
    for (const x of [-19, 19]) {
      box(c, x, 32, 22, 15, 10, { ...p, wall: p.timber, shade: shade(p.timber, -15) });
      for (const u of [-12, 12]) line(c, [iso(x + u, 39), iso(x + u, 39, 28)], p.timber, 2);
      tile(c, x, 32, 28, 22, p.cloth, 29);
      for (let u = -10; u < 12; u += 7) {
        polygon(
          c,
          [iso(x + u, 20, 29), iso(x + u + 3, 20, 29), iso(x + u + 3, 44, 29), iso(x + u, 44, 29)],
          p.light,
        );
      }
      const q = iso(x, 32, 10);
      pot(c, q[0] - 4, q[1], 3);
      oval(c, q[0] + 4, q[1] - 2, 4, 2, '#cbac64');
    }
    flag(c, -40, -37, 58, team, frame);
    return;
  }
  if (type === 'range') {
    hall(c, -16, -19, 46, 39, 31, p, civ, age, team);
    for (const [x, y] of [
      [17, 17],
      [33, 9],
      [21, 34],
    ]) {
      const q = iso(x, y);
      line(
        c,
        [
          [q[0] - 3, q[1]],
          [q[0], q[1] - 19],
          [q[0] + 5, q[1]],
        ],
        p.timber,
        2,
      );
      oval(c, q[0], q[1] - 16, 5, 7, '#d8c89a', '#6b5234');
      oval(c, q[0], q[1] - 16, 3, 4, '#a6533f');
      oval(c, q[0], q[1] - 16, 1.2, 1.7, '#d5c296');
    }
    return;
  }
  if (['workshop', 'foundry', 'armory'].includes(type)) {
    hall(c, -8, -13, 59, 48, 36, p, civ, age, team);
    box(c, -21, -20, 12, 12, 25, { ...p, wall: '#7b7564', shade: '#5d5b51' }, 43);
    const q = iso(17, 32);
    oval(c, q[0], q[1] - 8, 11, 7, '#777d72', '#4a5149');
    oval(c, q[0] - 6, q[1] - 2, 4, 4, '#645946', '#b1a179');
    if (type === 'foundry') {
      oval(c, q[0] + 6, q[1] - 8, 4, 5, '#b68447', '#5d4b36');
      line(
        c,
        [
          [q[0] - 3, q[1] - 13],
          [q[0] + 16, q[1] - 23],
        ],
        '#9f8355',
        7,
      );
      oval(c, q[0] + 16, q[1] - 23, 4, 3, '#454c47');
    } else {
      line(
        c,
        [
          [q[0] - 13, q[1] - 12],
          [q[0] + 13, q[1] - 12],
        ],
        p.timber,
        3,
      );
      for (let i = -9; i <= 9; i += 6)
        line(
          c,
          [
            [q[0] + i, q[1] - 7],
            [q[0] + i + 5, q[1] - 25],
          ],
          '#999e8f',
          2,
        );
    }
    return;
  }
  // Barracks, and any future civic building, remain useful rather than palace-like.
  hall(c, -7, -10, 67, 49, age === 1 ? 30 : 38, p, civ, age, team);
  const q = iso(17, 34);
  line(
    c,
    [
      [q[0] - 12, q[1]],
      [q[0] - 12, q[1] - 23],
      [q[0] + 12, q[1] - 23],
      [q[0] + 12, q[1]],
    ],
    p.timber,
    2.5,
  );
  for (let i = -7; i <= 7; i += 7) {
    line(
      c,
      [
        [q[0] + i, q[1] - 4],
        [q[0] + i + 3, q[1] - 30],
      ],
      '#93876b',
      1.5,
    );
    polygon(
      c,
      [
        [q[0] + i + 3, q[1] - 34],
        [q[0] + i, q[1] - 27],
        [q[0] + i + 5, q[1] - 28],
      ],
      '#a8b3ad',
    );
  }
  flag(c, -32, -27, 57, team, frame);
}

function drawHorse(
  c: Context,
  x: number,
  y: number,
  s: number,
  frame: number,
  dir: number,
  p: Palette,
  team: string,
  ridden = true,
) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  const flip = dir >= 3 && dir <= 5 ? -1 : 1;
  c.scale(flip, 1);
  // Foreshortening changes the silhouette at north/south headings, not the scale of the actor.
  const front = dir === 2 || dir === 6;
  c.transform(
    front ? 0.68 : dir % 2 ? 0.9 : 1,
    dir === 1 || dir === 3 ? 0.12 : dir === 5 || dir === 7 ? -0.12 : 0,
    0,
    1,
    0,
    0,
  );
  const gait = Math.sin((frame * Math.PI) / 2) * 3;
  shadow(c, 2, 2, 27, 8);
  for (const [lx, ly, offset] of [
    [-15, -8, -gait],
    [13, -8, gait],
    [-13, -2, gait],
    [16, -2, -gait],
  ]) {
    line(
      c,
      [
        [lx, ly - 7],
        [lx + offset, ly + 5],
        [lx - offset * 0.5, ly + 13],
      ],
      '#5b4732',
      3.1,
    );
    line(
      c,
      [
        [lx - offset * 0.5 - 2, ly + 13],
        [lx - offset * 0.5 + 3, ly + 13],
      ],
      '#393831',
      2.5,
    );
  }
  line(
    c,
    [
      [-24, -18],
      [-30, -11],
      [-32, -1],
    ],
    '#4c3c2b',
    4,
  );
  oval(c, -1, -17, 24, 12, material(c, '#8b6847', -20, -31, 19, -5, 24), '#655139');
  oval(c, -9, -22, 14, 6, 'rgba(201,165,111,.16)');
  oval(c, -18, -15, 7, 7, material(c, '#92704c', -23, -21, -13, -8, 16));
  polygon(
    c,
    [
      [14, -15],
      [16, -37],
      [22, -43],
      [28, -35],
      [25, -15],
    ],
    material(c, '#a17c56', 16, -43, 29, -14, 21),
    '#6b5339',
    0.65,
  );
  oval(c, 26, -38, 9, 4.7, material(c, '#ad8961', 20, -43, 34, -33, 17), undefined, 0.4);
  oval(c, 32, -35, 4, 3, '#756049');
  polygon(
    c,
    [
      [20, -42],
      [18, -49],
      [23, -46],
    ],
    '#866240',
  );
  polygon(
    c,
    [
      [26, -42],
      [25, -48],
      [29, -43],
    ],
    '#866240',
  );
  line(
    c,
    [
      [17, -38],
      [15, -30],
      [15, -21],
    ],
    '#493c2e',
    4,
  );
  oval(c, 27, -40, 1, 1, '#242c27');
  line(
    c,
    [
      [24, -43],
      [25, -33],
      [31, -33],
    ],
    '#c7b487',
    1,
  );
  line(
    c,
    [
      [26, -34],
      [-3, -25],
    ],
    '#6a5137',
    1,
  );
  polygon(
    c,
    [
      [-11, -24],
      [11, -23],
      [10, -10],
      [-13, -11],
    ],
    material(c, team, -12, -25, 10, -9, 19),
    '#c8b586',
    0.8,
  );
  line(
    c,
    [
      [-9, -19],
      [9, -18],
    ],
    p.trim,
    1.5,
  );
  if (ridden) {
    oval(c, 0, -25, 12, 3, '#4b4034');
    human(c, -2, -25, 0.9, frame, dir, p, team, 'rider');
  }
  c.restore();
}
function human(
  c: Context,
  x: number,
  y: number,
  s: number,
  frame: number,
  dir: number,
  p: Palette,
  team: string,
  type: string,
) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  const moving = type !== 'rider',
    gait = moving ? Math.sin((frame * Math.PI) / 2) * 2.5 : 0;
  const face = dir >= 3 && dir <= 5 ? -1 : 1,
    back = dir === 5 || dir === 6 || dir === 7;
  const soldier = !['villager', 'trader', 'engineer', 'rider'].includes(type);
  const armored = ['sword', 'legionary', 'guard', 'vanguard', 'heavycavalry', 'lancer'].includes(
    type,
  );
  line(
    c,
    [
      [-3, -10],
      [-4 + gait, -3],
      [-4 - gait, 0],
    ],
    '#51473a',
    3,
  );
  line(
    c,
    [
      [3, -10],
      [4 - gait, -3],
      [5 + gait, 0],
    ],
    '#67503b',
    3,
  );
  line(
    c,
    [
      [-6 - gait, 0],
      [-1 - gait, 0],
    ],
    '#38382f',
    2.3,
  );
  line(
    c,
    [
      [3 + gait, 0],
      [8 + gait, 0],
    ],
    '#38382f',
    2.3,
  );
  const cloth = armored ? '#858b81' : p.cloth;
  polygon(
    c,
    [
      [-5.5, -29],
      [5.5, -29],
      [7, -15],
      [4.5, -10],
      [-4.5, -10],
      [-7, -15],
    ],
    material(c, cloth, -7, -30, 8, -10, armored ? 26 : 30),
    '#575143',
    0.6,
  );
  if (armored) {
    polygon(
      c,
      [
        [-5, -28],
        [0, -29],
        [0, -16],
        [-5, -17],
      ],
      material(c, '#a7aea0', -6, -28, 1, -17, 17),
    );
    for (let z = -25; z < -13; z += 4)
      line(
        c,
        [
          [-5, z],
          [5, z],
        ],
        '#667164',
        0.6,
      );
  } else {
    line(
      c,
      [
        [-3, -28],
        [-2, -23],
        [-3, -18],
      ],
      'rgba(216,205,166,.25)',
      0.75,
    );
    line(
      c,
      [
        [3, -25],
        [1, -21],
        [2, -17],
      ],
      'rgba(32,39,30,.24)',
      0.75,
    );
  }
  if (['archer', 'guardarcher', 'horsearcher'].includes(type)) {
    line(
      c,
      [
        [-5, -26],
        [5, -15],
      ],
      '#b7a170',
      1.7,
    );
    polygon(
      c,
      [
        [-10, -31],
        [-6, -32],
        [-4, -19],
        [-8, -18],
      ],
      p.timber,
      '#ae986a',
      0.6,
    );
    for (let i = 0; i < 3; i++)
      line(
        c,
        [
          [-9 + i, -29],
          [-10 + i, -38],
        ],
        '#c3ba96',
        0.7,
      );
  }
  polygon(
    c,
    [
      [-6, -18],
      [6, -18],
      [7, -11],
      [-6, -11],
    ],
    material(c, team, -6, -18, 7, -10, 18),
  );
  line(
    c,
    [
      [-6, -19],
      [6, -19],
    ],
    '#b7a571',
    0.9,
  );
  line(
    c,
    [
      [-1, -18],
      [-2, -11],
    ],
    'rgba(237,223,178,.28)',
    0.7,
  );
  // Arms stay anchored to the shoulders throughout the four gait poses.
  line(
    c,
    [
      [-7, -27],
      [-10 - gait * 0.3, -20],
      [-7, -16],
    ],
    armored ? '#8d9589' : p.cloth,
    3.5,
  );
  line(
    c,
    [
      [7, -27],
      [10 + gait * 0.3, -21],
      [12, -21 + gait],
    ],
    armored ? '#727d70' : p.cloth,
    3.5,
  );
  oval(c, -7, -16, 1.5, 1.7, material(c, p.skin, -8, -18, -5, -14, 16));
  oval(c, 12, -21 + gait, 1.5, 1.7, material(c, p.skin, 11, -23 + gait, 14, -19 + gait, 16));
  line(
    c,
    [
      [-1, -29],
      [-1, -31],
    ],
    p.skin,
    3,
  );
  // Adult proportions: shrink the entire headwear group while retaining neck and foot anchors.
  c.save();
  c.translate(0, -34);
  c.scale(0.78, 0.86);
  c.translate(0, 34);
  oval(c, 0, -34, 4.8, 5.8, material(c, p.skin, -5, -39, 5, -29, 22), '#8e7758');
  oval(c, face * 3.5, -33, 1.8, 1.8, p.skin);
  if (!back) {
    oval(c, face * 2, -35, 0.7, 0.7, '#373d32');
    line(
      c,
      [
        [face * 2, -30],
        [face * 4, -30],
      ],
      '#7c6247',
      0.6,
    );
  }
  if (soldier) {
    c.beginPath();
    c.arc(0, -35, 5.5, Math.PI, Math.PI * 2);
    c.lineTo(6, -33);
    c.lineTo(-6, -33);
    c.closePath();
    c.fillStyle = material(c, armored ? '#a2a99b' : '#6a7264', -6, -40, 6, -31, 24);
    c.fill();
    line(
      c,
      [
        [-6, -34],
        [6, -34],
      ],
      '#d3c7a3',
      1,
    );
    if (type === 'legionary')
      line(
        c,
        [
          [-3, -41],
          [1, -43],
          [4, -40],
        ],
        p.cloth,
        3,
      );
    if (p === palettes.mongol) {
      polygon(
        c,
        [
          [-5, -36],
          [0, -44],
          [5, -36],
        ],
        '#8a8c77',
        '#d0bc88',
        0.6,
      );
      line(
        c,
        [
          [-6, -29],
          [0, -26],
          [6, -29],
        ],
        '#b6a180',
        3,
      );
    }
    if (p === palettes.tang && type !== 'musketeer') {
      line(
        c,
        [
          [0, -41],
          [0, -47],
          [3, -43],
        ],
        p.cloth,
        2,
      );
      line(
        c,
        [
          [-4, -33],
          [-4, -28],
        ],
        '#7c8474',
        2,
      );
    }
    if (p === palettes.persian && ['guard', 'spear', 'guardarcher'].includes(type)) {
      line(
        c,
        [
          [-5, -38],
          [0, -40],
          [5, -38],
        ],
        '#c8be97',
        3,
      );
      line(
        c,
        [
          [4, -37],
          [7, -31],
        ],
        '#c8be97',
        2,
      );
    }
    if (type === 'musketeer') {
      polygon(
        c,
        [
          [-7, -37],
          [-4, -43],
          [4, -43],
          [6, -37],
        ],
        p.cloth,
      );
      line(
        c,
        [
          [-8, -37],
          [8, -37],
        ],
        '#b09c71',
        1.8,
      );
    }
  } else {
    c.beginPath();
    c.arc(0, -37, 5.3, Math.PI, Math.PI * 2);
    c.fillStyle = p.timber;
    c.fill();
    if (type === 'villager') {
      oval(c, 0, -38, 6.3, 1.7, material(c, '#c6ae74', -6, -40, 6, -36, 14));
      polygon(
        c,
        [
          [-3.5, -38],
          [-2.7, -42],
          [2.7, -42],
          [3.5, -38],
        ],
        material(c, '#b89e62', -4, -42, 4, -37, 13),
      );
    }
    if (type === 'rider') {
      line(
        c,
        [
          [-5, -36],
          [5, -36],
        ],
        team,
        2.2,
      );
    }
  }
  c.restore();
  c.restore();
}
function weapon(c: Context, type: string, frame: number, team: string, dir: number) {
  const g = Math.sin((frame * Math.PI) / 2),
    flip = dir >= 3 && dir <= 5 ? -1 : 1;
  c.save();
  c.scale(flip, 1);
  if (['spear', 'guard', 'lancer', 'vanguard'].includes(type)) {
    line(
      c,
      [
        [12, -19],
        [16, -54],
      ],
      '#9c8255',
      1.8,
    );
    polygon(
      c,
      [
        [16, -61],
        [12, -52],
        [18, -53],
      ],
      '#bbc5b8',
      '#687568',
      0.6,
    );
    if (type !== 'lancer') {
      oval(c, -10, -22, 5.5, 8, team, '#bca77a');
      oval(c, -10, -22, 1.5, 2, '#cfc5a4');
    }
  } else if (['archer', 'guardarcher', 'horsearcher'].includes(type)) {
    c.beginPath();
    c.moveTo(12, -39);
    c.quadraticCurveTo(22, -27, 12, -13);
    c.strokeStyle = '#b3975e';
    c.lineWidth = 1.7;
    c.stroke();
    line(
      c,
      [
        [12, -39],
        [12, -13],
      ],
      '#d1c5a0',
      0.7,
    );
    line(
      c,
      [
        [8, -27],
        [24, -27],
      ],
      '#ad9566',
      1,
    );
    polygon(
      c,
      [
        [28, -27],
        [23, -29],
        [23, -25],
      ],
      '#aab4a5',
    );
  } else if (type === 'musketeer') {
    line(
      c,
      [
        [4, -19],
        [24, -38 + g],
      ],
      '#604a31',
      4,
    );
    line(
      c,
      [
        [15, -29],
        [32, -45 + g],
      ],
      '#87988a',
      2,
    );
    line(
      c,
      [
        [24, -36],
        [24, -29],
      ],
      '#c7b17c',
      1,
    );
  } else if (['sword', 'legionary', 'heavycavalry'].includes(type)) {
    line(
      c,
      [
        [12, -21],
        [16, -40 + g],
      ],
      '#b6c2b5',
      3,
    );
    polygon(
      c,
      [
        [16, -45 + g],
        [14, -39 + g],
        [18, -39 + g],
      ],
      '#e0e4cd',
    );
    line(
      c,
      [
        [12, -28],
        [18, -27],
      ],
      '#c3a65f',
      2,
    );
    oval(c, -10, -23, type === 'legionary' ? 6 : 5, 9, team, '#cfb27a');
    if (type === 'legionary')
      line(
        c,
        [
          [-10, -30],
          [-10, -16],
        ],
        '#ddc779',
        1.3,
      );
  } else if (type === 'villager' || type === 'engineer') {
    line(
      c,
      [
        [12, -18],
        [19, -32 + g],
      ],
      '#9f845b',
      2,
    );
    line(
      c,
      [
        [15, -31 + g],
        [23, -28 + g],
      ],
      '#819084',
      3,
    );
  } else if (type === 'trader') {
    line(
      c,
      [
        [12, -20],
        [14, -3],
      ],
      '#a78e5e',
      1.8,
    );
  }
  c.restore();
}
function drawElephant(c: Context, frame: number, dir: number, p: Palette, team: string) {
  c.save();
  const flip = dir >= 3 && dir <= 5 ? -1 : 1;
  c.scale(flip, 1);
  const gait = Math.sin((frame * Math.PI) / 2) * 3;
  c.transform(
    dir === 2 || dir === 6 ? 0.75 : dir % 2 ? 0.94 : 1,
    dir === 1 || dir === 3 ? 0.07 : dir === 5 || dir === 7 ? -0.07 : 0,
    0,
    1,
    0,
    0,
  );
  shadow(c, 1, 7, 43, 13);
  for (const [x, y, g] of [
    [-25, -6, gait],
    [18, -6, -gait],
    [-20, 4, -gait],
    [22, 4, gait],
  ]) {
    polygon(
      c,
      [
        [x - 5, y - 24],
        [x + 7, y - 24],
        [x + 6 + g, y + 4],
        [x - 5 + g, y + 5],
      ],
      material(c, '#7e8578', x - 5, y - 24, x + 8, y + 5, 23),
      '#65705f',
      0.6,
    );
    oval(c, x + g, y + 5, 7, 3, material(c, '#a9aea0', x - 6, y + 2, x + 6, y + 7, 15));
    for (let i = -3; i <= 3; i += 3)
      line(
        c,
        [
          [x + g + i, y + 5],
          [x + g + i, y + 3],
        ],
        '#68745f',
        0.6,
      );
    line(
      c,
      [
        [x - 3 + g, y - 7],
        [x + 5 + g, y - 7],
      ],
      'rgba(38,49,34,.23)',
      0.75,
    );
  }
  const body = c.createLinearGradient(-30, -57, 35, -15);
  body.addColorStop(0, '#a2aaa0');
  body.addColorStop(0.55, '#899286');
  body.addColorStop(1, '#646f62');
  oval(c, -2, -34, 38, 26, body, '#66745d');
  line(
    c,
    [
      [-37, -31],
      [-45, -19],
      [-44, -7],
    ],
    '#677362',
    2,
  );
  line(
    c,
    [
      [-44, -7],
      [-46, -2],
    ],
    '#434e3e',
    3,
  );
  polygon(
    c,
    [
      [-25, -54],
      [22, -54],
      [26, -26],
      [-29, -27],
    ],
    material(c, team, -27, -54, 27, -25, 25),
    '#b4a579',
    1.1,
  );
  for (let x = -20; x <= 20; x += 9)
    line(
      c,
      [
        [x, -52],
        [x + 2, -31],
      ],
      '#d0bb7f',
      1,
    );
  line(
    c,
    [
      [-28, -28],
      [25, -27],
    ],
    '#dec68a',
    2.5,
  );
  polygon(
    c,
    [
      [-7, -45],
      [0, -51],
      [7, -44],
      [0, -37],
    ],
    '#cbb77f',
    '#917d55',
    0.65,
  );
  polygon(
    c,
    [
      [-3, -44],
      [0, -47],
      [3, -44],
      [0, -41],
    ],
    team,
  );
  for (let x = -24; x < 24; x += 8)
    polygon(
      c,
      [
        [x, -28],
        [x + 6, -28],
        [x + 3, -23],
      ],
      '#c8b176',
    );
  oval(c, 31, -35, 20, 22, material(c, '#949e8f', 17, -55, 51, -16, 25), '#687960');
  oval(c, 23, -36, 13, 19, material(c, '#9da696', 12, -54, 33, -18, 24), '#728568', -0.2);
  c.beginPath();
  c.moveTo(24, -50);
  c.quadraticCurveTo(12, -38, 23, -22);
  c.strokeStyle = 'rgba(67,85,55,.35)';
  c.lineWidth = 0.85;
  c.stroke();
  line(
    c,
    [
      [23, -48],
      [18, -35],
      [25, -21],
    ],
    'rgba(207,211,178,.6)',
    0.8,
  );
  for (const z of [-50, -45, -40])
    line(
      c,
      [
        [35, z],
        [42, z + 2],
      ],
      'rgba(62,76,50,.24)',
      0.7,
    );
  c.beginPath();
  c.moveTo(44, -39);
  c.bezierCurveTo(58, -31, 48, -6, 57, -1);
  c.bezierCurveTo(61, 0, 65, -5, 61, -8);
  c.strokeStyle = material(c, '#85927b', 44, -39, 62, 0, 24);
  c.lineWidth = 10;
  c.lineCap = 'round';
  c.stroke();
  line(
    c,
    [
      [48, -27],
      [52, -14],
      [51, -8],
    ],
    '#a7b29c',
    0.9,
  );
  for (let z = -25; z <= -9; z += 4)
    line(
      c,
      [
        [50, z],
        [54, z + 1],
      ],
      'rgba(52,73,41,.25)',
      0.8,
    );
  c.beginPath();
  c.moveTo(43, -25);
  c.quadraticCurveTo(59, -23, 64, -33);
  c.strokeStyle = '#ded8b7';
  c.lineWidth = 4;
  c.stroke();
  oval(c, 43, -40, 1.4, 1.2, '#303f2e');
  oval(c, 42.7, -40.4, 0.35, 0.35, '#dfdfbf');
  polygon(
    c,
    [
      [35, -57],
      [49, -50],
      [45, -43],
      [35, -46],
    ],
    material(c, '#9da797', 35, -57, 49, -43, 23),
    '#c9c6a6',
    0.65,
  );
  box(c, -6, -6, 23, 17, 12, { ...p, wall: '#9d7c4b', shade: '#735e3b', light: '#c4a972' }, 57);
  for (const x of [-16, 6])
    line(
      c,
      [
        [x, -66],
        [x, -82],
      ],
      '#836a43',
      2,
    );
  polygon(
    c,
    [
      [-21, -82],
      [14, -82],
      [16, -74],
      [-23, -74],
    ],
    p.cloth,
    '#bea568',
    1,
  );
  human(c, -6, -64, 0.8, frame, dir, p, team, 'guard');
  line(
    c,
    [
      [6, -80],
      [12, -107],
    ],
    '#b09969',
    1.5,
  );
  polygon(
    c,
    [
      [12, -112],
      [9, -105],
      [14, -105],
    ],
    '#bbc4b0',
  );
  c.restore();
}
function siege(c: Context, type: string, p: Palette, team: string, frame: number) {
  const gait = (frame % 2) * 1;
  shadow(c, 0, 3, 33, 11);
  for (const [x, y] of [
    [-22, 7],
    [20, 7],
    [-12, -7],
    [29, -7],
  ]) {
    oval(c, x, y, 6, 8, '#635540', '#b39a68');
    oval(c, x, y, 1.3, 2, '#b4a173');
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 3)
      line(
        c,
        [
          [x, y],
          [x + Math.cos(a + gait) * 5, y + Math.sin(a + gait) * 7],
        ],
        '#b9a471',
        1,
      );
  }
  box(c, 0, 0, 34, 22, 8, { ...p, wall: p.timber, shade: shade(p.timber, -13) }, 5);
  if (type === 'ram') {
    line(
      c,
      [
        [-25, -14],
        [30, -30],
      ],
      '#8e6f47',
      10,
    );
    oval(c, 30, -30, 7, 6, '#6b7265', '#a7ac94');
    for (const x of [-15, 15])
      line(
        c,
        [
          [x, 0],
          [x, -33],
        ],
        p.timber,
        3,
      );
    polygon(
      c,
      [
        [-29, -36],
        [2, -48],
        [31, -34],
        [1, -22],
      ],
      team,
      '#c3ac78',
      1.2,
    );
    for (let x = -23; x < 24; x += 7)
      line(
        c,
        [
          [x, -35],
          [x + 15, -42],
        ],
        '#c3ae7e',
        1,
      );
  } else if (type === 'cannon') {
    line(
      c,
      [
        [-9, -13],
        [31, -36],
      ],
      '#777e69',
      11,
    );
    oval(c, 31, -36, 6, 7, '#434f43', '#b2b598');
    oval(c, 31, -36, 3, 3.7, '#1f2c26');
    line(
      c,
      [
        [-16, -13],
        [-18, -22],
      ],
      '#9b8c5f',
      3,
    );
    line(
      c,
      [
        [-6, -18],
        [23, -35],
      ],
      '#b1b098',
      1,
    );
  } else {
    for (const x of [-16, 17])
      line(
        c,
        [
          [x, 0],
          [x - 4, -38],
          [x + 13, -1],
        ],
        p.timber,
        4,
      );
    line(
      c,
      [
        [-7, -22],
        [22, -64 + (frame % 2) * 2],
      ],
      '#b09862',
      5,
    );
    oval(c, 21, -63 + (frame % 2) * 2, 8, 5, '#7e7054');
    line(
      c,
      [
        [-7, -22],
        [-25, -7],
      ],
      '#5f5440',
      4,
    );
    line(
      c,
      [
        [-25, -7],
        [22, -63],
      ],
      '#bba776',
      1,
    );
    polygon(
      c,
      [
        [-19, -18],
        [-10, -22],
        [-6, -17],
        [-14, -12],
      ],
      team,
    );
  }
}
function drawUnit(
  c: Context,
  type: string,
  civ: string,
  age: number,
  team: string,
  frame: number,
  dir: number,
) {
  const p = palettes[civ] || palettes.roman;
  if (type === 'elephant') {
    drawElephant(c, frame, dir, p, team);
    return;
  }
  if (['ram', 'catapult', 'cannon'].includes(type)) {
    siege(c, type, p, team, frame);
    return;
  }
  if (['scout', 'lightcavalry', 'heavycavalry', 'horsearcher', 'lancer', 'trader'].includes(type)) {
    drawHorse(c, 0, -9, 1, frame, dir, p, team, true);
    c.save();
    c.translate(-2, -34);
    weapon(c, type, frame, team, dir);
    c.restore();
    if (type === 'trader') {
      const q = iso(-15, -8);
      pot(c, q[0] - 17, q[1] - 5, 5);
      polygon(
        c,
        [
          [-27, -34],
          [-15, -34],
          [-15, -20],
          [-27, -20],
        ],
        '#b49d69',
        '#665838',
        1,
      );
    }
    return;
  }
  shadow(c, 1, 2, 12, 4);
  human(c, 0, 0, 1, frame, dir, p, team, type);
  weapon(c, type, frame, team, dir);
  if (age === 3 && ['guard', 'guardarcher', 'vanguard'].includes(type))
    line(
      c,
      [
        [-6, -29],
        [6, -29],
      ],
      '#cdb576',
      2,
    );
}

function drawAnimal(c: Context, type: string, frame: number, dir: number) {
  c.save();
  const flip = dir >= 3 && dir <= 5 ? -1 : 1;
  c.scale(flip, 1);
  const gait = Math.sin((frame * Math.PI) / 2) * 2;
  c.transform(
    dir === 2 || dir === 6 ? 0.66 : dir % 2 ? 0.9 : 1,
    dir === 1 || dir === 3 ? 0.1 : dir === 5 || dir === 7 ? -0.1 : 0,
    0,
    1,
    0,
    0,
  );
  const boar = type === 'boar',
    goat = ['goat', 'argali'].includes(type),
    gazelle = type === 'gazelle';
  const col = boar
    ? '#685c48'
    : goat
      ? '#a99775'
      : gazelle
        ? '#bc9a60'
        : type === 'sika'
          ? '#94744c'
          : '#a7885d';
  shadow(c, 2, 2, 23, 7);
  const top = boar ? -15 : -21;
  for (const [x, g] of [
    [-15, gait],
    [13, -gait],
    [-11, -gait],
    [16, gait],
  ])
    line(
      c,
      [
        [x, top + 5],
        [x + g, -4],
        [x - g / 2, 3],
      ],
      shade(col, -26),
      boar ? 3 : 2,
    );
  line(
    c,
    [
      [-22, top],
      [-26, top - 5],
    ],
    shade(col, -24),
    2,
  );
  oval(
    c,
    -3,
    top,
    23,
    boar ? 11 : 9,
    material(c, col, -24, top - 11, 20, top + 9, 25),
    shade(col, -19),
  );
  oval(c, -11, top - 3, 12, 4, 'rgba(214,194,145,.13)');
  if (!boar) oval(c, -1, top + 5, 15, 3, material(c, '#b6a379', -15, top + 3, 13, top + 8, 15));
  polygon(
    c,
    [
      [14, top + 1],
      [18, top - (boar ? 8 : 18)],
      [24, top - (boar ? 6 : 20)],
      [24, top - 3],
    ],
    material(c, col, 16, top - 21, 26, top + 2, 22),
  );
  const hy = top - (boar ? 3 : 19);
  oval(c, 27, hy, boar ? 10 : 7, 4.5, material(c, col, 21, hy - 5, 34, hy + 4, 22));
  oval(c, 33, hy + 2, 3, 2, shade(col, -28));
  for (const x of [-15, 13, -11, 16])
    line(
      c,
      [
        [x - 1, 3],
        [x + 1.5, 3],
      ],
      '#4d4a3b',
      1.3,
    );
  polygon(
    c,
    [
      [23, hy - 3],
      [21, hy - 10],
      [26, hy - 5],
    ],
    shade(col, 10),
  );
  polygon(
    c,
    [
      [28, hy - 3],
      [29, hy - 9],
      [31, hy - 5],
    ],
    shade(col, -9),
  );
  oval(c, 29, hy - 1, 0.9, 0.9, '#263128');
  if (boar) {
    line(
      c,
      [
        [32, hy + 5],
        [35, hy + 2],
      ],
      '#ded3aa',
      2,
    );
    for (let x = -18; x < 15; x += 4)
      line(
        c,
        [
          [x, top - 9],
          [x - 2, top - 13],
        ],
        shade(col, -23),
        1,
      );
  } else {
    oval(c, 12, top, 4.5, 5, material(c, '#c1b18b', 8, top - 5, 16, top + 5, 15));
    line(
      c,
      [
        [20, top],
        [25, hy + 3],
      ],
      '#c8b791',
      1.7,
    );
    if (goat) {
      if (type === 'argali') {
        c.beginPath();
        c.arc(20, hy - 8, 8, Math.PI * 0.1, Math.PI * 1.9);
        c.strokeStyle = '#8a8068';
        c.lineWidth = 4;
        c.stroke();
        c.beginPath();
        c.arc(20, hy - 8, 4, 0, Math.PI * 1.6);
        c.strokeStyle = '#b7ad90';
        c.lineWidth = 2;
        c.stroke();
      } else {
        line(
          c,
          [
            [23, hy - 4],
            [19, hy - 15],
            [16, hy - 17],
          ],
          '#80785f',
          2,
        );
        line(
          c,
          [
            [28, hy - 4],
            [27, hy - 15],
          ],
          '#80785f',
          2,
        );
        line(
          c,
          [
            [30, hy + 5],
            [28, hy + 10],
          ],
          shade(col, -20),
          2,
        );
      }
    } else if (gazelle) {
      line(
        c,
        [
          [23, hy - 5],
          [20, hy - 20],
          [22, hy - 25],
        ],
        '#686454',
        2,
      );
      line(
        c,
        [
          [27, hy - 5],
          [27, hy - 22],
          [30, hy - 26],
        ],
        '#686454',
        2,
      );
      line(
        c,
        [
          [0, top + 6],
          [15, top + 5],
        ],
        '#655d43',
        1.4,
      );
    } else {
      for (const hx of [21, 27]) {
        line(
          c,
          [
            [hx, hy - 5],
            [hx - 2, hy - 17],
            [hx - 6, hy - 23],
          ],
          '#a39b7a',
          1.6,
        );
        line(
          c,
          [
            [hx - 2, hy - 15],
            [hx + 4, hy - 20],
            [hx + 3, hy - 25],
          ],
          '#a39b7a',
          1.4,
        );
        line(
          c,
          [
            [hx - 4, hy - 20],
            [hx - 9, hy - 20],
          ],
          '#a39b7a',
          1.3,
        );
      }
    }
    if (['sika', 'fallow'].includes(type))
      for (const [x, y] of [
        [-17, -24],
        [-8, -22],
        [0, -25],
        [8, -22],
        [-12, -17],
        [-3, -19],
        [4, -16],
      ])
        oval(c, x, y, 1.3, 1, '#d4c4a0');
  }
  c.restore();
}
function drawResource(c: Context, type: string, seed: number) {
  const rng = random(seed);
  shadow(c, 5, 4, type === 'tree' ? 24 : 31, type === 'tree' ? 8 : 12);
  if (type === 'tree') {
    const trunk = '#786242';
    polygon(
      c,
      [
        [-5, 1],
        [4, 1],
        [3, -58],
        [-2, -63],
      ],
      trunk,
      '#4c4b32',
      0.8,
    );
    line(
      c,
      [
        [-1, -5],
        [-1, -51],
      ],
      '#a08a59',
      1.2,
    );
    line(
      c,
      [
        [0, -38],
        [-13, -60],
      ],
      trunk,
      4,
    );
    line(
      c,
      [
        [1, -43],
        [15, -71],
      ],
      trunk,
      4,
    );
    for (const [x, y, r] of [
      [-17, -61, 22],
      [15, -70, 22],
      [0, -86, 22],
      [-22, -79, 17],
      [24, -87, 17],
      [-1, -105, 19],
      [-3, -70, 25],
    ] as [number, number, number][]) {
      const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, 1, x, y, r);
      g.addColorStop(0, '#718250');
      g.addColorStop(0.5, '#5b7041');
      g.addColorStop(1, '#3d5938');
      oval(c, x, y, r, r * 0.8, g);
      for (let i = 0; i < 12; i++) {
        const a = rng() * Math.PI * 2,
          rad = rng() * r * 0.82;
        oval(
          c,
          x + Math.cos(a) * rad,
          y + Math.sin(a) * rad * 0.65,
          2.3 + rng() * 2,
          1.5,
          'rgba(152,164,96,.23)',
        );
      }
    }
    line(
      c,
      [
        [-9, 2],
        [-5, -3],
        [1, 1],
        [7, -2],
        [10, 2],
      ],
      '#727351',
      2,
    );
    return;
  }
  if (type === 'berry') {
    for (const [x, y, r] of [
      [-17, -9, 14],
      [7, -12, 16],
      [21, -5, 12],
      [-2, -23, 15],
    ] as [number, number, number][]) {
      oval(c, x, y, r, r * 0.8, '#58704a', '#425b3d');
      for (let i = 0; i < 9; i++) {
        const px = x + (rng() - 0.5) * r * 1.4,
          py = y + (rng() - 0.5) * r;
        oval(c, px, py, 1.8, 1.6, '#935950');
        oval(c, px - 0.5, py - 0.5, 0.5, 0.5, '#d9a18a');
      }
    }
    return;
  }
  if (type === 'wheat') {
    for (let i = 0; i < 28; i++) {
      const x = (rng() - 0.5) * 44,
        y = (rng() - 0.5) * 14,
        h = 13 + rng() * 12;
      line(
        c,
        [
          [x, y],
          [x + 1, y - h],
        ],
        '#bba365',
        1,
      );
      for (let k = 0; k < 3; k++)
        line(
          c,
          [
            [x - 3, y - h + 3 + k * 3],
            [x + 1, y - h + k * 3],
            [x + 4, y - h + 3 + k * 3],
          ],
          '#d2b965',
          1.5,
        );
    }
    return;
  }
  const gold = type === 'gold';
  for (const [x, y, w, h] of [
    [-19, -2, 17, 15],
    [13, -2, 23, 21],
    [-4, -15, 20, 24],
    [28, 4, 12, 12],
    [-28, 6, 12, 10],
  ] as [number, number, number, number][]) {
    const points: Point[] = [
      [x - w * 0.8, y],
      [x - w, y - h * 0.45],
      [x - w * 0.25, y - h],
      [x + w * 0.5, y - h * 0.8],
      [x + w, y - h * 0.2],
      [x + w * 0.6, y + 4],
    ];
    polygon(c, points, gold ? '#a09266' : '#91958b', '#666e61', 0.8);
    polygon(c, [points[0], points[1], points[2], [x, y - h * 0.4]], gold ? '#c0b17d' : '#b6b8a9');
    polygon(c, [[x, y - h * 0.4], points[2], points[3], points[4]], gold ? '#ae9e64' : '#a1a698');
    line(
      c,
      [
        [x - w * 0.3, y - h * 0.8],
        [x + 3, y - h * 0.3],
        [x + w * 0.6, y],
      ],
      gold ? '#d6b94e' : '#7f887a',
      gold ? 2 : 1,
    );
    if (gold)
      for (let i = 0; i < 3; i++)
        polygon(
          c,
          [
            [x - 5 + i * 6, y - 6],
            [x - 3 + i * 6, y - 11],
            [x + i * 6, y - 7],
          ],
          '#d3bd70',
        );
  }
}

/** Draw lazily in the browser, then use Texture.from(result.canvas) in Pixi. */
export function renderArt(
  kind: string,
  type: string,
  civ: string,
  age: number,
  team: number,
  frame = 0,
  dir = 0,
  alive = true,
  action = 'idle',
  activity = '',
): ArtSprite {
  age = Math.max(1, Math.min(3, Math.round(age)));
  frame = ((frame % 4) + 4) % 4;
  dir = ((dir % 8) + 8) % 8;
  const raster =
    kind === 'building'
      ? (civilizationRenderer(civ)?.renderBuilding(type, age, team, dir) ??
        (type === 'towncenter'
          ? renderCenter(civ, age, team)
          : (renderSecondaryBuilding(type, civ, age, team, dir) ?? renderScenery(type, dir))))
      : kind === 'resource'
        ? (renderNature(type) ?? renderScenery(type))
        : kind === 'animal'
          ? renderWildlife(type, frame, dir, alive, action)
          : kind === 'unit'
            ? renderUnitAtlas(type, civ, age, team, frame, dir, action, activity)
            : undefined;
  if (raster) return raster;
  if (kind === 'building' && isBarrier(type)) {
    const source = document.createElement('canvas'),
      wood = type.startsWith('wood');
    source.width = 248;
    source.height = 234;
    const c = source.getContext('2d')!;
    c.translate(124, 168);
    drawBuilding(c, type, civ, 2, team === 0 ? '#5faaa5' : '#b65d4f', 0);
    const half = wood ? 42 : 45;
    return renderBarrier(
      source,
      [124 - half, 168 - half / 2, 124 + half, 168 + half / 2, wood ? 33 : 37],
      buildingSize(type, civ as CivId),
      wood,
      dir % 4 === 0 ? 'x' : 'y',
    );
  }
  const friendly = team === 0 ? '#5faaa5' : '#b65d4f';
  let width = 128,
    height = 136,
    anchorX = 64,
    anchorY = 112;
  if (kind === 'building') {
    const big = ['towncenter', 'fortress'].includes(type),
      small = ['house', 'lumbercamp', 'miningcamp', 'granary', 'tower', 'outpost'].includes(type);
    width = big ? 304 : small ? 180 : 248;
    height = big ? 268 : small ? 210 : 234;
    anchorX = width / 2;
    anchorY = big ? 185 : small ? 149 : 168;
  } else if (kind === 'resource') {
    width = 146;
    height = 166;
    anchorX = 73;
    anchorY = 143;
  } else if (kind === 'animal') {
    width = 120;
    height = 106;
    anchorX = 60;
    anchorY = 84;
  } else if (type === 'elephant') {
    width = 176;
    height = 156;
    anchorX = 88;
    anchorY = 132;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('Canvas2D is required to render Regavo art.');
  c.translate(anchorX, anchorY);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  if (kind === 'building') drawBuilding(c, type, civ, age, friendly, frame);
  else if (kind === 'resource')
    drawResource(
      c,
      ['cypress', 'bamboo', 'oak', 'shrub'].includes(type) ? 'tree' : type,
      hash(type + civ),
    );
  else if (kind === 'animal') drawAnimal(c, type, frame, dir);
  else drawUnit(c, type, civ, age, friendly, frame, dir);
  return { canvas, anchorX, anchorY };
}
