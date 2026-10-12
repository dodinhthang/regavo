import metadata from '../daiviet-frames.json' with { type: 'json' };
import cargoMetadata from '../daiviet-cargo-frames.json' with { type: 'json' };
import walkMetadata from '../daiviet-walk-calibration.json' with { type: 'json' };
import workerMetadata from '../daiviet-worker-calibration.json' with { type: 'json' };
import { loadDaiVietDragon } from '../daiviet-emblem.ts';
import type {
  BuildingArtDefinition,
  PoseReference,
  SheetArtDefinition,
  UnitArtDefinition,
} from '../civilization-art-definition.ts';

const earlyBuildings = [
  'towncenter',
  'house',
  'barracks',
  'stable',
  'range',
  'market',
  'granary',
  'lumbercamp',
  'miningcamp',
  'workshop',
  'tower',
  'fortress',
];
const lateBuildings = [
  'towncenter',
  'house',
  'lumbercamp',
  'miningcamp',
  'granary',
  'farm',
  'barracks',
  'stable',
  'range',
  'market',
  'workshop',
  'tower',
  'woodwall',
  'woodgate',
  'stonewall',
  'stonegate',
  'fortress',
];
const buildings: Record<string, BuildingArtDefinition[]> = {};
for (const type of lateBuildings) {
  buildings[type] = [1, 2, 3].map((age) => {
    const barrier = ['woodwall', 'woodgate', 'stonewall', 'stonegate'].includes(type);
    let sheet = 'buildings-age' + age,
      row = earlyBuildings.indexOf(type);
    if (barrier || age === 3) {
      sheet = 'buildings-unified-age3';
      row = lateBuildings.indexOf(type);
      if (!barrier && (type === 'towncenter' || type === 'house')) {
        sheet = 'buildings-towncenter-house-age3-v10';
        row = type === 'towncenter' ? 0 : 1;
      }
    } else if (type === 'farm') {
      sheet = 'buildings-farms';
      row = age - 1;
    } else if (type === 'tower') {
      sheet = 'buildings-flag-tower';
      row = 0;
    }
    return {
      sheet,
      row,
      isolated: age === 3,
      integratedFlag: age === 3 || type === 'tower',
      preserveAspect: age === 3,
      banner: type === 'towncenter' && age < 3,
    };
  });
}
buildings.outpost = buildings.tower;

const rows: Record<string, readonly [string, number, number]> = {
  spear: ['infantry', 0, 50],
  sword: ['infantry', 1, 50],
  archer: ['infantry', 2, 50],
  crossbowman: ['infantry', 3, 50],
  villager: ['people', 0, 48],
  militia: ['people', 1, 50],
  handcannoneer: ['people', 2, 50],
  scout: ['mounted', 0, 80],
  lightcavalry: ['mounted', 1, 82],
  trader: ['mounted', 2, 66],
  elephant: ['mounted', 3, 132],
  daivietcannon: ['cannon', 0, 76],
};
const units: Record<string, UnitArtDefinition> = {};
for (const [type, [group, row, height]] of Object.entries(rows)) {
  const reference = { sheet: `units-${group}-walk-a`, row };
  const idle: PoseReference = { ...reference, geometry: 'walking' };
  const order = group === 'mounted' ? ['a', 'c', 'b', 'd'] : ['a', 'd', 'b', 'c'];
  const walk: PoseReference[] =
    group === 'cannon'
      ? [0, 1].map((row) => ({ sheet: reference.sheet, row, geometry: 'walking' }))
      : order.map((pose) => ({ sheet: `units-${group}-walk-${pose}`, row, geometry: 'walking' }));
  const attack: PoseReference[] =
    group === 'cannon'
      ? [0, 2, 3, 2].map((row) => ({ sheet: reference.sheet, row }))
      : ['windup', 'windup', 'impact', 'impact'].map((pose) => ({
          sheet: `units-${group}-${pose}`,
          row,
        }));
  const actions: UnitArtDefinition['actions'] = {
    idle: [idle],
    walk,
    carry: walk,
    attack,
    hunt: attack,
  };
  const unit: UnitArtDefinition = { height, reference, actions };
  if (type === 'villager') {
    actions.carry = order.map((pose) => ({
      sheet: `units-people-walk-${pose}`,
      row: 3,
      geometry: 'walking',
    }));
    for (const [action, row] of Object.entries({ harvest: 0, work: 0, chop: 1, mine: 2, build: 3 }))
      actions[action] = [{ sheet: 'units-worker-tools', row, geometry: 'working' }];
    unit.cargo = Object.fromEntries(
      ['wood', 'gold', 'stone', 'meat'].map((resource) => [
        resource,
        [0, 1, 2, 3].map((row) => ({
          sheet: 'units-cargo-' + resource,
          row,
          geometry: 'cargo' as const,
        })),
      ]),
    );
  }
  units[type] = unit;
}

export const DAI_VIET_ART: SheetArtDefinition = {
  kind: 'sheets',
  id: 'daiviet',
  idleFrame: 0,
  sheets: { ...metadata, ...cargoMetadata },
  unitSheets: Object.keys({ ...metadata, ...cargoMetadata }).filter((key) =>
    key.startsWith('units-'),
  ),
  headings: [0, 0, 1, 1, 1, 3, 2, 2],
  buildings,
  units,
  walkCalibrations: walkMetadata,
  workerCalibrations: { 'units-worker-tools': workerMetadata },
  loadDecoration: loadDaiVietDragon,
};
