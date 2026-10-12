import { Application, CanvasSource, Container, Graphics, Sprite, Texture } from 'pixi.js';
import {
  BUILDINGS,
  WORLD,
  mapLayout,
  buildingFootprintSize,
  buildingSize,
  buildingName,
  type Point,
  type CivId,
} from '../game/data.ts';
import { canPlaceBuilding, snapBuilding } from '../game/placement.ts';
import type { Command, Entity, Snapshot } from '../game/types.ts';
import { renderArt } from './art.ts';
import { loadBuildingAtlas } from './atlas.ts';
import { loadNatureAtlas } from './nature.ts';
import { loadGroundAtlas, paintGround } from './ground.ts';
import { loadWildlifeAtlas } from './wildlife.ts';
import { loadUnitAtlases } from './units.ts';
import { loadSceneryAtlas, renderScenery } from './scenery.ts';
import { loadSecondaryBuildings } from './buildings.ts';
import { iso, uniso, panCamera, zoomCamera } from './camera.ts';
import { entityAppearance } from './appearance.ts';
import { movementFrame } from './unit-gait.ts';
import { hasFixedIdleFrame } from './civilization-art-data.ts';
import {
  barrierConnections,
  barrierDirection,
  isBarrier,
  type BarrierAxis,
} from './barrier-geometry.ts';
import { joinBarrier } from './barrier-raster.ts';
import { attackEffects, projectileEffects, type EffectShape } from './combat-effects.ts';
export { iso, uniso } from './camera.ts';
type Hooks = {
  command: (c: Command) => void;
  selection: (ids: number[]) => void;
  mode: (s: string) => void;
  cameraMode?: (value: boolean) => void;
};
export class Scene {
  app = new Application();
  world = new Container();
  actors = new Container();
  fog = new Graphics();
  groundMarks = new Graphics();
  marks = new Graphics();
  ghost = new Container();
  entityIndex = new Map<number, Entity>();
  snapshot?: Snapshot;
  selected: number[] = [];
  center: Point = mapLayout()[0];
  zoom = 1;
  buildType = '';
  buildAxis?: BarrierAxis;
  attackMode = false;
  retreatMode = false;
  groups: Record<string, number[]> = {};
  textures = new Map<
    string,
    { texture: Texture; ax: number; ay: number; footprint?: readonly [number, number][] }
  >();
  sprites = new Map<number, Sprite>();
  lastPositions = new Map<number, Point>();
  walkedDistance = new Map<number, number>();
  pointer = { x: 0, y: 0 };
  down?: { x: number; y: number; button: number; center: Point; pan: boolean };
  drag?: { x: number; y: number; w: number; h: number };
  marker?: { p: Point; time: number };
  blocked = false;
  lastClick?: { id: number; time: number };
  lastGroup?: { key: string; time: number };
  ready = false;
  destroyed = false;
  frameTime = 0;
  lastUpdate = 0;
  ground?: Texture;
  spaceHeld = false;
  panMode = false;
  get size() {
    return this.snapshot?.mapSize ?? WORLD;
  }
  get viewportBottom() {
    return (
      this.host.parentElement?.querySelector('.bottom-area')?.getBoundingClientRect().top ??
      this.host.clientHeight - 28
    );
  }
  constructor(
    public host: HTMLDivElement,
    public hooks: Hooks,
  ) {}
  async init(civs?: readonly CivId[]) {
    await Promise.all([
      loadBuildingAtlas(),
      loadNatureAtlas(),
      loadGroundAtlas(),
      loadWildlifeAtlas(),
      loadUnitAtlases(civs),
      loadSceneryAtlas(),
      loadSecondaryBuildings(),
    ]);
    if (this.destroyed) return;
    await this.app.init({
      resizeTo: this.host,
      backgroundColor: 0x101912,
      antialias: true,
      resolution: Math.min(devicePixelRatio || 1, 3),
      autoDensity: true,
      preference: 'webgl',
      preserveDrawingBuffer: false,
    });
    if (this.destroyed) {
      this.app.destroy(true);
      return;
    }
    this.host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.world);
    this.world.sortableChildren = true;
    this.actors.sortableChildren = true;
    this.world.addChild(this.groundMarks, this.actors, this.marks, this.ghost, this.fog);
    this.groundMarks.zIndex = 0.5;
    this.actors.zIndex = 1;
    this.marks.zIndex = 2;
    this.ghost.zIndex = 3;
    this.fog.zIndex = 4;
    const canvas = this.app.canvas;
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onCancel);
    canvas.addEventListener('pointerleave', this.onLeave);
    canvas.addEventListener('contextmenu', this.prevent);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.ready = true;
    this.app.ticker.add(this.draw);
    if (this.snapshot) this.setSnapshot(this.snapshot);
  }
  prevent = (e: Event) => e.preventDefault();
  texture(e: Entity, frame = 0) {
    const kind = e.state === 'packed' ? 'unit' : e.kind,
      type =
        e.state === 'packed'
          ? 'trader'
          : e.type === 'berries'
            ? 'berry'
            : e.type === 'tree' && e.id % 5 === 0
              ? e.civ === 'tang'
                ? 'bamboo'
                : 'cypress'
              : e.type === 'tree' && e.id % 5 === 2
                ? 'oak'
                : e.type,
      dir =
        kind === 'unit' || kind === 'animal'
          ? this.artDir(e.dir)
          : isBarrier(type)
            ? barrierDirection({ ...e, type }, this.snapshot?.entities ?? [])
            : e.dir;
    const target = this.entityIndex.get(e.orders?.[0]?.target ?? -1),
      { action, activity } = entityAppearance(e, target);
    const links =
        kind === 'building' && type.endsWith('wall')
          ? barrierConnections(e, this.snapshot?.entities ?? [])
          : 0,
      junction = !!(links & 3) && !!(links & 12);
    const key = [
      kind,
      type,
      e.civ,
      e.age,
      e.team,
      frame,
      dir,
      e.alive,
      action,
      activity,
      junction ? links : 0,
    ].join('|');
    let t = this.textures.get(key);
    if (!t) {
      const a = junction
        ? joinBarrier(
            renderArt(kind, type, e.civ, e.age, e.team, frame, 0),
            renderArt(kind, type, e.civ, e.age, e.team, frame, 2),
            links,
          )
        : renderArt(kind, type, e.civ, e.age, e.team, frame, dir, e.alive, action, activity);
      t = {
        texture: new Texture({
          source: new CanvasSource({
            resource: a.canvas,
            resolution: a.pixelRatio ?? 1,
            scaleMode: 'linear',
          }),
        }),
        ax: a.anchorX / a.canvas.width,
        ay: a.anchorY / a.canvas.height,
        footprint: a.footprint,
      };
      this.textures.set(key, t);
    }
    return t;
  }
  artDir(d: number) {
    const a = (d * Math.PI) / 4,
      dx = Math.cos(a) - Math.sin(a),
      dy = (Math.cos(a) + Math.sin(a)) * 0.5;
    return (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
  }
  makeGround(terrain: number[]) {
    const textured = paintGround(
      terrain,
      this.snapshot?.config.seed ?? 5,
      this.size,
      this.snapshot?.spawnPoints ?? mapLayout(this.size),
    );
    if (textured) {
      this.ground = Texture.from(textured);
      const sprite = new Sprite(this.ground);
      sprite.position.set(-(this.size * 32 + 32), -24);
      sprite.zIndex = 0;
      this.world.addChild(sprite);
      this.decorateGround(terrain);
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = this.size * 64 + 64;
    canvas.height = this.size * 32 + 64;
    const c = canvas.getContext('2d')!;
    c.translate(this.size * 32 + 32, 24);
    const hash = (x: number, y: number) => {
      let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
    };
    const field = (x: number, y: number) => {
      const xx = Math.floor(x),
        yy = Math.floor(y),
        a = x - xx,
        b = y - yy,
        u = a * a * (3 - 2 * a),
        v = b * b * (3 - 2 * b);
      return (
        (hash(xx, yy) * (1 - u) + hash(xx + 1, yy) * u) * (1 - v) +
        (hash(xx, yy + 1) * (1 - u) + hash(xx + 1, yy + 1) * u) * v
      );
    };
    let seed = this.snapshot?.config.seed ?? 5;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let y = 0; y < this.size; y++)
      for (let x = 0; x < this.size; x++) {
        const p = iso({ x, y }),
          t = terrain[y * this.size + x],
          n = Math.floor(field(x * 0.21, y * 0.21) * 16 + field(x * 0.73, y * 0.73) * 4),
          color =
            t === 1
              ? `rgb(${59 + n},${88 + n},${93 + n})`
              : t === 2
                ? `rgb(${86 + n},${91 + n},${76 + n})`
                : `rgb(${96 + n},${105 + n},${66 + n})`;
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(p.x + 32, p.y + 16);
        c.lineTo(p.x, p.y + 32);
        c.lineTo(p.x - 32, p.y + 16);
        c.closePath();
        c.fillStyle = color;
        c.fill();
        if (t !== 1 && t !== 2) {
          c.fillStyle = 'rgba(136,114,71,.08)';
          for (let i = 0; i < 3; i++) {
            const a = random(),
              b = random();
            c.beginPath();
            c.ellipse(
              p.x + (a - b) * 24,
              p.y + (a + b) * 15,
              7 + random() * 12,
              2 + random() * 5,
              0,
              0,
              Math.PI * 2,
            );
            c.fill();
          }
        }
        for (let i = 0; i < (t === 1 ? 3 : 13); i++) {
          const a = random(),
            b = random(),
            xx = p.x + (a - b) * 30,
            yy = p.y + (a + b) * 15;
          c.strokeStyle = t === 1 ? 'rgba(177,202,188,.15)' : 'rgba(195,188,112,.16)';
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(xx, yy);
          c.lineTo(xx + (random() - 0.5) * 5, yy - 2 - random() * 3);
          c.stroke();
        }
        if (t === 2) {
          c.save();
          c.beginPath();
          c.moveTo(p.x, p.y);
          c.lineTo(p.x + 32, p.y + 16);
          c.lineTo(p.x, p.y + 32);
          c.lineTo(p.x - 32, p.y + 16);
          c.closePath();
          c.clip();
          c.fillStyle = 'rgba(57,68,55,.38)';
          c.beginPath();
          c.moveTo(p.x - 22, p.y + 19);
          c.lineTo(p.x - 6, p.y - 16 - random() * 12);
          c.lineTo(p.x + 20, p.y + 21);
          c.closePath();
          c.fill();
          c.fillStyle = 'rgba(178,178,140,.35)';
          c.beginPath();
          c.moveTo(p.x - 22, p.y + 19);
          c.lineTo(p.x - 6, p.y - 16);
          c.lineTo(p.x - 4, p.y + 18);
          c.closePath();
          c.fill();
          c.restore();
        }
      }
    // Soft dirt lanes around the two settlements; visual detail only.
    for (const base of (this.snapshot?.spawnPoints ?? mapLayout(this.size)).slice(0, 2)) {
      const side = base.x < this.size / 2 ? 1 : -1;
      for (const end of [
        { x: base.x + side * 7, y: base.y + side * 5 },
        { x: base.x - side * 4, y: base.y + side * 7 },
        { x: base.x - side * 4, y: base.y - side * 7 },
      ]) {
        const a = iso(base),
          b = iso(end);
        c.lineCap = 'round';
        for (const [width, color] of [
          [35, 'rgba(162,140,92,.12)'],
          [22, 'rgba(154,133,85,.18)'],
          [11, 'rgba(182,155,97,.15)'],
        ] as [number, string][]) {
          c.lineWidth = width;
          c.strokeStyle = color;
          c.beginPath();
          c.moveTo(a.x, a.y + 12);
          c.bezierCurveTo(
            a.x + (b.x - a.x) * 0.25,
            a.y + 20,
            a.x + (b.x - a.x) * 0.72,
            b.y + 8,
            b.x,
            b.y + 12,
          );
          c.stroke();
        }
      }
    }
    this.ground = Texture.from(canvas);
    const s = new Sprite(this.ground);
    s.position.set(-(this.size * 32 + 32), -24);
    s.zIndex = 0;
    this.world.addChild(s);
  }
  decorateGround(terrain: number[]) {
    for (let y = 2; y < this.size - 2; y++)
      for (let x = 2; x < this.size - 2; x++) {
        const cliff = terrain[y * this.size + x] === 2 && (x + y) % 2 === 0,
          grass = terrain[y * this.size + x] === 0 && (Math.imul(x + 1, 37) + y * 19) % 53 === 0;
        if (!cliff && !grass) continue;
        const type = cliff ? 'cliff' : 'grass',
          key = `decoration:${type}`;
        let t = this.textures.get(key);
        if (!t) {
          const art = renderScenery(type);
          if (!art) continue;
          t = {
            texture: new Texture({
              source: new CanvasSource({
                resource: art.canvas,
                resolution: art.pixelRatio ?? 1,
                scaleMode: 'linear',
              }),
            }),
            ax: art.anchorX / art.canvas.width,
            ay: art.anchorY / art.canvas.height,
          };
          this.textures.set(key, t);
        }
        const sprite = new Sprite(t.texture),
          point = iso({ x: x + 0.25, y: y + 0.25 });
        sprite.anchor.set(t.ax, t.ay);
        sprite.position.set(point.x, point.y);
        sprite.zIndex = x + y + 0.5;
        sprite.scale.set(cliff ? 0.75 : 1);
        this.actors.addChild(sprite);
      }
  }
  setSnapshot(s: Snapshot) {
    this.snapshot = s;
    this.entityIndex = new Map(s.entities.map((e) => [e.id, e]));
    if (!this.ready) return;
    if (!this.ground) this.makeGround(s.terrain);
    this.lastUpdate = performance.now();
    const ids = new Set(s.entities.map((e) => e.id));
    for (const [id, sprite] of this.sprites)
      if (!ids.has(id)) {
        sprite.destroy();
        this.sprites.delete(id);
        this.lastPositions.delete(id);
        this.walkedDistance.delete(id);
      }
    for (const e of s.entities) {
      let sprite = this.sprites.get(e.id);
      if (!sprite) {
        const t = this.texture(e);
        sprite = new Sprite({ texture: t.texture, roundPixels: true });
        sprite.anchor.set(t.ax, t.ay);
        const start = iso(e);
        sprite.position.set(start.x, start.y);
        this.actors.addChild(sprite);
        this.sprites.set(e.id, sprite);
      }
      this.lastPositions.set(e.id, { x: sprite.x, y: sprite.y });
      sprite.zIndex = e.x + e.y;
      sprite.alpha = e.progress < 1 ? 0.35 + e.progress * 0.65 : 1;
      sprite.tint = !e.alive ? 0x8e8265 : 0xffffff;
      sprite.scale.set(e.kind === 'resource' ? 0.78 : 1);
    }
    if (this.textures.size > 256) {
      const used = new Set([...this.sprites.values()].map((sprite) => sprite.texture));
      for (const [key, entry] of this.textures) {
        if (this.textures.size <= 256) break;
        if (key.startsWith('decoration:') || used.has(entry.texture)) continue;
        this.textures.delete(key);
        entry.texture.destroy(true);
      }
    }
    const valid = this.selected.filter((id) => s.entities.some((e) => e.id === id));
    if (valid.length !== this.selected.length) {
      this.selected = valid;
      this.hooks.selection(valid);
    }
    this.fog.clear();
    for (let y = 0; y < this.size; y++)
      for (let x = 0; x < this.size; x++)
        if (!s.vision[y * this.size + x]) {
          const p = iso({ x, y });
          this.fog
            .poly([p.x, p.y, p.x + 32, p.y + 16, p.x, p.y + 32, p.x - 32, p.y + 16])
            .fill({ color: 0x101711, alpha: 0.985 });
        }
  }
  draw = () => {
    if (!this.snapshot || !this.ready) return;
    const dt = Math.min(0.05, this.app.ticker.deltaMS / 1000);
    if (!this.snapshot.paused) this.frameTime += dt;
    const rect = this.host.getBoundingClientRect(),
      w = rect.width,
      h = rect.height,
      bottom = this.viewportBottom;
    if (
      !this.blocked &&
      !this.panMode &&
      !this.spaceHeld &&
      !this.down &&
      this.pointer.x > 0 &&
      this.pointer.x < w &&
      this.pointer.y > 55 &&
      this.pointer.y < bottom
    ) {
      let dx = 0,
        dy = 0;
      if (this.pointer.x < 12) dx = -1;
      else if (this.pointer.x > w - 12) dx = 1;
      if (this.pointer.y < 65) dy = -1;
      else if (this.pointer.y > bottom - 12) dy = 1;
      if (dx || dy) this.pan(dx * dt * 450, dy * dt * 450);
    }
    const pos = iso(this.center);
    this.world.position.set(w / 2 - pos.x * this.zoom, h * 0.44 - pos.y * this.zoom);
    this.world.scale.set(this.zoom);
    const s = this.snapshot;
    this.marks.clear();
    this.groundMarks.clear();
    for (const e of s.entities) {
      const sprite = this.sprites.get(e.id);
      if (!sprite) continue;
      const target = iso(e),
        from = this.lastPositions.get(e.id) ?? target,
        fraction = Math.min(1, (performance.now() - this.lastUpdate) / 120),
        next = {
          x: from.x + (target.x - from.x) * fraction,
          y: from.y + (target.y - from.y) * fraction,
        };
      if (e.kind === 'unit' && e.state === 'walk' && !s.paused) {
        const delta = uniso({ x: next.x - sprite.x, y: next.y - sprite.y }),
          distance = Math.hypot(delta.x, delta.y);
        if (distance < 2)
          this.walkedDistance.set(e.id, (this.walkedDistance.get(e.id) ?? 0) + distance);
      }
      const animated = e.kind === 'unit' || e.kind === 'animal',
        frame =
          e.kind === 'unit' && e.state === 'attack' && e.attackPhase !== undefined
            ? e.attackPhase
            : e.kind === 'unit' && e.state === 'walk'
              ? movementFrame(e.type, this.walkedDistance.get(e.id) ?? 0, e.civ)
              : e.kind === 'unit' && hasFixedIdleFrame(e.civ) && e.state === 'idle'
                ? 0
                : animated
                  ? Math.floor(
                      (this.frameTime * s.speed + e.id * 0.17) *
                        (e.state === 'walk'
                          ? 7
                          : e.state === 'idle' || e.state === 'graze'
                            ? 1.5
                            : 4),
                    ) % 4
                  : 0;
      const t = this.texture(e, frame);
      sprite.texture = t.texture;
      sprite.anchor.set(t.ax, t.ay);
      sprite.position.set(next.x, next.y);
      const p = { x: sprite.x, y: sprite.y };
      const selected = this.selected.includes(e.id);
      if (selected) {
        if (e.kind === 'building' && e.state !== 'packed') {
          const z = buildingFootprintSize(e.type, e.age, e.civ) * 16,
            outline = t.footprint?.flatMap(([dx, dy]) => {
              const outer = 1 + 4 / Math.max(1, Math.hypot(dx, dy));
              return [p.x + dx * outer, p.y + dy * outer];
            }) ?? [p.x, p.y - z, p.x + z * 2, p.y, p.x, p.y + z, p.x - z * 2, p.y];
          this.groundMarks.poly(outline).stroke({ color: 0xaad6bd, width: 1.6 });
        } else
          this.groundMarks
            .ellipse(
              p.x,
              p.y + 2,
              e.type === 'elephant' ? 45 : e.kind === 'animal' ? 14 : 17,
              e.type === 'elephant' ? 22 : e.kind === 'animal' ? 7 : 8,
            )
            .stroke({ color: 0xace0cd, width: 1.5 });
      }
      if ((selected || e.hp < e.maxHp) && e.team >= 0) {
        const y = p.y - t.ay * t.texture.height - 8,
          width = e.kind === 'building' ? 54 : 32;
        this.marks.rect(p.x - width / 2, y, width, 4).fill(0x1b2722);
        this.marks
          .rect(p.x - width / 2, y, width * Math.max(0, e.hp / e.maxHp), 4)
          .fill(e.team === 0 ? 0x85b5a3 : 0xbb6956);
      }
      if (e.progress < 1) {
        this.marks.rect(p.x - 25, p.y + 14, 50, 3).fill(0x403a2d);
        this.marks.rect(p.x - 25, p.y + 14, e.progress * 50, 3).fill(0xd8b477);
      }
      if (selected && e.rally) {
        const q = iso(e.rally);
        this.marks
          .moveTo(p.x, p.y)
          .lineTo(q.x, q.y)
          .stroke({ color: 0xd7c389, width: 1, alpha: 0.6 });
        this.flag(q);
      }
      if (selected && e.shield) this.marks.circle(p.x, p.y - 29, 4).fill(0xbcd1c0);
      if (selected && e.deployed) this.marks.rect(p.x - 18, p.y + 8, 36, 2).fill(0xd4ba80);
      if (e.kind === 'unit' && e.state === 'attack' && e.attackPhase === 2) {
        const target = this.entityIndex.get(e.strike?.target ?? e.orders[0]?.target ?? -1),
          q = target
            ? iso(target)
            : iso({
                x: e.x + Math.cos((e.dir * Math.PI) / 4),
                y: e.y + Math.sin((e.dir * Math.PI) / 4),
              });
        this.effects(attackEffects(e.type, p, Math.atan2(q.y - p.y, q.x - p.x), 2));
      }
    }
    for (const projectile of s.projectiles) {
      const elapsed = s.paused
        ? 0
        : Math.min(0.12, (performance.now() - this.lastUpdate) / 1000) * s.speed;
      const spread = projectile.type === 'guardarcher' ? ((projectile.id % 3) - 1) * 3.5 : 0,
        from = iso(projectile),
        to = iso({ x: projectile.tx, y: projectile.ty });
      this.effects(
        projectileEffects(
          projectile.type,
          { x: from.x, y: from.y + spread },
          { x: to.x, y: to.y + spread },
          1 - (projectile.remaining - elapsed) / projectile.duration,
        ),
      );
    }
    if (this.marker && performance.now() - this.marker.time < 700) {
      const p = iso(this.marker.p),
        r = 5 + (performance.now() - this.marker.time) / 70;
      this.marks.ellipse(p.x, p.y, r, r / 2).stroke({
        color: 0xf1d399,
        width: 1.4,
        alpha: 1 - (performance.now() - this.marker.time) / 700,
      });
    }
    if (this.drag) {
      const a = this.screenToWorld({ x: this.drag.x, y: this.drag.y }),
        b = this.screenToWorld({ x: this.drag.x + this.drag.w, y: this.drag.y + this.drag.h }),
        aa = iso(a),
        bb = iso(b);
      this.marks
        .rect(
          Math.min(aa.x, bb.x),
          Math.min(aa.y, bb.y),
          Math.abs(bb.x - aa.x),
          Math.abs(bb.y - aa.y),
        )
        .fill({ color: 0x75b6a1, alpha: 0.12 })
        .stroke({ color: 0xa3d5bb, width: 1 / this.zoom });
    }
    this.drawGhost();
  };
  effects(shapes: readonly EffectShape[]) {
    for (const shape of shapes) {
      if (shape.kind === 'circle')
        this.marks
          .circle(shape.x, shape.y, shape.r)
          .fill({ color: shape.color, alpha: shape.alpha });
      else if (shape.kind === 'poly')
        this.marks.poly(shape.points).fill({ color: shape.color, alpha: shape.alpha });
      else {
        shape.points.forEach((_, i) => {
          if (i % 2) return;
          if (i) this.marks.lineTo(shape.points[i], shape.points[i + 1]);
          else this.marks.moveTo(shape.points[i], shape.points[i + 1]);
        });
        this.marks.stroke({ color: shape.color, width: shape.width, alpha: shape.alpha });
      }
    }
  }
  flag(p: Point) {
    this.marks
      .moveTo(p.x, p.y)
      .lineTo(p.x, p.y - 24)
      .stroke({ color: 0xe0d4ab, width: 1.5 });
    this.marks.poly([p.x, p.y - 24, p.x + 13, p.y - 19, p.x, p.y - 15]).fill(0x91beb0);
  }
  screenToWorld(p: Point) {
    return uniso({ x: (p.x - this.world.x) / this.zoom, y: (p.y - this.world.y) / this.zoom });
  }
  pan(dx: number, dy: number) {
    this.center = panCamera(this.center, dx, dy, this.zoom, this.size);
  }
  focus(p: Point) {
    this.center = { ...p };
  }
  select(ids: number[]) {
    this.selected = ids;
    this.hooks.selection(ids);
  }
  pick(screen: Point): Entity | undefined {
    if (!this.snapshot) return;
    const painted = this.snapshot.entities
      .filter((e) => {
        const sprite = this.sprites.get(e.id);
        if (!sprite) return false;
        const bounds = sprite.getBounds();
        if (
          screen.x < bounds.x ||
          screen.y < bounds.y ||
          screen.x >= bounds.x + bounds.width ||
          screen.y >= bounds.y + bounds.height
        )
          return false;
        const canvas = sprite.texture.source.resource as HTMLCanvasElement;
        if (typeof canvas?.getContext !== 'function') return false;
        const x = Math.floor(((screen.x - bounds.x) / bounds.width) * canvas.width),
          y = Math.floor(((screen.y - bounds.y) / bounds.height) * canvas.height);
        return (canvas.getContext('2d')?.getImageData(x, y, 1, 1).data[3] ?? 0) > 60;
      })
      .sort(
        (a, b) => (this.sprites.get(b.id)?.zIndex ?? 0) - (this.sprites.get(a.id)?.zIndex ?? 0),
      );
    if (painted.length) return painted[0];
    const point = this.screenToWorld(screen);
    const candidates = this.snapshot.entities.filter((e) => {
      if (e.kind === 'building')
        return (
          Math.abs(e.x - point.x) <= buildingFootprintSize(e.type, e.age, e.civ) / 2 + 0.05 &&
          Math.abs(e.y - point.y) <= buildingFootprintSize(e.type, e.age, e.civ) / 2 + 0.05
        );
      const p = iso(e),
        q = iso(point);
      return (
        Math.hypot(p.x - q.x, (p.y - q.y) * 1.8) <
        (e.type === 'elephant' ? 35 : e.kind === 'resource' ? 26 : 22)
      );
    });
    return candidates.sort(
      (a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y),
    )[0];
  }
  setBuild(type: string) {
    if (type && this.panMode) this.setPanMode(false);
    this.buildType = type;
    this.buildAxis = undefined;
    this.attackMode = false;
    this.retreatMode = false;
    this.buildHint();
  }
  setCombatMode(mode: 'attack' | 'retreat') {
    this.setBuild('');
    this.attackMode = mode === 'attack';
    this.retreatMode = mode === 'retreat';
    this.hooks.mode(
      mode === 'attack' ? 'Chọn điểm tấn công · Esc để hủy' : 'Chọn điểm rút lui · Esc để hủy',
    );
  }
  buildHint() {
    const type = this.buildType;
    this.hooks.mode(
      type
        ? `Đặt ${buildingName(type, this.snapshot?.player.civ ?? 'roman')}${isBarrier(type) ? ' · R để xoay · Shift để xây liên tiếp' : ''} · Esc để hủy`
        : '',
    );
  }
  drawGhost() {
    this.ghost.removeChildren().forEach((c) => c.destroy());
    if (
      !this.buildType ||
      !this.snapshot ||
      this.pointer.x < 0 ||
      this.pointer.y < 0 ||
      this.blocked
    )
      return;
    const point = snapBuilding(
        this.buildType,
        this.screenToWorld(this.pointer),
        this.snapshot.player.civ,
      ),
      p = iso(point);
    const e = {
        ...point,
        kind: 'building',
        type: this.buildType,
        civ: this.snapshot.player.civ,
        age: this.snapshot.player.age,
        team: 0,
        dir: 0,
        barrierAxis: this.buildAxis,
        state: 'idle',
        alive: true,
        orders: [],
      } as unknown as Entity,
      t = this.texture(e),
      sprite = new Sprite({ texture: t.texture, roundPixels: true });
    sprite.anchor.set(t.ax, t.ay);
    sprite.position.set(p.x, p.y);
    sprite.alpha = 0.7;
    const valid = canPlaceBuilding(
      this.buildType,
      point,
      this.size,
      this.snapshot.terrain,
      this.snapshot.entities,
      this.snapshot.vision,
      this.snapshot.player.civ,
    );
    sprite.tint = valid ? 0xffffff : 0xd47474;
    const g = new Graphics(),
      r = buildingSize(this.buildType, this.snapshot.player.civ) * 16,
      outline = t.footprint?.flatMap(([dx, dy]) => [p.x + dx, p.y + dy]) ?? [
        p.x,
        p.y - r,
        p.x + r * 2,
        p.y,
        p.x,
        p.y + r,
        p.x - r * 2,
        p.y,
      ];
    g.poly(outline)
      .fill({ color: valid ? 0x78b799 : 0xc06b55, alpha: 0.22 })
      .stroke({ color: valid ? 0xa6d5b5 : 0xe2a18b, width: 1.5 });
    this.ghost.addChild(g, sprite);
  }
  local(e: PointerEvent) {
    const r = this.host.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  onDown = (e: PointerEvent) => {
    this.pointer = this.local(e);
    if (this.blocked) return;
    this.down = {
      ...this.pointer,
      button: e.button,
      center: { ...this.center },
      pan: e.button === 1 || (e.button === 0 && (this.spaceHeld || e.altKey || this.panMode)),
    };
    this.app.canvas.setPointerCapture(e.pointerId);
    if (e.button === 1) e.preventDefault();
  };
  onMove = (e: PointerEvent) => {
    const p = this.local(e),
      prev = this.pointer;
    this.pointer = p;
    if (this.down?.pan) {
      this.pan(prev.x - p.x, prev.y - p.y);
      return;
    }
    if (
      this.down?.button === 0 &&
      !this.buildType &&
      Math.hypot(p.x - this.down.x, p.y - this.down.y) > 7
    )
      this.drag = { x: this.down.x, y: this.down.y, w: p.x - this.down.x, h: p.y - this.down.y };
  };
  onLeave = () => {
    if (!this.down) this.pointer = { x: -1, y: -1 };
  };
  onCancel = () => {
    this.down = undefined;
    this.drag = undefined;
    this.pointer = { x: -1, y: -1 };
  };
  onUp = (e: PointerEvent) => {
    if (!this.down || !this.snapshot) return;
    const screen = this.local(e),
      point = this.screenToWorld(screen);
    const button = this.down.button;
    if (this.down.pan) {
      this.down = undefined;
      this.drag = undefined;
      return;
    }
    if (button === 0) {
      if (this.buildType) {
        const at = snapBuilding(this.buildType, point, this.snapshot.player.civ);
        if (
          canPlaceBuilding(
            this.buildType,
            at,
            this.size,
            this.snapshot.terrain,
            this.snapshot.entities,
            this.snapshot.vision,
            this.snapshot.player.civ,
          )
        ) {
          this.hooks.command({
            type: 'build',
            building: this.buildType,
            x: at.x,
            y: at.y,
            builders: this.selected,
            axis: isBarrier(this.buildType)
              ? (this.buildAxis ??
                (barrierDirection(
                  { ...at, type: this.buildType, civ: this.snapshot.player.civ, team: 0 },
                  this.snapshot.entities,
                ) === 0
                  ? 'x'
                  : 'y'))
              : undefined,
            append: e.shiftKey,
          });
          if (!e.shiftKey) this.setBuild('');
        } else
          this.hooks.mode(
            'Không thể xây ở đây: cần đất trống, không có cây, bụi quả, thú hoặc công trình.',
          );
      } else if (this.attackMode || this.retreatMode) {
        this.hooks.command({
          type: 'orders',
          ids: this.selected,
          order: this.retreatMode
            ? { kind: 'move', x: point.x, y: point.y, passive: true }
            : { kind: 'attackmove', x: point.x, y: point.y },
          append: e.shiftKey,
        });
        this.attackMode = false;
        this.retreatMode = false;
        this.hooks.mode('');
        this.marker = { p: point, time: performance.now() };
      } else if (this.drag) {
        const r = this.drag,
          ids = this.snapshot.entities
            .filter((ent) => {
              if (ent.team !== 0 || ent.kind !== 'unit') return false;
              const p = iso(ent),
                x = p.x * this.zoom + this.world.x,
                y = p.y * this.zoom + this.world.y;
              return (
                x >= Math.min(r.x, r.x + r.w) &&
                x <= Math.max(r.x, r.x + r.w) &&
                y >= Math.min(r.y, r.y + r.h) &&
                y <= Math.max(r.y, r.y + r.h)
              );
            })
            .map((ent) => ent.id);
        this.select(e.shiftKey ? [...new Set([...this.selected, ...ids])] : ids);
      } else {
        const entity = this.pick(screen);
        if (entity?.team === 0) {
          if (
            this.lastClick?.id === entity.id &&
            performance.now() - this.lastClick.time < 320 &&
            entity.kind === 'unit'
          )
            this.select(
              this.snapshot.entities
                .filter((t) => {
                  const p = iso(t),
                    x = p.x * this.zoom + this.world.x,
                    y = p.y * this.zoom + this.world.y;
                  return (
                    t.team === 0 &&
                    t.type === entity.type &&
                    t.kind === 'unit' &&
                    x > 0 &&
                    x < this.host.clientWidth &&
                    y > 60 &&
                    y < this.viewportBottom
                  );
                })
                .map((t) => t.id),
            );
          else
            this.select(
              e.shiftKey
                ? this.selected.includes(entity.id)
                  ? this.selected.filter((id) => id !== entity.id)
                  : [...this.selected, entity.id]
                : [entity.id],
            );
          this.lastClick = { id: entity.id, time: performance.now() };
        } else this.select(entity ? [entity.id] : []);
      }
    } else if (button === 2) {
      if (this.buildType) {
        this.setBuild('');
      } else {
        this.context(screen, point, e.shiftKey);
      }
    }
    this.down = undefined;
    this.drag = undefined;
  };
  context(screen: Point, point: Point, append: boolean) {
    const target = this.pick(screen),
      entities = this.snapshot!.entities.filter(
        (e) => this.selected.includes(e.id) && e.team === 0,
      );
    const orders: { ids: number[]; order: import('../game/types.ts').Order }[] = [];
    for (const e of entities) {
      if (e.kind === 'building' && e.state !== 'packed') {
        this.hooks.command({ type: 'rally', id: e.id, x: point.x, y: point.y, target: target?.id });
        continue;
      }
      const isWorker = e.type === 'villager' || e.type === 'engineer';
      let order: {
        kind: 'move' | 'attack' | 'gather' | 'build' | 'repair' | 'trade' | 'deliver';
        x?: number;
        y?: number;
        target?: number;
        origin?: number;
      } = { kind: 'move', x: point.x, y: point.y };
      if (target) {
        if (target.team >= 0 && target.team !== e.team)
          order = { kind: 'attack', target: target.id };
        else if (
          isWorker &&
          (target.kind === 'resource' || target.kind === 'animal' || target.type === 'farm')
        )
          order = { kind: 'gather', target: target.id };
        else if (isWorker && target.kind === 'building' && target.team === 0 && target.progress < 1)
          order = { kind: 'build', target: target.id };
        else if (
          isWorker &&
          target.kind === 'building' &&
          target.team === 0 &&
          target.hp < target.maxHp
        )
          order = { kind: 'repair', target: target.id };
        else if (
          isWorker &&
          e.carry > 0 &&
          target.team === 0 &&
          target.kind === 'building' &&
          BUILDINGS[target.type].accepts?.includes(e.carryType ?? 'food')
        )
          order = { kind: 'deliver', target: target.id };
        else if (e.type === 'trader' && target.type === 'market' && target.team === 0)
          order = { kind: 'trade', target: target.id, origin: e.tradeHome };
      }
      const bucket = orders.find((b) => JSON.stringify(b.order) === JSON.stringify(order));
      if (bucket) bucket.ids.push(e.id);
      else orders.push({ ids: [e.id], order });
    }
    for (const o of orders) this.hooks.command({ type: 'orders', ...o, append });
    this.marker = { p: point, time: performance.now() };
    this.attackMode = false;
    this.retreatMode = false;
    this.hooks.mode('');
  }
  onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (this.blocked) return;
    const factor = e.deltaMode === 1 ? 16 : 1;
    if (e.ctrlKey || e.metaKey) {
      const point = this.local(e as unknown as PointerEvent),
        previous = this.zoom;
      this.zoom = Math.max(0.55, Math.min(1.65, this.zoom * Math.exp(-e.deltaY * factor * 0.008)));
      this.center = zoomCamera(
        this.center,
        previous,
        this.zoom,
        point,
        { x: this.host.clientWidth, y: this.host.clientHeight },
        this.size,
      );
    } else this.pan(e.deltaX * factor, e.deltaY * factor);
  };
  onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      this.spaceHeld = false;
      this.host.classList.toggle('panning', this.panMode);
    }
  };
  onBlur = () => {
    this.spaceHeld = false;
    this.onCancel();
    this.host.classList.toggle('panning', this.panMode);
  };
  setPanMode(value: boolean) {
    this.panMode = value;
    this.hooks.cameraMode?.(value);
    this.host.classList.toggle('panning', value || this.spaceHeld);
  }
  onKey = (e: KeyboardEvent) => {
    if (
      this.blocked ||
      (e.target as HTMLElement)?.matches('input,select,textarea') ||
      !this.snapshot
    )
      return;
    if (e.code === 'Escape') {
      this.setBuild('');
      this.attackMode = false;
      this.hooks.mode('');
    }
    if (e.code === 'KeyR' && isBarrier(this.buildType)) {
      e.preventDefault();
      if (!e.repeat) {
        const point = snapBuilding(
            this.buildType,
            this.screenToWorld(this.pointer),
            this.snapshot.player.civ,
          ),
          direction = barrierDirection(
            {
              ...point,
              type: this.buildType,
              civ: this.snapshot.player.civ,
              team: 0,
              barrierAxis: this.buildAxis,
            },
            this.snapshot.entities,
          );
        this.buildAxis = direction === 0 ? 'y' : 'x';
        this.buildHint();
        this.drawGhost();
      }
    }
    if (e.code === 'KeyA') {
      this.setCombatMode('attack');
    }
    if (e.code === 'KeyD') this.setCombatMode('retreat');
    if (e.code === 'KeyS') this.hooks.command({ type: 'stop', ids: this.selected });
    if (e.code === 'KeyH') this.hooks.command({ type: 'hold', ids: this.selected });
    if (e.code === 'Space') {
      e.preventDefault();
      this.spaceHeld = true;
      this.host.classList.add('panning');
    }
    if (e.code === 'KeyF') {
      const selected = this.snapshot.entities.find((ent) => ent.id === this.selected[0]),
        capital = this.snapshot.entities.find((ent) => ent.team === 0 && ent.type === 'towncenter');
      this.focus(selected ?? capital ?? mapLayout(this.size)[0]);
    }
    if (e.code === 'KeyI') {
      this.select(
        this.snapshot.entities
          .filter((ent) => ent.team === 0 && ent.type === 'villager' && !ent.orders.length)
          .map((ent) => ent.id),
      );
    }
    if (/^Digit[1-9]$/.test(e.code)) {
      e.preventDefault();
      const n = e.code.slice(-1);
      if (e.ctrlKey || e.metaKey) this.groups[n] = [...this.selected];
      else {
        this.select(
          (this.groups[n] ?? []).filter((id) =>
            this.snapshot!.entities.some((ent) => ent.id === id),
          ),
        );
        if (this.lastGroup?.key === n && performance.now() - this.lastGroup.time < 320) {
          const first = this.snapshot.entities.find((ent) => this.selected.includes(ent.id));
          if (first) this.focus(first);
        }
        this.lastGroup = { key: n, time: performance.now() };
      }
    }
    if (e.code.startsWith('Arrow')) {
      e.preventDefault();
      this.pan(
        e.code === 'ArrowLeft' ? -75 : e.code === 'ArrowRight' ? 75 : 0,
        e.code === 'ArrowUp' ? -75 : e.code === 'ArrowDown' ? 75 : 0,
      );
    }
  };
  destroy() {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    if (this.ready) {
      this.app.destroy(true, { children: true });
      for (const t of this.textures.values()) t.texture.destroy(true);
      this.ground?.destroy(true);
    }
  }
}
