import type { CivId, Cost, Point, Resource } from './data.ts';
export type Team = 0 | 1;
export type Order = {
  kind: 'move' | 'attackmove' | 'attack' | 'gather' | 'build' | 'repair' | 'trade' | 'deliver';
  x?: number;
  y?: number;
  target?: number;
  origin?: number;
  passive?: boolean;
  gatherArea?: Point & { type: string; targets: number[] };
};
export interface Entity extends Point {
  id: number;
  kind: 'unit' | 'building' | 'resource' | 'animal';
  type: string;
  team: Team | -1;
  civ: CivId;
  hp: number;
  maxHp: number;
  age: number;
  dir: number;
  state: string;
  progress: number;
  amount: number;
  alive: boolean;
  orders: Order[];
  path: Point[];
  pathGoal?: Point;
  pathVersion?: number;
  navigation?: { waypoint: Point; best: number; stalled: number; avoidUntil: number };
  barrierAxis?: 'x' | 'y';
  combatTarget?: number;
  lastAttacker?: { id: number; until: number };
  retry: number;
  cooldown: number;
  carry: number;
  carryType?: Resource;
  carryMeat: boolean;
  returning?: boolean;
  queue: { type: string; remaining: number; total: number; cost: Cost; quality: boolean }[];
  rally?: Point;
  rallyTarget?: number;
  shield: boolean;
  deployed: boolean;
  hold: boolean;
  charge: number;
  workTarget?: number;
  decayAge: number;
  home?: Point;
  tradeHome?: number;
  quality?: boolean;
  contactSlot?: Point & { target: number; mode: string; targetX: number; targetY: number };
  contactRetry?: Point & { target: number; mode: string; until: number; grid: number };
  attackPhase?: 0 | 1 | 2 | 3;
  civilOrders?: Order[];
  mobilization?: {
    target: 'militia' | 'villager';
    barracks: number;
    remaining: number;
    total: number;
    cost: Cost;
    phase: 'deliver' | 'travel' | 'train';
  };
  strike?: {
    target: number;
    elapsed: number;
    windup: number;
    damage: number;
    charge: number;
    fired: boolean;
    hunt: boolean;
  };
}
export interface Player {
  civ: CivId;
  age: number;
  resources: Record<Resource, number>;
  research?: { remaining: number; total: number; cost: Cost };
  armory: 'speed' | 'quality';
  armoryChange?: { remaining: number; mode: 'speed' | 'quality' };
  lost: boolean;
  reserveThreatAt?: number;
}
export interface Config {
  civ: CivId;
  enemy: CivId;
  map: 'plains' | 'ford' | 'passes';
  difficulty: 'easy' | 'normal' | 'hard';
  seed: number;
  mapSize?: 64 | 96;
}
export interface Projectile extends Point {
  id: number;
  target: number;
  team: Team;
  tx: number;
  ty: number;
  duration: number;
  remaining: number;
  damage: number;
  splash: number;
  type: string;
  source?: Pick<Entity, 'kind' | 'type' | 'civ'>;
  attacker?: number;
}
export interface WorldState {
  mapSize?: number;
  spawnPoints?: Point[];
  layoutVersion?: 2;
  version: 1;
  config: Config;
  tick: number;
  nextId: number;
  rng: number;
  entities: Entity[];
  players: [Player, Player];
  terrain: number[];
  projectiles: Projectile[];
  winner: Team | 'draw' | null;
  paused: boolean;
  speed: number;
  aiTimer: number;
  aiAttack: number;
  aiKnown?: Point;
  blockedVersion: number;
  messages: { text: string; tick: number }[];
  stats: { kills: [number, number]; gathered: [number, number] };
}
export interface Snapshot {
  mapSize: number;
  spawnPoints: Point[];
  tick: number;
  entities: Entity[];
  player: Player;
  population: number;
  capacity: number;
  terrain: number[];
  vision: number[];
  projectiles: Projectile[];
  winner: Team | 'draw' | null;
  messages: { text: string; tick: number }[];
  speed: number;
  paused: boolean;
  stats: WorldState['stats'];
  config: Config;
  connectedOutposts: number[];
}
export type Command =
  | { type: 'mobilize' | 'demobilize'; ids: number[] }
  | { type: 'orders'; ids: number[]; order: Order; append?: boolean }
  | {
      type: 'build';
      building: string;
      x: number;
      y: number;
      builders: number[];
      axis?: 'x' | 'y';
      append?: boolean;
    }
  | { type: 'train'; building: number; unit: string }
  | { type: 'cancelqueue'; building: number }
  | { type: 'advance' }
  | { type: 'canceladvance' }
  | {
      type: 'stop' | 'hold' | 'shield' | 'deploy' | 'pack' | 'retreat';
      ids: number[];
      x?: number;
      y?: number;
    }
  | { type: 'rally'; id: number; x: number; y: number; target?: number }
  | { type: 'armory'; mode: 'speed' | 'quality' }
  | { type: 'exchange'; resource: Resource; sell: boolean }
  | { type: 'pause' }
  | { type: 'speed'; value: number };
export type WorkerMessage =
  | { type: 'start'; config: Config }
  | { type: 'command'; command: Command }
  | { type: 'save'; action?: 'manual' | 'download' | 'quit'; pausedOnLoad?: boolean }
  | { type: 'load'; state: WorldState };
