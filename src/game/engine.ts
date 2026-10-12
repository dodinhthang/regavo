import {
  AGE_COSTS,
  AGE_TIMES,
  ANIMAL_FOOD,
  BUILDINGS,
  CIVS,
  CARRY_CAPACITY,
  GATHER_RATES,
  buildingAvailable,
  buildingName,
  buildingFootprintSize,
  buildingSize,
  mapLayout,
  TICK,
  UNITS,
  WORLD,
  availableUnits,
  unitAvailable,
  unitDefinition,
  type CivId,
  type Cost,
  type Point,
  type Resource,
} from './data.ts';
import { canPlaceBuilding, snapBuilding } from './placement.ts';
import { ACTOR_GAP, actorRadius } from './spacing.ts';
import type {
  Command,
  Config,
  Entity,
  Order,
  Player,
  Snapshot,
  Team,
  WorldState,
} from './types.ts';
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const radius = (e: Entity) =>
  e.kind === 'building' && e.state !== 'packed'
    ? buildingFootprintSize(e.type, e.age, e.civ) / 2
    : e.kind === 'resource'
      ? 0.65
      : actorRadius(e);
const worker = (e: Entity) => e.type === 'villager' || e.type === 'engineer';
const resources: Resource[] = ['food', 'wood', 'gold', 'stone'];
export class Game {
  state: WorldState;
  visions: [Uint8Array, Uint8Array] = [
    new Uint8Array(WORLD * WORLD),
    new Uint8Array(WORLD * WORLD),
  ];
  grids: [Uint8Array, Uint8Array] = [new Uint8Array(WORLD * WORLD), new Uint8Array(WORLD * WORLD)];
  gridVersion = -1;
  contactsTouched = new Set<number>();
  pathPlans = 0;
  regionVersion = -1;
  regions: Int32Array[] = [];
  get size() {
    return this.state.mapSize ?? Math.sqrt(this.state.terrain.length);
  }
  constructor(config: Config) {
    const size = config.mapSize ?? WORLD;
    const player = (civ: CivId): Player => ({
      civ,
      age: 1,
      resources: { food: 300, wood: 350, gold: 200, stone: 250 },
      armory: 'speed',
      lost: false,
    });
    this.state = {
      version: 1,
      layoutVersion: 2,
      mapSize: size,
      spawnPoints: mapLayout(size),
      config,
      tick: 0,
      nextId: 1,
      rng: config.seed || 17,
      entities: [],
      players: [player(config.civ), player(config.enemy)],
      terrain: Array(size * size).fill(0),
      projectiles: [],
      winner: null,
      paused: false,
      speed: 1,
      aiTimer: 0,
      aiAttack: 0,
      blockedVersion: 0,
      messages: [],
      stats: { kills: [0, 0], gathered: [0, 0] },
    };
    this.visions = [new Uint8Array(size * size), new Uint8Array(size * size)];
    this.grids = [new Uint8Array(size * size), new Uint8Array(size * size)];
    this.generate();
    this.visibility();
  }
  random() {
    this.state.rng = (Math.imul(this.state.rng, 1664525) + 1013904223) >>> 0;
    return this.state.rng / 4294967296;
  }
  entity(kind: Entity['kind'], type: string, team: Team | -1, x: number, y: number): Entity {
    const civ = this.state.players[team === -1 ? 0 : team].civ;
    const d =
      kind === 'unit'
        ? unitDefinition(type, civ)
        : kind === 'building'
          ? BUILDINGS[type]
          : undefined;
    const e: Entity = {
      id: this.state.nextId++,
      kind,
      type,
      team,
      civ,
      x,
      y,
      hp: d?.hp ?? (kind === 'animal' ? (type === 'boar' ? 65 : 30) : 1),
      maxHp: d?.hp ?? (kind === 'animal' ? (type === 'boar' ? 65 : 30) : 1),
      age: this.state.players[team === -1 ? 0 : team].age,
      dir: 2,
      state: 'idle',
      progress: 1,
      amount: 0,
      alive: true,
      orders: [],
      path: [],
      retry: 0,
      cooldown: 0,
      carry: 0,
      carryMeat: false,
      queue: [],
      shield: false,
      deployed: false,
      hold: false,
      charge: 0,
      decayAge: 0,
    };
    if (kind === 'animal') {
      e.amount = ANIMAL_FOOD[type];
      e.home = { x, y };
    }
    this.state.entities.push(e);
    if (kind === 'building' || kind === 'resource') this.state.blockedVersion++;
    return e;
  }
  generate() {
    const { terrain, config } = this.state;
    for (let y = 0; y < this.size; y++)
      for (let x = 0; x < this.size; x++) {
        if (x < 2 || y < 2 || x > this.size - 3 || y > this.size - 3)
          terrain[y * this.size + x] = 2;
        else if (
          config.map === 'ford' &&
          x >= this.size / 2 - 2 &&
          x <= this.size / 2 + 1 &&
          (y < this.size * 0.4 || y > this.size * 0.58)
        )
          terrain[y * this.size + x] = 1;
        else if (
          config.map === 'passes' &&
          x >= this.size / 2 - 3 &&
          x <= this.size / 2 + 2 &&
          !(
            (y >= this.size * 0.23 && y <= this.size * 0.35) ||
            (y >= this.size * 0.62 && y <= this.size * 0.74)
          )
        )
          terrain[y * this.size + x] = 2;
        else terrain[y * this.size + x] = this.random() < 0.06 ? 3 : 0;
      }
    const bases = this.state.spawnPoints ?? mapLayout(this.size);
    for (const team of [0, 1] as Team[]) {
      const b = bases[team],
        s = team === 0 ? 1 : -1;
      const tc = this.entity('building', 'towncenter', team, b.x, b.y);
      tc.rally = { x: b.x + s * 5.5, y: b.y };
      for (let i = 0; i < 6; i++)
        this.entity(
          'unit',
          'villager',
          team,
          b.x + s * (5.2 + (i % 3) * 1.15),
          b.y + s * (-3 + Math.floor(i / 3) * 1.15),
        );
      this.entity('unit', 'scout', team, b.x + s * 5, b.y + s * 3);
      // Symmetric resource budgets; wildlife species follow each civilization.
      for (let i = 0; i < 6; i++) {
        const e = this.entity(
          'resource',
          'berries',
          -1,
          b.x + s * (-5 + (i % 3) * 1.1),
          b.y + s * (6 + Math.floor(i / 3)),
        );
        e.amount = 150;
      }
      for (let i = 0; i < 5; i++) {
        const e = this.entity(
          'resource',
          'gold',
          -1,
          b.x + s * (7 + (i % 2)),
          b.y + s * (5 + Math.floor(i / 2)),
        );
        e.amount = 800;
      }
      for (let i = 0; i < 4; i++) {
        const e = this.entity(
          'resource',
          'stone',
          -1,
          b.x + s * (-7 + (i % 2)),
          b.y + s * (-6 + Math.floor(i / 2)),
        );
        e.amount = 650;
      }
      for (let i = 0; i < 20; i++) {
        const e = this.entity(
          'resource',
          'tree',
          -1,
          b.x + s * (-6 + (i % 5) * 1.05),
          b.y + s * (-9 + Math.floor(i / 5) * 1.05),
        );
        e.amount = 180;
      }
      const species = CIVS[this.state.players[team].civ].animals;
      for (let i = 0; i < 5; i++)
        this.entity(
          'animal',
          species[i < 3 ? 0 : 1],
          -1,
          b.x + s * (8 + (i % 3)),
          b.y + s * (-6 - Math.floor(i / 3) * 2),
        );
    }
    for (let cluster = 0; cluster < Math.round(this.size / 4); cluster++) {
      const x = 5 + this.random() * (this.size - 10),
        y = 5 + this.random() * (this.size - 10);
      if (
        bases.some((b) => dist(b, { x, y }) < 15) ||
        this.state.terrain[Math.floor(y) * this.size + Math.floor(x)] === 1 ||
        this.state.terrain[Math.floor(y) * this.size + Math.floor(x)] === 2
      )
        continue;
      for (let i = 0; i < 8; i++) {
        const xx = x + (i % 3),
          yy = y + Math.floor(i / 3);
        if (this.state.terrain[Math.floor(yy) * this.size + Math.floor(xx)] !== 0) continue;
        const e = this.entity('resource', cluster % 4 === 0 ? 'gold' : 'tree', -1, xx, yy);
        e.amount = e.type === 'gold' ? 900 : 180;
      }
    }
  }
  get(id: number | undefined) {
    return this.state.entities.find((e) => e.id === id);
  }
  owned(team: Team) {
    return this.state.entities.filter((e) => e.team === team && e.alive);
  }
  population(team: Team) {
    return this.owned(team).filter((e) => e.kind === 'unit').length;
  }
  capacity(team: Team) {
    return Math.min(
      200,
      this.owned(team).reduce(
        (n, e) =>
          n + (e.kind === 'building' && e.progress >= 1 ? (BUILDINGS[e.type].capacity ?? 0) : 0),
        0,
      ),
    );
  }
  reserved(team: Team) {
    return this.owned(team).reduce((n, e) => n + e.queue.length, 0);
  }
  afford(team: Team, cost: Cost) {
    return resources.every((r) => this.state.players[team].resources[r] >= (cost[r] ?? 0));
  }
  pay(team: Team, cost: Cost, factor = 1) {
    for (const r of resources) this.state.players[team].resources[r] -= (cost[r] ?? 0) * factor;
  }
  tell(text: string, team: Team = 0) {
    if (team === 0) {
      this.state.messages.push({ text, tick: this.state.tick });
      this.state.messages = this.state.messages.slice(-5);
    }
  }
  visible(e: Point, team: Team) {
    return !!this.visions[team][Math.floor(e.y) * this.size + Math.floor(e.x)];
  }
  visibility() {
    this.visions.forEach((v) => v.fill(0));
    for (const e of this.state.entities) {
      if (!e.alive || e.team === -1 || e.progress < 1) continue;
      const range =
        e.kind === 'unit'
          ? (unitDefinition(e.type, e.civ).sight ?? 6)
          : (BUILDINGS[e.type].sight ?? 5);
      const v = this.visions[e.team];
      for (
        let y = Math.max(0, Math.floor(e.y - range));
        y <= Math.min(this.size - 1, Math.ceil(e.y + range));
        y++
      )
        for (
          let x = Math.max(0, Math.floor(e.x - range));
          x <= Math.min(this.size - 1, Math.ceil(e.x + range));
          x++
        )
          if (Math.hypot(x + 0.5 - e.x, y + 0.5 - e.y) <= range) v[y * this.size + x] = 1;
    }
  }
  rebuildGrids() {
    if (this.gridVersion === this.state.blockedVersion) return;
    this.gridVersion = this.state.blockedVersion;
    for (const team of [0, 1] as Team[]) {
      const grid = this.grids[team];
      for (let i = 0; i < grid.length; i++)
        grid[i] = this.state.terrain[i] === 1 || this.state.terrain[i] === 2 ? 1 : 0;
      for (const e of this.state.entities) {
        if (!e.alive || e.state === 'packed') continue;
        if (e.kind === 'building') {
          if (e.type.endsWith('gate') && e.team === team) continue;
          const size = buildingFootprintSize(e.type, e.age, e.civ);
          for (let y = Math.floor(e.y - size / 2); y < Math.ceil(e.y + size / 2); y++)
            for (let x = Math.floor(e.x - size / 2); x < Math.ceil(e.x + size / 2); x++)
              if (x >= 0 && y >= 0 && x < this.size && y < this.size) grid[y * this.size + x] = 1;
        } else if (e.kind === 'resource') grid[Math.floor(e.y) * this.size + Math.floor(e.x)] = 1;
      }
    }
  }
  walkable(p: Point, team: Team) {
    this.rebuildGrids();
    return (
      p.x >= 1 &&
      p.y >= 1 &&
      p.x < this.size - 1 &&
      p.y < this.size - 1 &&
      !this.grids[team][Math.floor(p.y) * this.size + Math.floor(p.x)]
    );
  }
  /** Static connectivity prevents choosing a working/attack slot across a sealed wall. */
  reachable(start: Point, goal: Point, team: Team) {
    this.rebuildGrids();
    if (this.regionVersion !== this.gridVersion) {
      this.regionVersion = this.gridVersion;
      this.regions = [];
    }
    let regions = this.regions[team];
    if (!regions) {
      regions = this.regions[team] = new Int32Array(this.size * this.size);
      const grid = this.grids[team],
        queue = new Int32Array(grid.length);
      let component = 0;
      for (let y = 1; y < this.size - 1; y++)
        for (let x = 1; x < this.size - 1; x++) {
          const first = y * this.size + x;
          if (grid[first] || regions[first]) continue;
          regions[first] = ++component;
          queue[0] = first;
          let head = 0,
            tail = 1;
          while (head < tail) {
            const n = queue[head++],
              xx = n % this.size,
              yy = Math.floor(n / this.size);
            for (const [dx, dy] of [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ]) {
              const px = xx + dx,
                py = yy + dy,
                k = py * this.size + px;
              if (
                px < 1 ||
                py < 1 ||
                px >= this.size - 1 ||
                py >= this.size - 1 ||
                grid[k] ||
                regions[k]
              )
                continue;
              regions[k] = component;
              queue[tail++] = k;
            }
          }
        }
    }
    const a = regions[Math.floor(start.y) * this.size + Math.floor(start.x)],
      b = regions[Math.floor(goal.y) * this.size + Math.floor(goal.x)];
    return !!a && a === b;
  }
  freeSegment(start: Point, end: Point, team: Team) {
    const steps = Math.max(1, Math.ceil(dist(start, end) / 0.1));
    for (let i = 1; i <= steps; i++)
      if (
        !this.walkable(
          {
            x: start.x + ((end.x - start.x) * i) / steps,
            y: start.y + ((end.y - start.y) * i) / steps,
          },
          team,
        )
      )
        return false;
    return true;
  }
  freeNear(p: Point, team: Team, max = 8): Point {
    if (this.walkable(p, team)) return p;
    for (let r = 1; r <= max; r++)
      for (let i = 0; i < r * 10; i++) {
        const a = (i / (r * 10)) * Math.PI * 2,
          q = {
            x: Math.floor(p.x + Math.cos(a) * r) + 0.5,
            y: Math.floor(p.y + Math.sin(a) * r) + 0.5,
          };
        if (this.walkable(q, team)) return q;
      }
    return p;
  }
  actorSpace(
    p: Point,
    e: Entity,
    ignored: Set<number> = new Set(),
    planned: { point: Point; radius: number }[] = [],
    slots = false,
  ) {
    const team = e.team === -1 ? 0 : e.team;
    if (!this.walkable(p, team)) return false;
    const r = actorRadius(e);
    if (planned.some((s) => dist(s.point, p) < r + s.radius + ACTOR_GAP - 0.01)) return false;
    return !this.state.entities.some(
      (o) =>
        o.id !== e.id &&
        !ignored.has(o.id) &&
        o.alive &&
        (o.kind === 'unit' || o.kind === 'animal' || o.state === 'packed') &&
        (dist(o, p) < r + actorRadius(o) + ACTOR_GAP - 0.01 ||
          (slots &&
            o.contactSlot &&
            dist(o.contactSlot, p) < r + actorRadius(o) + ACTOR_GAP - 0.01)),
    );
  }
  /** Spawn and formation goals account for both occupants and goals already assigned. */
  freeActorNear(
    p: Point,
    e: Entity,
    ignored = new Set<number>(),
    planned: { point: Point; radius: number }[] = [],
    max = 8,
  ): Point | undefined {
    if (this.actorSpace(p, e, ignored, planned)) return { ...p };
    const step = Math.max(0.5, actorRadius(e) + 0.2);
    for (let r = step; r <= max; r += step) {
      const count = Math.ceil((Math.PI * 2 * r) / 0.55);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2,
          point = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r };
        if (this.actorSpace(point, e, ignored, planned)) return point;
      }
    }
    return undefined;
  }
  contactPoint(
    e: Entity,
    t: Entity,
    maxDistance: number,
    mode: string,
    reserve = true,
  ): Point | undefined {
    if (reserve) this.contactsTouched.add(e.id);
    const old = e.contactSlot,
      team = e.team === -1 ? 0 : e.team;
    // A travelling passer-by does not invalidate a stable working place.
    if (
      old &&
      old.target === t.id &&
      old.mode === mode &&
      dist({ x: old.targetX, y: old.targetY }, t) < 0.6 &&
      dist(old, t) <= maxDistance &&
      this.walkable(old, team) &&
      this.reachable(e, old, team) &&
      !this.state.entities.some(
        (o) =>
          o.id !== e.id &&
          o.id !== t.id &&
          o.alive &&
          o.contactSlot?.target === t.id &&
          ['work', 'attack'].includes(o.state) &&
          dist(old, o) < actorRadius(e) + actorRadius(o) + ACTOR_GAP - 0.04,
      )
    )
      return old;
    if (reserve) e.contactSlot = undefined;
    const failed = e.contactRetry;
    if (
      reserve &&
      failed &&
      failed.target === t.id &&
      failed.mode === mode &&
      failed.grid === this.state.blockedVersion &&
      failed.until > this.state.tick &&
      dist(failed, t) < 0.6
    )
      return undefined;
    let best: Point | undefined,
      score = Infinity;
    const consider = (p: Point) => {
      if (
        dist(p, t) > maxDistance ||
        !this.actorSpace(p, e, new Set(), [], true) ||
        !this.reachable(e, p, team)
      )
        return false;
      const n = dist(e, p);
      if (n < score) {
        score = n;
        best = { x: p.x, y: p.y };
      }
      return true;
    };
    if (consider(e)) {
      const point = { x: e.x, y: e.y };
      if (reserve) {
        e.contactSlot = { ...point, target: t.id, mode, targetX: t.x, targetY: t.y };
        e.contactRetry = undefined;
      }
      return point;
    }
    const minimum = radius(t) + Math.min(actorRadius(e), 0.6) + 0.06;
    const outer = maxDistance - 0.08,
      inner = Math.min(minimum, outer),
      base = Math.atan2(e.y - t.y, e.x - t.x);
    for (const r of new Set([outer, (outer + inner) / 2, inner])) {
      const count = Math.max(16, Math.ceil((r * Math.PI * 2) / 0.5));
      // Closest angles first; the first free angle on each ring is its closest
      // candidate. Avoid scanning thousands of interior points for large targets.
      for (let i = 0; i < count; i++) {
        const offset = i === 0 ? 0 : Math.ceil(i / 2) * (i % 2 ? 1 : -1),
          a = base + (offset / count) * Math.PI * 2;
        if (consider({ x: t.x + Math.cos(a) * r, y: t.y + Math.sin(a) * r })) break;
      }
    }
    if (reserve) {
      if (best) {
        e.contactSlot = { ...best, target: t.id, mode, targetX: t.x, targetY: t.y };
        e.contactRetry = undefined;
      } else
        e.contactRetry = {
          target: t.id,
          mode,
          until: this.state.tick + 5,
          grid: this.state.blockedVersion,
          x: t.x,
          y: t.y,
        };
    }
    return best;
  }
  atContact(e: Entity, t: Entity, maxDistance: number, mode: string, dt: number) {
    const p = this.contactPoint(e, t, maxDistance, mode);
    if (!p) return false;
    if (!this.contactReady(e, t, maxDistance, p)) {
      this.move(e, p, dt, mode === 'attack' || mode === 'hunt' ? 0.04 : 0.2);
      return false;
    }
    e.path = [];
    e.pathGoal = undefined;
    return true;
  }
  contactReady(e: Entity, t: Entity, maxDistance: number, p: Point) {
    if (
      (e.contactSlot?.mode === 'attack' || e.contactSlot?.mode === 'hunt') &&
      dist(e, t) > maxDistance
    )
      return false;
    if (dist(e, p) > 0.32 && !(dist(e, t) <= maxDistance && this.actorSpace(e, e))) return false;
    if (e.contactSlot) {
      e.contactSlot.x = e.x;
      e.contactSlot.y = e.y;
    }
    return true;
  }
  /** Resolve even stationary overlaps. Spatial buckets keep crowded armies local. */
  separateActors() {
    const actors = this.state.entities.filter(
      (e) => e.alive && (e.kind === 'unit' || e.kind === 'animal' || e.state === 'packed'),
    );
    for (let pass = 0; pass < 2; pass++) {
      const buckets = new Map<string, Entity[]>(),
        cell = 3;
      for (const e of actors) {
        const key = `${Math.floor(e.x / cell)},${Math.floor(e.y / cell)}`;
        const bucket = buckets.get(key) ?? [];
        bucket.push(e);
        buckets.set(key, bucket);
      }
      for (const e of actors) {
        const x = Math.floor(e.x / cell),
          y = Math.floor(e.y / cell);
        for (let yy = y - 1; yy <= y + 1; yy++)
          for (let xx = x - 1; xx <= x + 1; xx++)
            for (const o of buckets.get(`${xx},${yy}`) ?? []) {
              if (o.id <= e.id) continue;
              const desired = actorRadius(e) + actorRadius(o) + ACTOR_GAP,
                d = dist(e, o);
              if (d >= desired - 0.01) continue;
              const angle =
                (((Math.imul(e.id, 73856093) ^ Math.imul(o.id, 19349663)) >>> 0) / 4294967296) *
                Math.PI *
                2;
              const dx = d > 0.001 ? (e.x - o.x) / d : Math.cos(angle),
                dy = d > 0.001 ? (e.y - o.y) / d : Math.sin(angle),
                push = Math.min(0.12, (desired - d) * 0.51);
              const a = { x: e.x + dx * push, y: e.y + dy * push },
                b = { x: o.x - dx * push, y: o.y - dy * push };
              const aFree = this.walkable(a, e.team === -1 ? 0 : e.team),
                bFree = this.walkable(b, o.team === -1 ? 0 : o.team);
              if (aFree) {
                e.x = a.x;
                e.y = a.y;
              }
              if (bFree) {
                o.x = b.x;
                o.y = b.y;
              }
            }
      }
    }
  }
  canPlace(type: string, p: Point, team: Team, vision = true) {
    return canPlaceBuilding(
      type,
      p,
      this.size,
      this.state.terrain,
      this.state.entities,
      vision ? this.visions[team] : undefined,
      this.state.players[team].civ,
    );
  }
  path(start: Point, destination: Point, team: Team, avoid?: Entity): Point[] {
    this.rebuildGrids();
    const goal = this.freeNear(destination, team),
      grid = avoid ? this.grids[team].slice() : this.grids[team];
    if (avoid) {
      for (const o of this.state.entities) {
        if (
          o.id === avoid.id ||
          !o.alive ||
          !(o.kind === 'unit' || o.kind === 'animal' || o.state === 'packed') ||
          dist(start, o) > 12
        )
          continue;
        const r = actorRadius(avoid) + actorRadius(o) + ACTOR_GAP;
        for (
          let y = Math.max(1, Math.floor(o.y - r));
          y <= Math.min(this.size - 2, Math.floor(o.y + r));
          y++
        )
          for (
            let x = Math.max(1, Math.floor(o.x - r));
            x <= Math.min(this.size - 2, Math.floor(o.x + r));
            x++
          )
            if (dist({ x: x + 0.5, y: y + 0.5 }, o) < r) grid[y * this.size + x] = 1;
      }
      // The final approach uses local avoidance and may end off the tile centre.
      grid[Math.floor(goal.y) * this.size + Math.floor(goal.x)] =
        this.grids[team][Math.floor(goal.y) * this.size + Math.floor(goal.x)];
    }
    const s =
        clamp(Math.floor(start.y), 0, this.size - 1) * this.size +
        clamp(Math.floor(start.x), 0, this.size - 1),
      g = Math.floor(goal.y) * this.size + Math.floor(goal.x);
    if (s === g) return [goal];
    const costs = new Float32Array(this.size * this.size).fill(Infinity),
      parent = new Int32Array(this.size * this.size).fill(-1),
      closed = new Uint8Array(this.size * this.size),
      open = [s];
    costs[s] = 0;
    const heuristicCache = new Float64Array(this.size * this.size).fill(-1);
    const heuristic = (n: number) => {
      if (heuristicCache[n] < 0)
        heuristicCache[n] = Math.hypot(
          (n % this.size) - (g % this.size),
          Math.floor(n / this.size) - Math.floor(g / this.size),
        );
      return heuristicCache[n];
    };
    let count = 0;
    while (open.length && count++ < this.size * this.size) {
      let at = 0;
      for (let i = 1; i < open.length; i++)
        if (costs[open[i]] + heuristic(open[i]) < costs[open[at]] + heuristic(open[at])) at = i;
      const n = open.splice(at, 1)[0];
      if (n === g) {
        const result: Point[] = [goal];
        let k = parent[n];
        while (k !== -1 && parent[k] !== -1) {
          result.push({ x: (k % this.size) + 0.5, y: Math.floor(k / this.size) + 0.5 });
          k = parent[k];
        }
        return result.reverse();
      }
      closed[n] = 1;
      const x = n % this.size,
        y = Math.floor(n / this.size);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ]) {
        const xx = x + dx,
          yy = y + dy,
          k = yy * this.size + xx;
        if (
          xx < 1 ||
          yy < 1 ||
          xx > this.size - 2 ||
          yy > this.size - 2 ||
          closed[k] ||
          grid[k] ||
          (dx && dy && (grid[y * this.size + xx] || grid[yy * this.size + x]))
        )
          continue;
        const c = costs[n] + (dx && dy ? 1.414 : 1);
        if (c < costs[k]) {
          costs[k] = c;
          parent[k] = n;
          if (!open.includes(k)) open.push(k);
        }
      }
    }
    return [];
  }
  move(e: Entity, p: Point, dt: number, arrival = 0.2): boolean {
    const team = e.team === -1 ? 0 : e.team;
    p = this.freeNear(p, team);
    if (dist(e, p) < arrival) {
      e.state = 'idle';
      return true;
    }
    if (e.retry > 0) {
      e.retry -= dt;
      return false;
    }
    // Near a goal, travel along the actual free segment instead of requiring all
    // neighbours to pass through the same tile centre before their separate slots.
    const goalDistance = dist(e, p);
    if (
      goalDistance < 2.5 &&
      (e.navigation?.avoidUntil ?? 0) <= this.state.tick &&
      this.freeSegment(e, p, team)
    ) {
      e.path = [{ x: p.x, y: p.y }];
      e.pathGoal = { x: p.x, y: p.y };
      e.pathVersion = this.state.blockedVersion;
    }
    if (
      !e.pathGoal ||
      dist(e.pathGoal, p) > 0.45 ||
      e.pathVersion !== this.state.blockedVersion ||
      e.path.length === 0
    ) {
      if (this.pathPlans >= 12) return false;
      this.pathPlans++;
      e.path = this.path(
        e,
        p,
        team,
        (e.navigation?.avoidUntil ?? 0) > this.state.tick ? e : undefined,
      );
      e.pathGoal = { x: p.x, y: p.y };
      e.pathVersion = this.state.blockedVersion;
      if (!e.path.length) {
        e.retry = 1;
        return false;
      }
    }
    const next = e.path[0],
      d = dist(e, next);
    if (d < (e.path.length > 1 ? 0.15 : Math.min(0.15, arrival))) {
      e.path.shift();
      return dist(e, p) < arrival;
    }
    if (!e.navigation || dist(e.navigation.waypoint, next) > 0.05)
      e.navigation = {
        waypoint: { ...next },
        best: d,
        stalled: 0,
        avoidUntil: e.navigation?.avoidUntil ?? 0,
      };
    const navigation = e.navigation;
    if (d < navigation.best - 0.04) {
      navigation.best = d;
      navigation.stalled = 0;
    } else navigation.stalled += dt;
    if (navigation.stalled >= 0.8) {
      e.path = [];
      e.pathGoal = undefined;
      e.contactSlot = undefined;
      e.contactRetry = undefined;
      navigation.stalled = 0;
      navigation.best = d;
      navigation.avoidUntil = this.state.tick + 60;
      return false;
    }
    let speed = e.kind === 'building' ? 1.25 : (unitDefinition(e.type, e.civ)?.speed ?? 2.4);
    if (e.shield) speed *= 0.55;
    if (e.type === 'horsearcher' && e.cooldown > unitDefinition(e.type, e.civ).cooldown - 0.25)
      speed *= 0.4;
    if (e.deployed) {
      e.deployed = false;
      e.cooldown = Math.max(2, e.cooldown);
    }
    const travel = Math.min(d, speed * dt),
      angle = Math.atan2(next.y - e.y, next.x - e.x);
    const neighbours = this.state.entities.filter(
      (o) =>
        o.id !== e.id &&
        o.alive &&
        (o.kind === 'unit' || o.kind === 'animal' || o.state === 'packed') &&
        dist(e, o) < actorRadius(e) + actorRadius(o) + travel + 0.6,
    );
    let destination: Point | undefined,
      best = -Infinity;
    for (const turn of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.57, -1.57, 2, -2]) {
      const at = {
        x: e.x + Math.cos(angle + turn) * travel,
        y: e.y + Math.sin(angle + turn) * travel,
      };
      if (!this.freeSegment(e, at, team)) continue;
      let clearance = 2;
      for (const o of neighbours)
        clearance = Math.min(
          clearance,
          dist(at, o) - (actorRadius(e) + actorRadius(o) + ACTOR_GAP),
        );
      if (clearance < -0.035) continue;
      // All actors prefer the same traffic side relative to their own heading,
      // so head-on groups can pass instead of pushing at a shared waypoint.
      const score = Math.cos(turn) + Math.min(0.35, clearance) * 0.25 + (turn > 0 ? 0.012 : 0);
      if (score > best) {
        best = score;
        destination = at;
      }
    }
    const actualTravel = destination ? dist(e, destination) : 0;
    if (destination) {
      e.x = destination.x;
      e.y = destination.y;
    }
    e.dir = (Math.round(Math.atan2(next.y - e.y, next.x - e.x) / (Math.PI / 4)) + 8) % 8;
    e.state = 'walk';
    e.charge += actualTravel;
    return false;
  }
  order(e: Entity, o: Order, append = false) {
    if (e.mobilization) this.cancelMobilization(e);
    if (!append) {
      e.orders = [];
      e.path = [];
      e.pathGoal = undefined;
      e.navigation = undefined;
      e.combatTarget = undefined;
      e.lastAttacker = undefined;
      e.hold = false;
      e.retry = 0;
      e.returning = false;
      e.contactSlot = undefined;
      e.contactRetry = undefined;
      e.strike = undefined;
      e.attackPhase = undefined;
    }
    const next = { ...o };
    if (next.kind === 'gather') {
      const t = this.get(next.target);
      if (t) this.rememberGatherArea(e, next, t);
    }
    e.orders.push(next);
  }
  reserveCount(team: Team) {
    return this.owned(team).filter(
      (e) => e.type === 'militia' || e.mobilization?.target === 'militia',
    ).length;
  }
  civilianOrders(e: Entity) {
    return (e.civilOrders ?? [])
      .filter((o) => {
        if (o.target === undefined) return true;
        const target = this.get(o.target);
        return (
          !!target &&
          (target.alive || (target.kind === 'animal' && target.amount > 0)) &&
          (o.kind !== 'gather' || target.amount > 0)
        );
      })
      .map((o) => structuredClone(o));
  }
  cancelMobilization(e: Entity) {
    const transition = e.mobilization;
    if (!transition) return;
    this.pay(e.team as Team, transition.cost, -transition.remaining / transition.total);
    e.mobilization = undefined;
    e.orders = e.type === 'villager' ? this.civilianOrders(e) : [];
    if (e.type === 'villager') e.civilOrders = undefined;
    e.path = [];
    e.pathGoal = undefined;
    e.contactSlot = undefined;
    e.returning = false;
    e.state = 'idle';
  }
  stepMobilization(e: Entity, dt: number) {
    const transition = e.mobilization!;
    const barracks = this.get(transition.barracks);
    if (
      !barracks?.alive ||
      barracks.team !== e.team ||
      barracks.type !== 'barracks' ||
      barracks.progress < 1
    ) {
      this.cancelMobilization(e);
      return;
    }
    if (transition.phase === 'deliver') {
      if (e.carry > 0) {
        this.deposit(e, dt);
        return;
      }
      transition.phase = 'travel';
    }
    if (!this.atContact(e, barracks, radius(barracks) + 0.9, 'mobilize', dt)) {
      // Leaving the training spot pauses the remaining time.
      return;
    }
    transition.phase = 'train';
    e.state = 'mobilize';
    transition.remaining = Math.max(0, transition.remaining - dt);
    if (transition.remaining > 0) return;
    const ratio = e.hp / e.maxHp;
    e.type = transition.target;
    e.maxHp = unitDefinition(e.type, e.civ).hp;
    e.hp = e.maxHp * ratio;
    e.age = this.state.players[e.team as Team].age;
    e.mobilization = undefined;
    e.orders = e.type === 'villager' ? this.civilianOrders(e) : [];
    if (e.type === 'villager') e.civilOrders = undefined;
    e.path = [];
    e.pathGoal = undefined;
    e.contactSlot = undefined;
    e.returning = false;
    e.hold = false;
    e.charge = 0;
    e.strike = undefined;
    e.attackPhase = undefined;
    e.state = 'idle';
  }
  command(c: Command, team: Team = 0) {
    if (c.type === 'pause') {
      this.state.paused = !this.state.paused;
      return;
    }
    if (c.type === 'speed') {
      this.state.speed = [1, 1.5, 2].includes(c.value) ? c.value : 1;
      return;
    }
    if (this.state.winner !== null) return;
    if (c.type === 'retreat') {
      if (c.x === undefined || c.y === undefined) return;
      c = {
        type: 'orders',
        ids: c.ids,
        order: { kind: 'move', x: c.x, y: c.y, passive: true },
      };
    }
    const p = this.state.players[team];
    if (c.type === 'mobilize' || c.type === 'demobilize') {
      if (p.civ !== 'daiviet' || p.age < 2) return;
      const mobilize = c.type === 'mobilize';
      for (const id of [...new Set(c.ids)].sort((a, b) => a - b)) {
        const e = this.get(id);
        if (
          !e?.alive ||
          e.team !== team ||
          e.kind !== 'unit' ||
          e.mobilization ||
          e.type !== (mobilize ? 'villager' : 'militia')
        )
          continue;
        if (mobilize && this.reserveCount(team) >= 12) {
          this.tell('Tối đa 12 dân binh đang huy động hoặc phục vụ.', team);
          break;
        }
        const barracks = this.nearest(
          e,
          (b) =>
            b.alive &&
            b.team === team &&
            b.kind === 'building' &&
            b.type === 'barracks' &&
            b.progress >= 1,
        );
        if (!barracks) {
          this.tell('Cần doanh trại hoàn thành để huy động hoặc giải ngũ.', team);
          break;
        }
        const cost = mobilize ? { food: 20, wood: 10 } : {};
        if (!this.afford(team, cost)) {
          this.tell('Chưa đủ tài nguyên để huy động dân binh.', team);
          break;
        }
        if (mobilize) e.civilOrders = structuredClone(e.orders);
        this.pay(team, cost);
        e.orders = [];
        e.path = [];
        e.pathGoal = undefined;
        e.contactSlot = undefined;
        e.contactRetry = undefined;
        e.returning = false;
        e.hold = false;
        e.strike = undefined;
        e.attackPhase = undefined;
        e.mobilization = {
          target: mobilize ? 'militia' : 'villager',
          barracks: barracks.id,
          remaining: 8,
          total: 8,
          cost,
          phase: e.carry > 0 ? 'deliver' : 'travel',
        };
      }
    } else if (c.type === 'orders') {
      const targets = c.ids
        .map((id) => this.get(id))
        .filter(
          (e): e is Entity =>
            !!e && e.team === team && e.alive && (e.kind === 'unit' || e.state === 'packed'),
        );
      const t = this.get(c.order.target);
      if (t && t.team !== team && !this.visible(t, team)) return;
      const planned: { point: Point; radius: number }[] = [],
        ignored = new Set(targets.map((e) => e.id));
      for (const e of [...targets].sort((a, b) => actorRadius(b) - actorRadius(a) || a.id - b.id)) {
        const o = { ...c.order };
        if (
          o.x !== undefined &&
          o.y !== undefined &&
          (o.kind === 'move' || o.kind === 'attackmove')
        ) {
          const at = this.freeActorNear({ x: o.x, y: o.y }, e, ignored, planned, 12);
          if (at) {
            o.x = at.x;
            o.y = at.y;
            planned.push({ point: at, radius: actorRadius(e) });
          }
        }
        this.order(e, o, c.append);
      }
    } else if (c.type === 'build') {
      const d = BUILDINGS[c.building],
        builders = c.builders
          .map((id) => this.get(id))
          .filter((e): e is Entity => !!e && e.team === team && e.alive && worker(e));
      if (!buildingAvailable(c.building, p.civ, p.age) || !builders.length) return;
      const at = snapBuilding(c.building, { x: c.x, y: c.y }, p.civ);
      if (!this.canPlace(c.building, at, team)) {
        this.tell('Không thể xây ở đây. Cần đất trống trong tầm nhìn.', team);
        return;
      }
      if (!this.afford(team, d.cost)) {
        this.tell('Chưa đủ tài nguyên để xây.', team);
        return;
      }
      this.pay(team, d.cost);
      const b = this.entity('building', c.building, team, at.x, at.y);
      b.progress = 0;
      b.hp = 1;
      b.state = 'build';
      if (
        ['woodwall', 'woodgate', 'stonewall', 'stonegate'].includes(c.building) &&
        (c.axis === 'x' || c.axis === 'y')
      )
        b.barrierAxis = c.axis;
      // Shift keeps placement active and queues the next foundation behind an
      // existing construction job, rather than behind endless harvesting.
      builders.forEach((e) =>
        this.order(
          e,
          { kind: 'build', target: b.id },
          !!c.append && e.orders.some((o) => o.kind === 'build'),
        ),
      );
    } else if (c.type === 'train') {
      const b = this.get(c.building),
        d = unitDefinition(c.unit, p.civ);
      if (
        !b ||
        b.team !== team ||
        !b.alive ||
        b.progress < 1 ||
        b.state === 'packed' ||
        d.trainable === false ||
        !unitAvailable(c.unit, p.civ, p.age) ||
        d.building !== b.type
      )
        return;
      if (b.queue.length >= 8) {
        this.tell('Hàng chờ tối đa 8 quân.', team);
        return;
      }
      if (this.population(team) + this.reserved(team) >= this.capacity(team)) {
        this.tell('Thiếu chỗ dân. Hãy xây thêm nhà.', team);
        return;
      }
      if (
        c.unit === 'elephant' &&
        this.owned(team).filter((e) => e.type === 'elephant').length +
          this.owned(team).reduce(
            (n, e) => n + e.queue.filter((q) => q.type === 'elephant').length,
            0,
          ) >=
          6
      ) {
        this.tell('Tối đa 6 voi chiến mỗi phe.', team);
        return;
      }
      if (!this.afford(team, d.cost)) {
        this.tell('Chưa đủ tài nguyên để tuyển quân.', team);
        return;
      }
      this.pay(team, d.cost);
      const military = d.role !== 'civilian',
        armory = this.owned(team).some((e) => e.type === 'armory' && e.progress >= 1),
        quality = p.civ === 'tang' && armory && military && p.armory === 'quality';
      const time = d.time * (p.civ === 'tang' && armory && military ? (quality ? 1.15 : 0.7) : 1);
      b.queue.push({ type: c.unit, remaining: time, total: time, cost: { ...d.cost }, quality });
    } else if (c.type === 'cancelqueue') {
      const b = this.get(c.building);
      if (b?.team === team && b.queue.length) {
        const q = b.queue.pop()!;
        this.pay(team, q.cost, -q.remaining / q.total);
      }
    } else if (c.type === 'advance') {
      if (p.age >= 3 || p.research) return;
      if (!this.afford(team, AGE_COSTS[p.age - 1])) {
        this.tell('Chưa đủ lương thực và vàng để lên đời.', team);
        return;
      }
      this.pay(team, AGE_COSTS[p.age - 1]);
      p.research = {
        remaining: AGE_TIMES[p.age - 1],
        total: AGE_TIMES[p.age - 1],
        cost: { ...AGE_COSTS[p.age - 1] },
      };
      this.tell(`Đang tiến lên đời ${p.age + 1}. Thành chính tạm dừng tuyển dân.`, team);
    } else if (c.type === 'canceladvance') {
      if (p.research) {
        this.pay(team, p.research.cost, -p.research.remaining / p.research.total);
        p.research = undefined;
      }
    } else if (c.type === 'rally') {
      const b = this.get(c.id);
      if (b?.team === team) {
        b.rally = { x: clamp(c.x, 2, this.size - 3), y: clamp(c.y, 2, this.size - 3) };
        b.rallyTarget = c.target;
      }
    } else if (c.type === 'armory') {
      if (
        p.civ === 'tang' &&
        this.owned(team).some((e) => e.type === 'armory' && e.progress >= 1) &&
        !p.armoryChange
      )
        p.armoryChange = { remaining: 10, mode: c.mode };
    } else if (c.type === 'exchange') {
      if (
        c.resource === 'gold' ||
        !this.owned(team).some((e) => e.type === 'market' && e.progress >= 1)
      )
        return;
      if (c.sell && p.resources[c.resource] >= 100) {
        p.resources[c.resource] -= 100;
        p.resources.gold += 70;
      } else if (!c.sell && p.resources.gold >= 130) {
        p.resources.gold -= 130;
        p.resources[c.resource] += 100;
      } else this.tell('Chưa đủ tài nguyên để giao dịch.', team);
    } else {
      for (const id of c.ids) {
        const e = this.get(id);
        if (!e || e.team !== team || !e.alive) continue;
        if (e.mobilization && (c.type === 'stop' || c.type === 'hold')) this.cancelMobilization(e);
        if (c.type === 'stop') {
          e.orders = [];
          e.path = [];
          e.state = 'idle';
          e.hold = false;
          e.returning = false;
          e.contactSlot = undefined;
          e.strike = undefined;
          e.attackPhase = undefined;
        }
        if (c.type === 'hold') {
          e.orders = [];
          e.path = [];
          e.hold = !e.hold;
          e.state = 'idle';
          e.returning = false;
          e.contactSlot = undefined;
          e.strike = undefined;
          e.attackPhase = undefined;
        }
        if (c.type === 'shield' && e.type === 'legionary') e.shield = !e.shield;
        if (c.type === 'deploy' && e.type === 'cannon') {
          e.deployed = !e.deployed;
          e.orders = [];
          e.path = [];
          e.cooldown = 2;
          e.strike = undefined;
          e.attackPhase = undefined;
        }
        if (
          c.type === 'pack' &&
          p.civ === 'mongol' &&
          p.age >= 2 &&
          ['lumbercamp', 'miningcamp', 'granary'].includes(e.type) &&
          e.progress >= 1
        ) {
          if (e.state === 'packed') {
            const at = snapBuilding(e.type, e, e.civ);
            if (this.canPlace(e.type, at, team)) {
              e.x = at.x;
              e.y = at.y;
              e.state = 'idle';
              e.orders = [];
              e.path = [];
              this.state.blockedVersion++;
            } else this.tell('Vị trí này chưa đủ đất trống để dựng trại.', team);
          } else {
            e.state = 'packed';
            this.state.blockedVersion++;
            const q = this.freeNear(e, team);
            e.x = q.x;
            e.y = q.y;
          }
        }
      }
    }
  }
  approach(e: Entity, t: Entity, range: number, dt: number) {
    const r = radius(t) + range * 0.8,
      dx = e.x - t.x,
      dy = e.y - t.y,
      l = Math.max(0.01, Math.hypot(dx, dy));
    const goal = this.freeNear(
      { x: t.x + (dx / l) * r, y: t.y + (dy / l) * r },
      e.team === -1 ? 0 : e.team,
    );
    return this.move(e, goal, dt);
  }
  workPoint(e: Entity, t: Entity, range = radius(t) + 0.9): Point | undefined {
    return this.contactPoint(e, t, range, 'gather');
  }
  nearest(e: Entity, predicate: (o: Entity) => boolean) {
    let best: Entity | undefined,
      d = Infinity;
    for (const o of this.state.entities) {
      if (!predicate(o)) continue;
      const l = dist(e, o);
      if (l < d) {
        d = l;
        best = o;
      }
    }
    return best;
  }
  dropoff(e: Entity) {
    const explicit = e.orders[0]?.kind === 'deliver' ? this.get(e.orders[0].target) : undefined;
    if (
      explicit?.alive &&
      explicit.progress >= 1 &&
      explicit.team === e.team &&
      explicit.state !== 'packed' &&
      BUILDINGS[explicit.type]?.accepts?.includes(e.carryType ?? 'food')
    )
      return explicit;
    return this.nearest(
      e,
      (b) =>
        b.alive &&
        b.team === e.team &&
        b.kind === 'building' &&
        b.progress >= 1 &&
        b.state !== 'packed' &&
        !!BUILDINGS[b.type].accepts?.includes(e.carryType ?? 'food'),
    );
  }
  deposit(e: Entity, dt: number) {
    const b = this.dropoff(e);
    if (!b) {
      e.state = 'idle';
      e.returning = false;
      return;
    }
    e.returning = e.carry > 0;
    if (!this.atContact(e, b, radius(b) + 0.9, 'deposit', dt)) return;
    const team = e.team as Team;
    this.state.players[team].resources[e.carryType ?? 'food'] += e.carry;
    this.state.stats.gathered[team] += e.carry;
    e.carry = 0;
    e.carryMeat = false;
    e.returning = false;
    e.state = 'work';
    e.path = [];
  }
  rememberGatherArea(e: Entity, o: Order, t: Entity) {
    const area = (o.gatherArea ??= { x: t.x, y: t.y, type: t.type, targets: [t.id] });
    // Remember discovered neighbours even while they leave current vision on a
    // dropoff trip. The fixed origin keeps harvesting within the ordered patch.
    const known = new Set(area.targets);
    for (const source of this.state.entities)
      if (
        source.type === area.type &&
        dist(source, area) < 12 &&
        source.amount > 0 &&
        (source.alive || source.kind === 'animal') &&
        this.visible(source, e.team as Team) &&
        (source.kind !== 'building' || source.team === e.team)
      )
        known.add(source.id);
    area.targets = [...known];
  }
  nearbyGatherSource(e: Entity, area: NonNullable<Order['gatherArea']>, accessible = false) {
    return this.nearest(
      e,
      (source) =>
        source.type === area.type &&
        dist(source, area) < 12 &&
        source.amount > 0 &&
        (source.alive || source.kind === 'animal') &&
        (source.kind !== 'building' || source.team === e.team) &&
        (area.targets.includes(source.id) || this.visible(source, e.team as Team)) &&
        (!accessible || !!this.contactPoint(e, source, radius(source) + 0.9, 'gather', false)),
    );
  }
  gather(e: Entity, t: Entity | undefined, dt: number) {
    const o = e.orders[0];
    if (t && o?.kind === 'gather' && (!o.gatherArea || this.state.tick % 20 === 0))
      this.rememberGatherArea(e, o, t);
    if (!t || (!t.alive && t.kind !== 'animal') || (t.amount <= 0 && t.type !== 'farm')) {
      const next = o?.gatherArea ? this.nearbyGatherSource(e, o.gatherArea) : undefined;
      if (next) {
        o.target = next.id;
        t = next;
        e.path = [];
        e.pathGoal = undefined;
        e.contactSlot = undefined;
        e.contactRetry = undefined;
        e.retry = 0;
        e.strike = undefined;
        e.attackPhase = undefined;
      } else {
        if (e.carry > 0) this.deposit(e, dt);
        else {
          e.orders.shift();
          e.path = [];
          e.pathGoal = undefined;
          e.contactSlot = undefined;
        }
        return;
      }
    }
    if (e.carry >= CARRY_CAPACITY) {
      this.deposit(e, dt);
      return;
    }
    if (e.retry > 0 && !e.path.length) {
      e.retry = Math.max(0, e.retry - dt);
      return;
    }
    const resource: Resource =
      t.type === 'tree'
        ? 'wood'
        : t.type === 'gold'
          ? 'gold'
          : t.type === 'stone'
            ? 'stone'
            : 'food';
    // Finish the old load before approaching the newly assigned resource. Doing
    // this after contact positioning makes the two trips fight every tick.
    if (e.carry > 0 && e.carryType !== resource) {
      this.deposit(e, dt);
      return;
    }
    if (t.kind === 'animal' && t.alive) {
      if (!this.atContact(e, t, 3, 'hunt', dt)) return;
      e.state = 'attack';
      e.dir = (Math.round(Math.atan2(t.y - e.y, t.x - e.x) / (Math.PI / 4)) + 8) % 8;
      this.strike(e, t, dt, 3, 1.2, true);
      return;
    }
    if (t.type === 'farm' && t.progress < 1) {
      this.order(e, { kind: 'build', target: t.id });
      return;
    }
    const point = this.workPoint(e, t);
    if (!point || !this.contactReady(e, t, radius(t) + 0.9, point)) {
      if (point) this.move(e, point, dt);
      else if (t.kind === 'resource') {
        const edge = o?.gatherArea ? this.nearbyGatherSource(e, o.gatherArea, true) : undefined;
        if (edge) {
          o.target = edge.id;
          e.path = [];
          e.pathGoal = undefined;
        } else {
          e.retry = 0.35;
          e.state = 'idle';
        }
      }
      return;
    }
    e.path = [];
    e.pathGoal = undefined;
    const rate =
      t.kind === 'animal'
        ? GATHER_RATES.meat
        : (GATHER_RATES[t.type as keyof typeof GATHER_RATES] ?? GATHER_RATES.berries);
    const n = Math.min(
      rate * dt,
      CARRY_CAPACITY - e.carry,
      t.type === 'farm' ? Infinity : t.amount,
    );
    e.carry += n;
    e.carryType = resource;
    e.carryMeat = t.kind === 'animal';
    e.state = 'work';
    e.dir = (Math.round(Math.atan2(t.y - e.y, t.x - e.x) / (Math.PI / 4)) + 8) % 8;
    if (t.type !== 'farm') {
      t.amount -= n;
      if (t.amount <= 0) {
        t.alive = false;
        this.state.blockedVersion++;
      }
    }
  }
  construct(e: Entity, t: Entity | undefined, dt: number, repair = false) {
    if (!t || !t.alive || t.team !== e.team) {
      e.orders.shift();
      return;
    }
    if (!this.atContact(e, t, radius(t) + 1, 'construct', dt)) return;
    e.state = 'work';
    e.dir = (Math.round(Math.atan2(t.y - e.y, t.x - e.x) / (Math.PI / 4)) + 8) % 8;
    const team = e.team as Team;
    const network = this.connected(team);
    const multiplier =
      (e.type === 'engineer' ? 2 : 1) *
      (e.civ === 'roman' &&
      network.some((id) => {
        const b = this.get(id);
        return b && dist(b, t) < 10;
      })
        ? 1.25
        : 1);
    if (repair) {
      if (t.hp >= t.maxHp) {
        e.orders.shift();
        return;
      }
      const cost = dt * 2 * multiplier;
      if (this.state.players[team].resources.wood >= cost) {
        this.state.players[team].resources.wood -= cost;
        t.hp = Math.min(t.maxHp, t.hp + dt * 15 * multiplier);
      }
      return;
    }
    if (t.progress >= 1) {
      e.orders.shift();
      if (t.type === 'farm') {
        t.amount = 1e9;
        this.order(e, { kind: 'gather', target: t.id });
      }
      return;
    }
    const increment = (dt * multiplier) / BUILDINGS[t.type].time;
    t.progress = Math.min(1, t.progress + increment);
    t.hp = Math.min(t.maxHp, t.hp + increment * t.maxHp);
    if (t.progress >= 1) {
      t.state = 'idle';
      if (t.type === 'farm') t.amount = 1e9;
      this.tell(`${buildingName(t.type, t.civ)} đã hoàn thành.`, team);
    }
  }
  connected(team: Team) {
    if (this.state.players[team].civ !== 'roman') return [];
    const all = this.owned(team).filter(
        (e) => e.progress >= 1 && (e.type === 'towncenter' || e.type === 'outpost'),
      ),
      root = all.find((e) => e.type === 'towncenter');
    if (!root) return [];
    const reached = [root.id];
    let changed = true;
    while (changed) {
      changed = false;
      for (const b of all)
        if (
          !reached.includes(b.id) &&
          all.some((a) => reached.includes(a.id) && dist(a, b) <= 12)
        ) {
          reached.push(b.id);
          changed = true;
        }
    }
    return reached.filter((id) => id !== root.id);
  }
  enemyTarget(e: Entity, range: number) {
    const valid = (o: Entity | undefined): o is Entity =>
      !!o &&
      o.alive &&
      o.team >= 0 &&
      o.team !== e.team &&
      this.visible(o, e.team as Team) &&
      dist(e, o) <= range + radius(o);
    const attacker =
        e.lastAttacker && e.lastAttacker.until >= this.state.tick
          ? this.get(e.lastAttacker.id)
          : undefined,
      current = this.get(e.strike?.target ?? e.combatTarget);
    const candidates = this.state.entities
      .filter(valid)
      .sort(
        (a, b) =>
          Number(a.kind === 'building') - Number(b.kind === 'building') ||
          Number(b.id === current?.id) - Number(a.id === current?.id) ||
          Number(b.id === attacker?.id) - Number(a.id === attacker?.id) ||
          dist(e, a) - dist(e, b) ||
          a.id - b.id,
      );
    const weaponRange =
      e.kind === 'building'
        ? (BUILDINGS[e.type].range ?? 0)
        : (unitDefinition(e.type, e.civ).range ?? 0);
    const target = candidates.find(
      (o) =>
        dist(e, o) <= weaponRange + radius(o) ||
        (!e.hold && !!this.contactPoint(e, o, weaponRange + radius(o), 'attack', false)),
    );
    e.combatTarget = target?.id;
    return target;
  }
  damage(
    a: Pick<Entity, 'kind' | 'type' | 'civ' | 'x' | 'y'> & { charge?: number },
    t: Entity,
    charge = a.charge ?? 0,
  ) {
    const profile = a.kind === 'unit' ? unitDefinition(a.type, a.civ) : undefined;
    const d = a.kind === 'building' ? (BUILDINGS[a.type].damage ?? 0) : (profile?.damage ?? 0);
    let n = d;
    const targetClass =
      t.type === 'elephant' ? 'elephant' : t.kind === 'building' ? 'building' : UNITS[t.type]?.role;
    if (targetClass) n *= profile?.bonuses?.[targetClass] ?? 1;
    if (a.type === 'lancer' && charge >= 4) n *= 1.7;
    const frontal =
      t.shield && Math.cos(Math.atan2(a.y - t.y, a.x - t.x) - (t.dir * Math.PI) / 4) > 0.1;
    if (frontal) n *= 0.45;
    const armor =
      t.kind === 'unit' ? (unitDefinition(t.type, t.civ).armor ?? 0) + (t.quality ? 2 : 0) : 2;
    return Math.max(1, n - armor * (1 - (profile?.armorPenetration ?? 0)));
  }
  shoot(a: Entity, t: Entity, damage: number, speed = 12, splash = 0) {
    const duration = Math.max(0.06, dist(a, t) / speed);
    this.state.projectiles.push({
      id: this.state.nextId++,
      x: a.x,
      y: a.y,
      target: t.id,
      team: a.team as Team,
      tx: t.x,
      ty: t.y,
      duration,
      remaining: duration,
      damage,
      splash,
      type: a.kind === 'building' ? 'arrow' : a.type,
      attacker: a.id,
      ...(splash ? { source: { kind: a.kind, type: a.type, civ: a.civ } } : {}),
    });
  }
  hit(t: Entity, n: number, team: Team, attacker?: Entity) {
    if (t.hp <= 0) return;
    t.hp -= n;
    if (attacker && attacker.team !== t.team && t.kind === 'unit')
      t.lastAttacker = { id: attacker.id, until: this.state.tick + 100 };
    if (t.hp <= 0) {
      if (t.team >= 0) this.state.stats.kills[team]++;
      if (t.kind === 'animal') {
        t.alive = false;
        t.state = 'carcass';
        t.orders = [];
        t.decayAge = 0;
      } else {
        t.alive = false;
        t.orders = [];
        t.queue = [];
        t.carry = 0;
        t.mobilization = undefined;
        t.civilOrders = undefined;
        if (t.kind === 'resource' || (t.kind === 'building' && t.state !== 'packed'))
          this.state.blockedVersion++;
      }
    }
  }
  attack(e: Entity, t: Entity, dt: number) {
    const d = e.kind === 'building' ? BUILDINGS[e.type] : unitDefinition(e.type, e.civ),
      range = d.range ?? 0;
    // Being in weapon range is enough to strike. A crowded contact slot must
    // never make a soldier stand still while an adjacent enemy hits it.
    if (e.kind === 'unit' && !e.hold && dist(e, t) > range + radius(t)) {
      if (!this.atContact(e, t, range + radius(t), 'attack', dt)) return;
    } else if (dist(e, t) > range + radius(t)) return;
    e.path = [];
    e.pathGoal = undefined;
    e.navigation = undefined;
    e.state = 'attack';
    e.dir = (Math.round(Math.atan2(t.y - e.y, t.x - e.x) / (Math.PI / 4)) + 8) % 8;
    const interval =
      e.kind === 'building'
        ? 1.6
        : unitDefinition(e.type, e.civ).cooldown * (e.type === 'cannon' && e.deployed ? 0.65 : 1);
    this.strike(e, t, dt, range, interval);
  }
  strike(e: Entity, t: Entity, dt: number, range: number, interval: number, hunt = false) {
    if (e.strike?.target !== t.id || e.strike.hunt !== hunt || (e.strike.fired && e.cooldown <= 0))
      e.strike = undefined;
    if (!e.strike) {
      if (e.cooldown > 0) {
        e.attackPhase = 3;
        return;
      }
      // Save the wind-up so loading a match never repeats or skips a blow.
      const profile = e.kind === 'unit' ? unitDefinition(e.type, e.civ) : undefined;
      const windup =
        e.kind === 'building'
          ? 0
          : hunt
            ? 0.2
            : (profile?.windup ?? (profile?.role === 'siege' ? 0.42 : range > 2 ? 0.34 : 0.28));
      e.strike = {
        target: t.id,
        elapsed: 0,
        windup,
        damage: hunt ? 12 : this.damage(e, t),
        charge: e.charge,
        fired: false,
        hunt,
      };
      e.cooldown = interval;
      e.charge = 0;
      e.attackPhase = 0;
      if (windup > 0) return;
    }
    const strike = e.strike;
    strike.elapsed += dt;
    e.attackPhase =
      strike.elapsed < strike.windup / 2
        ? 0
        : strike.elapsed < strike.windup
          ? 1
          : strike.elapsed < strike.windup + 0.15
            ? 2
            : 3;
    if (!strike.fired && strike.elapsed >= strike.windup) {
      strike.fired = true;
      if (!hunt) strike.damage = this.damage(e, t, strike.charge);
      if (range > 2) {
        const profile = e.kind === 'unit' ? unitDefinition(e.type, e.civ) : undefined,
          count = e.type === 'guardarcher' && !hunt ? 3 : 1;
        for (let i = 0; i < count; i++)
          this.shoot(
            e,
            t,
            strike.damage,
            hunt ? 3 : (profile?.projectileSpeed ?? 14),
            hunt ? 0 : (profile?.splashRadius ?? 0),
          );
      } else {
        this.hit(t, strike.damage, e.team as Team, e);
        if (e.type === 'elephant')
          for (const o of this.state.entities)
            if (o.id !== t.id && o.alive && o.team >= 0 && o.team !== e.team && dist(o, t) < 1.2)
              this.hit(o, this.damage(e, o, strike.charge) * 0.35, e.team as Team, e);
      }
      if (hunt) {
        if (t.type === 'boar') t.workTarget = e.id;
        else {
          const dx = t.x - e.x,
            dy = t.y - e.y,
            l = Math.max(0.1, Math.hypot(dx, dy));
          t.orders = [
            {
              kind: 'move',
              x: clamp(t.x + (dx / l) * 2, 2, this.size - 3),
              y: clamp(t.y + (dy / l) * 2, 2, this.size - 3),
            },
          ];
        }
      }
    }
    if (e.cooldown <= 0) e.strike = undefined;
  }
  trade(e: Entity, o: Order, dt: number) {
    const destination = this.get(o.target),
      home = this.get(o.origin ?? e.tradeHome);
    if (
      !destination?.alive ||
      !home?.alive ||
      destination.type !== 'market' ||
      home.type !== 'market' ||
      destination.team !== e.team ||
      home.team !== e.team ||
      destination.id === home.id
    ) {
      e.orders.shift();
      return;
    }
    if (dist(e, destination) > radius(destination) + 0.8) {
      this.approach(e, destination, 0.65, dt);
      return;
    }
    const reward = Math.max(
      2,
      Math.floor(dist(destination, home) * 1.4 * (unitDefinition(e.type, e.civ).tradeYield ?? 1)),
    );
    this.state.players[e.team as Team].resources.gold += reward;
    this.state.stats.gathered[e.team as Team] += reward;
    e.orders[0] = { kind: 'trade', target: home.id, origin: destination.id };
    e.path = [];
  }
  step(dt = TICK) {
    if (this.state.paused || this.state.winner !== null) return;
    this.state.tick++;
    this.pathPlans = 0;
    this.contactsTouched.clear();
    this.visibility();
    for (const team of [0, 1] as Team[]) {
      const p = this.state.players[team];
      if (p.research) {
        p.research.remaining -= dt;
        if (p.research.remaining <= 0) {
          p.age++;
          p.research = undefined;
          for (const e of this.owned(team)) if (e.kind === 'building') e.age = p.age;
          this.state.blockedVersion++;
          this.tell(`Đã tới đời ${p.age}: ${p.age === 2 ? 'Quân sự' : 'Đế quốc'}.`, team);
        }
      }
      if (p.armoryChange) {
        p.armoryChange.remaining -= dt;
        if (p.armoryChange.remaining <= 0) {
          p.armory = p.armoryChange.mode;
          p.armoryChange = undefined;
        }
      }
    }
    for (const e of [...this.state.entities]) {
      e.cooldown = Math.max(0, e.cooldown - dt);
      // Older saves or a newly placed foundation may contain an actor on blocked
      // ground. Move it to a free exit instead of leaving it trapped in masonry.
      if (
        e.alive &&
        (e.kind === 'unit' || e.kind === 'animal' || e.state === 'packed') &&
        !this.walkable(e, e.team === -1 ? 0 : e.team)
      ) {
        const exit = this.freeActorNear(e, e, new Set([e.id]), [], 10);
        if (exit) {
          e.x = exit.x;
          e.y = exit.y;
          e.path = [];
          e.pathGoal = undefined;
          e.contactSlot = undefined;
        }
      }
      if (e.kind === 'animal') {
        if (!e.alive) {
          if (e.amount > 0) {
            e.decayAge += dt;
            if (e.decayAge > 25) e.amount = Math.max(0, e.amount - dt * 0.8);
          }
          continue;
        }
        const threat = this.get(e.workTarget);
        if (threat?.alive && dist(e, threat) < 8 && e.home && dist(e, e.home) < 10) {
          if (dist(e, threat) > 1) this.approach(e, threat, 0.8, dt);
          else {
            e.state = 'attack';
            e.dir =
              (Math.round(Math.atan2(threat.y - e.y, threat.x - e.x) / (Math.PI / 4)) + 8) % 8;
            if (e.cooldown <= 0) {
              this.hit(threat, 5, 1);
              e.cooldown = 1;
            }
          }
        } else if (e.orders[0]?.kind === 'move') {
          const o = e.orders[0];
          if (this.move(e, { x: o.x!, y: o.y! }, dt)) e.orders.shift();
        } else {
          e.state = 'graze';
          if (e.home && this.state.tick % 160 === e.id % 160 && this.random() < 0.25)
            e.orders = [
              {
                kind: 'move',
                x: clamp(e.home.x + (this.random() - 0.5) * 3, 2, this.size - 3),
                y: clamp(e.home.y + (this.random() - 0.5) * 3, 2, this.size - 3),
              },
            ];
        }
        continue;
      }
      if (!e.alive || e.team < 0) continue;
      const team = e.team as Team;
      if (e.mobilization) {
        this.stepMobilization(e, dt);
        continue;
      }
      if (e.kind === 'building' && e.state !== 'packed') {
        if (e.progress < 1) continue;
        const q = e.queue[0];
        if (q && !(e.type === 'towncenter' && this.state.players[team].research)) {
          q.remaining = Math.max(0, q.remaining - dt);
          if (q.remaining <= 0 && this.population(team) < this.capacity(team)) {
            const spawnActor = { type: q.type, kind: 'unit', team, id: -1 } as Entity;
            const at = this.freeActorNear(
              { x: e.x + radius(e) + actorRadius(spawnActor) + 0.5, y: e.y },
              spawnActor,
              new Set(),
              [],
              9,
            );
            if (!at) continue;
            const u = this.entity('unit', q.type, team, at.x, at.y);
            u.quality = q.quality;
            if (q.quality) {
              u.maxHp *= 1.1;
              u.hp = u.maxHp;
            }
            u.tradeHome = e.type === 'market' ? e.id : undefined;
            if (e.rally) {
              const target = this.get(e.rallyTarget);
              if (
                worker(u) &&
                target &&
                (target.kind === 'resource' || target.kind === 'animal' || target.type === 'farm')
              )
                this.order(u, { kind: 'gather', target: target.id });
              else {
                const rally =
                  this.freeActorNear(
                    e.rally,
                    u,
                    new Set([u.id]),
                    this.state.entities
                      .filter(
                        (a) =>
                          a.alive &&
                          a.kind === 'unit' &&
                          a.id !== u.id &&
                          a.orders[0]?.x !== undefined,
                      )
                      .map((a) => ({
                        point: { x: a.orders[0].x!, y: a.orders[0].y! },
                        radius: actorRadius(a),
                      })),
                    10,
                  ) ?? e.rally;
                this.order(u, { kind: worker(u) ? 'move' : 'attackmove', ...rally });
              }
            }
            e.queue.shift();
          }
        }
        if (BUILDINGS[e.type].damage) {
          const t = this.enemyTarget(e, BUILDINGS[e.type].range ?? 5);
          if (t) this.attack(e, t, dt);
        }
        continue;
      }
      const o = e.orders[0];
      e.state = e.kind === 'building' ? 'packed' : 'idle';
      e.returning = false;
      if (e.kind === 'building') {
        if (o && o.x !== undefined && o.y !== undefined) {
          this.move(e, { x: o.x, y: o.y }, dt);
          e.state = 'packed';
          if (dist(e, { x: o.x, y: o.y }) < 0.6) e.orders.shift();
        }
        continue;
      }
      const profile = unitDefinition(e.type, e.civ),
        striking = this.get(e.strike?.target),
        threatened =
          striking?.alive &&
          striking.kind === 'unit' &&
          striking.team !== team &&
          this.visible(striking, team) &&
          dist(e, striking) <= (profile.range ?? 1) + radius(striking)
            ? striking
            : e.lastAttacker && e.lastAttacker.until >= this.state.tick
              ? this.get(e.lastAttacker.id)
              : undefined;
      // Movement takes priority over combat until arrival. Workers may defend
      // themselves while working; soldiers acquire targets when idle or on attack-move.
      if (
        worker(e) &&
        profile.damage > 0 &&
        !o?.passive &&
        o?.kind !== 'move' &&
        o?.kind !== 'attackmove' &&
        o?.kind !== 'attack'
      ) {
        const target =
          threatened?.alive &&
          this.visible(threatened, team) &&
          dist(e, threatened) <= (profile.range ?? 1) + radius(threatened) + 1
            ? threatened
            : undefined;
        if (target) {
          this.attack(e, target, dt);
          continue;
        }
      }
      if (o) {
        const t = this.get(o.target);
        if (o.kind === 'gather' && worker(e)) this.gather(e, t, dt);
        else if ((o.kind === 'build' || o.kind === 'repair') && worker(e))
          this.construct(e, t, dt, o.kind === 'repair');
        else if (o.kind === 'trade' && e.type === 'trader') this.trade(e, o, dt);
        else if (o.kind === 'deliver' && worker(e)) {
          if (e.carry > 0) this.deposit(e, dt);
          else e.orders.shift();
        } else if (o.kind === 'attack') {
          if (!t?.alive || !this.visible(t, team)) {
            e.orders.shift();
          } else this.attack(e, t, dt);
        } else if (o.kind === 'move' || o.kind === 'attackmove') {
          const target =
            o.kind === 'attackmove' && !worker(e) && e.type !== 'trader'
              ? this.enemyTarget(e, Math.max(7, profile.range ?? 0))
              : undefined;
          if (target) this.attack(e, target, dt);
          else if (o.x !== undefined && o.y !== undefined && this.move(e, { x: o.x, y: o.y }, dt))
            e.orders.shift();
        } else e.orders.shift();
      } else if (!worker(e) && e.type !== 'trader') {
        const t = this.enemyTarget(
          e,
          e.hold ? (profile.range ?? 1) : Math.max(6, profile.range ?? 0),
        );
        if (t) this.attack(e, t, dt);
      }
    }
    this.separateActors();
    for (const e of this.state.entities)
      if (e.state !== 'attack' || !e.alive) {
        e.strike = undefined;
        e.attackPhase = undefined;
      }
    for (const e of this.state.entities)
      if (e.contactSlot && !this.contactsTouched.has(e.id)) e.contactSlot = undefined;
    const impacts = this.state.projectiles.filter((p) => {
      p.remaining -= dt;
      return p.remaining <= 0;
    });
    this.state.projectiles = this.state.projectiles.filter((p) => p.remaining > 0);
    for (const p of impacts) {
      const t = this.get(p.target);
      if (t && t.hp > 0 && ((t.team !== p.team && t.team >= 0) || t.kind === 'animal'))
        this.hit(t, p.damage, p.team, this.get(p.attacker));
      // The main target's building bonus/armor must not leak into nearby units.
      // Retain the weapon even if its operator dies before the stone lands.
      const source =
        p.source ??
        (UNITS[p.type]
          ? { kind: 'unit' as const, type: p.type, civ: this.state.players[p.team].civ }
          : undefined);
      if (p.splash)
        for (const e of this.state.entities)
          if (
            e.id !== p.target &&
            e.alive &&
            e.team >= 0 &&
            e.team !== p.team &&
            dist(e, { x: p.tx, y: p.ty }) < p.splash
          )
            this.hit(
              e,
              (source ? this.damage({ ...source, x: p.x, y: p.y }, e) : p.damage) * 0.55,
              p.team,
              this.get(p.attacker),
            );
    }
    // Evaluate both capitals after every impact, so simultaneous destruction is a draw.
    const capitals = ([0, 1] as Team[]).map((team) =>
      this.state.entities.some((e) => e.team === team && e.type === 'towncenter' && e.alive),
    );
    if (!capitals[0] || !capitals[1])
      this.state.winner = !capitals[0] && !capitals[1] ? 'draw' : capitals[0] ? 0 : 1;
    this.state.aiTimer += dt;
    if (this.state.aiTimer >= 2) {
      this.state.aiTimer = 0;
      this.ai();
    }
    if (this.state.tick % 100 === 0)
      this.state.entities = this.state.entities.filter(
        (e) => e.alive || (e.kind === 'animal' && e.amount > 0) || e.type === 'towncenter',
      );
  }
  ai() {
    const team: Team = 1,
      p = this.state.players[team],
      all = this.owned(team),
      tc = all.find((e) => e.type === 'towncenter');
    if (!tc) return;
    if (p.civ === 'daiviet' && p.age >= 2) {
      const threatened = this.state.entities.some(
        (e) =>
          e.alive &&
          e.team === 0 &&
          e.kind === 'unit' &&
          unitDefinition(e.type, e.civ).role !== 'civilian' &&
          this.visible(e, team) &&
          dist(e, tc) <= 18,
      );
      if (threatened) {
        p.reserveThreatAt = this.state.tick * TICK;
        const limit =
          this.state.config.difficulty === 'easy'
            ? 2
            : this.state.config.difficulty === 'hard'
              ? 8
              : 6;
        const active = all.filter((e) => e.type === 'villager' && !e.mobilization);
        const amount = Math.max(0, Math.min(limit - this.reserveCount(team), active.length - 10));
        const candidates = active
          .filter((e) => !['build', 'repair'].includes(e.orders[0]?.kind ?? ''))
          .sort((a, b) => dist(a, tc) - dist(b, tc) || a.id - b.id)
          .slice(0, amount);
        this.command({ type: 'mobilize', ids: candidates.map((e) => e.id) }, team);
      } else if (this.state.tick * TICK - (p.reserveThreatAt ?? 0) >= 30) {
        this.command(
          {
            type: 'demobilize',
            ids: all.filter((e) => e.type === 'militia' && !e.mobilization).map((e) => e.id),
          },
          team,
        );
      }
    }
    const villagers = all.filter((e) => worker(e) && !e.mobilization);
    const allocated: Record<Resource, number> = { food: 0, wood: 0, gold: 0, stone: 0 };
    const category = (o: Entity): Resource =>
      o.type === 'tree'
        ? 'wood'
        : o.type === 'gold'
          ? 'gold'
          : o.type === 'stone'
            ? 'stone'
            : 'food';
    for (const v of villagers) {
      const t = this.get(v.orders[0]?.target);
      if (v.orders[0]?.kind === 'gather' && t) allocated[category(t)]++;
    }
    const weights: Record<Resource, number> = { food: 0.4, wood: 0.35, gold: 0.22, stone: 0.03 };
    for (const e of villagers)
      if (!e.orders.length) {
        if (e.carry > 0) {
          const t = this.nearest(
            e,
            (o) =>
              (o.alive || o.kind === 'animal') &&
              this.visible(o, team) &&
              o.amount > 0 &&
              category(o) === e.carryType &&
              (o.kind === 'resource' || o.kind === 'animal' || o.type === 'farm'),
          );
          if (t) {
            this.order(e, { kind: 'gather', target: t.id });
            continue;
          }
          this.deposit(e, 2);
          continue;
        }
        const priorities = [...resources].sort(
          (a, b) => allocated[a] / weights[a] - allocated[b] / weights[b],
        );
        for (const need of priorities) {
          const type = need === 'food' ? 'berries' : need === 'wood' ? 'tree' : need;
          let source = this.nearest(
            e,
            (o) =>
              o.alive &&
              this.visible(o, team) &&
              ((o.type === type && o.amount > 0) ||
                (need === 'food' && o.type === 'farm' && o.team === team && o.progress >= 1)),
          );
          if (!source && need === 'food')
            source = this.nearest(
              e,
              (o) => o.kind === 'animal' && o.amount > 0 && this.visible(o, team),
            );
          if (source) {
            this.order(e, { kind: 'gather', target: source.id });
            allocated[need]++;
            break;
          }
        }
      }
    const buildings = all.filter((e) => e.kind === 'building'),
      count = (type: string) => buildings.filter((e) => e.type === type).length;
    const build = (type: string) => {
      if (!buildingAvailable(type, p.civ, p.age)) return false;
      const busy = buildings.filter((e) => e.progress < 1).length;
      if (busy >= 2) return false;
      const v = villagers.find(
        (e) => e.orders[0]?.kind !== 'build' && e.orders[0]?.kind !== 'repair',
      );
      if (!v) return false;
      for (let i = 0; i < 60; i++) {
        const r = 5 + this.random() * 7,
          a = this.random() * Math.PI * 2,
          x = Math.round(tc.x + Math.cos(a) * r),
          y = Math.round(tc.y + Math.sin(a) * r);
        const at = snapBuilding(type, { x, y }, p.civ);
        if (this.canPlace(type, at, team) && this.afford(team, BUILDINGS[type].cost)) {
          this.command({ type: 'build', building: type, x: at.x, y: at.y, builders: [v.id] }, team);
          return true;
        }
      }
      return false;
    };
    const savingForAge =
      p.age < 3 && villagers.length >= 12 && !p.research && this.state.tick * TICK > 60;
    const maxVillagers =
      this.state.config.difficulty === 'easy'
        ? 12
        : this.state.config.difficulty === 'hard'
          ? 22
          : 17;
    if (villagers.length < maxVillagers && tc.queue.length < 2 && !p.research && !savingForAge)
      this.command({ type: 'train', building: tc.id, unit: 'villager' }, team);
    if (
      this.population(team) + this.reserved(team) >= this.capacity(team) - 3 &&
      this.capacity(team) < 100
    )
      build('house');
    if (!count('barracks')) build('barracks');
    if (p.age >= 2 && !count('range')) build('range');
    if (!count('stable') && p.age >= 2) build('stable');
    const berries = this.state.entities.some(
      (e) => e.type === 'berries' && e.alive && dist(e, tc) < 15,
    );
    if (!berries && count('farm') < Math.ceil(villagers.length / 3)) build('farm');
    if (p.civ !== 'ottoman' && p.age >= 2 && this.state.tick > 2200 && !count('workshop'))
      build('workshop');
    if (p.civ === 'tang' && p.age >= 2 && !count('armory')) build('armory');
    if (p.civ === 'ottoman' && p.age === 3 && !count('foundry')) build('foundry');
    if (
      p.age < 3 &&
      !p.research &&
      villagers.length >= 10 &&
      this.afford(team, AGE_COSTS[p.age - 1])
    )
      this.command({ type: 'advance' }, team);
    if (p.resources.gold < 80 && p.resources.stone >= 100) {
      if (!count('market') && p.age >= 2) build('market');
      else this.command({ type: 'exchange', resource: 'stone', sell: true }, team);
    }
    const military = all.filter(
      (e) =>
        e.kind === 'unit' &&
        !e.mobilization &&
        unitDefinition(e.type, e.civ).role !== 'civilian' &&
        e.type !== 'scout',
    );
    const limit =
      this.state.config.difficulty === 'easy'
        ? 16
        : this.state.config.difficulty === 'hard'
          ? 42
          : 28;
    if (military.length < limit && (!savingForAge || military.length < 3))
      for (const b of buildings) {
        if (b.queue.length > 1 || b.progress < 1) continue;
        const choices = availableUnits(b.type, p.civ, p.age).filter(
          ([k, d]) => d.role !== 'civilian' && k !== 'scout',
        );
        if (!choices.length) continue;
        const [u] = choices[Math.floor(this.random() * choices.length)];
        this.command({ type: 'train', building: b.id, unit: u }, team);
      }
    const seenCapital = this.state.entities.find(
      (e) => e.type === 'towncenter' && e.team === 0 && e.alive && this.visible(e, 1),
    );
    if (seenCapital) this.state.aiKnown = { x: seenCapital.x, y: seenCapital.y };
    const scout = all.find((e) => e.type === 'scout');
    if (scout && !scout.orders.length && !this.state.aiKnown)
      this.order(scout, {
        kind: 'move',
        x: (this.state.spawnPoints ?? mapLayout(this.size))[0].x + (this.random() - 0.5) * 7,
        y: (this.state.spawnPoints ?? mapLayout(this.size))[0].y + (this.random() - 0.5) * 7,
      });
    const seconds = this.state.tick * TICK,
      first =
        this.state.config.difficulty === 'easy'
          ? 300
          : this.state.config.difficulty === 'hard'
            ? 150
            : 220;
    if (seconds > first && seconds - this.state.aiAttack > 55 && military.length >= 5) {
      this.state.aiAttack = seconds;
      const destination = this.state.aiKnown ?? (this.state.spawnPoints ?? mapLayout(this.size))[0];
      military.forEach((e) =>
        this.order(e, {
          kind: 'attackmove',
          x: destination.x + (this.random() - 0.5) * 4,
          y: destination.y + (this.random() - 0.5) * 4,
        }),
      );
    }
  }
  snapshot(): Snapshot {
    this.visibility();
    return {
      mapSize: this.size,
      spawnPoints: this.state.spawnPoints ?? mapLayout(this.size),
      tick: this.state.tick,
      entities: this.state.entities.filter(
        (e) =>
          (e.alive || (e.kind === 'animal' && e.amount > 0)) &&
          (e.team === 0 || this.visible(e, 0)),
      ),
      player: this.state.players[0],
      population: this.population(0),
      capacity: this.capacity(0),
      terrain: this.state.terrain,
      vision: Array.from(this.visions[0]),
      projectiles: this.state.projectiles.filter((p) => this.visible(p, 0)),
      winner: this.state.winner,
      messages: this.state.messages,
      speed: this.state.speed,
      paused: this.state.paused,
      stats: this.state.stats,
      config: this.state.config,
      connectedOutposts: this.connected(0),
    };
  }
  save(): WorldState {
    return JSON.parse(JSON.stringify(this.state));
  }
  migrateCourtyards() {
    if (this.state.layoutVersion === 2) return;
    const capitals = this.state.entities.filter((e) => e.alive && e.type === 'towncenter');
    let changed = 0;
    for (const b of this.state.entities) {
      if (!b.alive || b.kind !== 'building' || b.type === 'towncenter' || b.state === 'packed')
        continue;
      const half = buildingSize(b.type, b.civ) / 2;
      if (
        !capitals.some(
          (tc) => Math.abs(b.x - tc.x) < 4 + half + 0.15 && Math.abs(b.y - tc.y) < 4 + half + 0.15,
        )
      )
        continue;
      const neighbours = this.state.entities.filter((e) => e.id !== b.id),
        origin = { x: b.x, y: b.y };
      let found = false;
      for (let r = 1; r <= 20 && !found; r++)
        for (let i = 0; i < r * 12; i++) {
          const a = (i / (r * 12)) * Math.PI * 2,
            p = snapBuilding(
              b.type,
              {
                x: origin.x + Math.cos(a) * r,
                y: origin.y + Math.sin(a) * r,
              },
              b.civ,
            );
          if (
            canPlaceBuilding(b.type, p, this.size, this.state.terrain, neighbours, undefined, b.civ)
          ) {
            b.x = p.x;
            b.y = p.y;
            found = true;
            changed++;
            break;
          }
        }
    }
    this.state.layoutVersion = 2;
    this.state.blockedVersion++;
    if (changed)
      this.tell(`Đã dời ${changed} công trình gần thành chính để chừa sân cho ba đời kiến trúc.`);
  }
  load(data: WorldState) {
    const size = data?.mapSize ?? Math.sqrt(data?.terrain?.length ?? 0);
    if (
      !data ||
      data.version !== 1 ||
      !Array.isArray(data.entities) ||
      data.entities.length > 10000 ||
      !Array.isArray(data.terrain) ||
      ![64, 96].includes(size) ||
      data.terrain.length !== size * size ||
      !Array.isArray(data.players) ||
      data.players.length !== 2 ||
      !CIVS[data.config?.civ] ||
      !CIVS[data.config?.enemy]
    )
      throw new Error('Bản lưu không hợp lệ hoặc không đúng phiên bản.');
    if (
      ![1, 1.5, 2].includes(data.speed) ||
      !Number.isFinite(data.tick) ||
      !data.players.every(
        (p) =>
          [1, 2, 3].includes(p.age) &&
          CIVS[p.civ] &&
          (p.reserveThreatAt === undefined ||
            (Number.isFinite(p.reserveThreatAt) && p.reserveThreatAt >= 0)) &&
          resources.every((r) => Number.isFinite(p.resources?.[r]) && p.resources[r] >= 0),
      ) ||
      !Array.isArray(data.projectiles) ||
      !data.terrain.every((n) => [0, 1, 2, 3].includes(n))
    )
      throw new Error('Trạng thái kinh tế hoặc bản đồ trong bản lưu không hợp lệ.');
    if (
      !data.entities.every(
        (e) =>
          Number.isFinite(e.x) &&
          Number.isFinite(e.y) &&
          e.x >= 0 &&
          e.x < size &&
          e.y >= 0 &&
          e.y < size &&
          Array.isArray(e.orders) &&
          Array.isArray(e.queue) &&
          (e.barrierAxis === undefined || e.barrierAxis === 'x' || e.barrierAxis === 'y') &&
          (e.civilOrders === undefined || Array.isArray(e.civilOrders)) &&
          (e.mobilization === undefined ||
            (e.civ === 'daiviet' &&
              (e.team === 0 || e.team === 1) &&
              e.kind === 'unit' &&
              ((e.type === 'villager' && e.mobilization.target === 'militia') ||
                (e.type === 'militia' && e.mobilization.target === 'villager')) &&
              Number.isInteger(e.mobilization.barracks) &&
              e.mobilization.total === 8 &&
              Number.isFinite(e.mobilization.remaining) &&
              e.mobilization.remaining > 0 &&
              e.mobilization.remaining <= 8 &&
              ['deliver', 'travel', 'train'].includes(e.mobilization.phase) &&
              e.mobilization.cost &&
              typeof e.mobilization.cost === 'object' &&
              Object.entries(e.mobilization.cost).every(
                ([r, n]) =>
                  resources.includes(r as Resource) &&
                  n ===
                    (e.mobilization!.target === 'militia'
                      ? r === 'food'
                        ? 20
                        : r === 'wood'
                          ? 10
                          : -1
                      : 0),
              ) &&
              (e.mobilization.target !== 'militia' ||
                (e.mobilization.cost.food === 20 && e.mobilization.cost.wood === 10)))) &&
          ((e.kind === 'unit' && unitDefinition(e.type, e.civ)) ||
            (e.kind === 'building' && BUILDINGS[e.type]) ||
            (e.kind === 'animal' && ANIMAL_FOOD[e.type]) ||
            (e.kind === 'resource' && ['tree', 'gold', 'stone', 'berries'].includes(e.type))),
      )
    )
      throw new Error('Dữ liệu đơn vị trong bản lưu không hợp lệ.');
    this.state = JSON.parse(JSON.stringify(data));
    this.migrateCourtyards();
    this.visions = [new Uint8Array(size * size), new Uint8Array(size * size)];
    this.grids = [new Uint8Array(size * size), new Uint8Array(size * size)];
    this.gridVersion = -1;
    this.regionVersion = -1;
    this.regions = [];
    this.visibility();
  }
}
