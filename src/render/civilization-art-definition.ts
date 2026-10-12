import { carryResource } from './cargo.ts';
import type { WalkCalibration, WorkerCalibration } from './unit-calibration.ts';

export type ArtSheet = {
  file: string;
  frames: number[][];
  dimensions?: number[];
  foundations?: number[][];
  barrierSockets?: Record<string, number[]>;
};
export type PoseReference = {
  sheet: string;
  row: number;
  geometry?: 'walking' | 'working' | 'cargo';
};
export type UnitArtDefinition = {
  height: number;
  reference: PoseReference;
  actions: Record<string, readonly PoseReference[]>;
  cargo?: Partial<Record<ReturnType<typeof carryResource>, readonly PoseReference[]>>;
};
export type BuildingArtDefinition = {
  sheet: string;
  row: number;
  isolated?: boolean;
  integratedFlag?: boolean;
  preserveAspect?: boolean;
  banner?: boolean;
};
export type SheetArtDefinition = {
  kind: 'sheets';
  id: string;
  idleFrame?: number;
  sheets: Record<string, ArtSheet>;
  unitSheets?: readonly string[];
  headings: readonly number[];
  buildings: Record<string, readonly BuildingArtDefinition[]>;
  units: Record<string, UnitArtDefinition>;
  walkCalibrations?: Record<string, WalkCalibration[]>;
  workerCalibrations?: Record<string, WorkerCalibration[]>;
  loadDecoration?: () => Promise<boolean>;
};
export type SharedArtDefinition = {
  kind: 'shared';
  column: number;
  idleFrame?: number;
};
export type CivilizationArtDefinition = SharedArtDefinition | SheetArtDefinition;

export function selectBuildingArt(definition: SheetArtDefinition, type: string, age: number) {
  const choices = definition.buildings[type];
  return choices?.[Math.max(1, Math.min(3, Math.round(age))) - 1];
}

/** Atlas layouts and pose order belong to data; the selector has no civilization branches. */
export function selectUnitArt(
  definition: SheetArtDefinition,
  type: string,
  phase: number,
  direction: number,
  action: string,
  activity = '',
) {
  const unit = definition.units[type];
  if (!unit) return undefined;
  if (unit.actions[action]?.[0]?.geometry === 'working') {
    action =
      action === 'chop' || activity.includes('wood')
        ? 'chop'
        : action === 'mine' || /gold|stone/.test(activity)
          ? 'mine'
          : action === 'build'
            ? 'build'
            : 'harvest';
  }
  const choices =
    (action === 'carry' ? unit.cargo?.[carryResource(activity)] : undefined) ??
    unit.actions[action] ??
    unit.actions.idle;
  if (!choices?.length) return undefined;
  phase = ((Math.round(phase) % 4) + 4) % 4;
  const pose = choices[phase % choices.length];
  const shot = definition.headings[((Math.round(direction) % 8) + 8) % 8];
  const index = pose.row * 4 + shot;
  const sheet = definition.sheets[pose.sheet];
  const frame = sheet?.frames[index];
  if (!frame) return undefined;
  return { unit, pose, shot, index, frame, phase };
}
