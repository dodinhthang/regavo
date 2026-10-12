import {
  civilizationUnits,
  buildingAvailable,
  buildingFootprintSize,
  UNITS,
  type CivId,
} from '../game/data.ts';

export type PreviewModel = {
  kind: 'building' | 'unit' | 'resource';
  type: string;
  x: number;
  y: number;
  dir?: number;
  /** Presentation scale about the ground anchor, independent of match geometry. */
  scale?: number;
};

/** The diorama is a 16×16 terrain plane; keep complete ground contacts inside its banks. */
export function previewGroundRadius(model: PreviewModel, age: number, civ?: CivId) {
  const scale = model.scale ?? 1;
  if (model.kind === 'building') return (buildingFootprintSize(model.type, age, civ) / 2) * scale;
  if (model.kind === 'resource') return 0.4 * scale;
  if (model.type === 'elephant' || UNITS[model.type]?.role === 'siege') return 1.35 * scale;
  if (model.type === 'trader') return scale;
  return (UNITS[model.type]?.role === 'cavalry' ? 0.85 : 0.45) * scale;
}

/** A small settlement of unlocked match models, with presentation sizing for the lobby. */
export function empirePreviewLayout(civ: CivId, age: number): PreviewModel[] {
  // Dai Viet military halls have taller authored silhouettes than the other factions.
  // Size the entire model uniformly so its roof and columns keep their proportions.
  const scales: Record<string, number> =
    civ === 'daiviet'
      ? {
          towncenter: 0.95,
          barracks: 0.82,
          stable: 0.82,
          range: 0.82,
          granary: 0.88,
          farm: 0.94,
          daivietcannon: 0.9,
        }
      : {};
  const models: PreviewModel[] = [
    {
      kind: 'building',
      type: 'towncenter',
      x: civ === 'daiviet' ? -1.5 : 0,
      y: civ === 'daiviet' ? -1.5 : -2,
    },
  ];
  const buildings: [string, number, number][] = [
    ['house', civ === 'daiviet' ? -5.5 : -4.5, 0],
    ['house', -4.5, 3.5],
    ['barracks', 5, -2],
    ['stable', 6.3, 2.4],
    ['range', -0.5, 6.5],
    ['granary', -6.5, 3.5],
    ['farm', -3.5, 6.5],
  ];
  for (const [type, x, y] of buildings)
    if (buildingAvailable(type, civ, age)) models.push({ kind: 'building', type, x, y });
  const roster = civilizationUnits(civ, age);
  const infantry = roster.filter(([, d]) => d.role === 'infantry');
  const primary = infantry.at(-1)?.[0] ?? 'spear';
  for (let row = 0; row < 2; row++)
    for (let column = 0; column < 3; column++)
      models.push({
        kind: 'unit',
        type: row === 0 ? primary : 'spear',
        x: 0.4 + column * (civ === 'daiviet' ? 0.95 : 0.85) + row * 0.9,
        y: (civ === 'daiviet' ? 4.2 : 4) + row * (civ === 'daiviet' ? 0.95 : 0.9),
        dir: 1,
      });
  const ranged = roster.filter(([, d]) => d.role === 'ranged');
  if (ranged.length)
    for (let i = 0; i < 3; i++)
      models.push({ kind: 'unit', type: ranged.at(-1)![0], x: 4.5 + i * 0.85, y: 7.2, dir: 1 });
  const cavalry = roster
    .filter(([type, d]) => d.role === 'cavalry' && type !== 'elephant')
    .at(-1)![0];
  for (let i = 0; i < 2; i++)
    models.push({ kind: 'unit', type: cavalry, x: 6.2 + i * 1.1, y: 5.2, dir: 1 });
  const signature =
    roster.find(([type]) => type === 'elephant') ??
    roster.filter(([, d]) => d.role === 'siege').at(-1);
  if (signature) models.push({ kind: 'unit', type: signature[0], x: 4.8, y: 5.5, dir: 1 });
  if (civ === 'daiviet' && age >= 3)
    models.push({ kind: 'unit', type: 'daivietcannon', x: 1.6, y: 6.1, dir: 1 });
  if (roster.some(([type]) => type === 'trader'))
    models.push({ kind: 'unit', type: 'trader', x: 1.8, y: 7.3, dir: 1 });
  models.push(
    { kind: 'resource', type: 'gold', x: -5.5, y: 5.5 },
    { kind: 'unit', type: 'villager', x: -5.3, y: 6.3, dir: 1 },
    { kind: 'unit', type: 'villager', x: -2.7, y: 6.8, dir: 1 },
    { kind: 'unit', type: 'villager', x: -3.3, y: 2.8, dir: 1 },
  );
  for (const [x, y] of [
    [-5, -3],
    [-4, -3],
    [-6, -1],
    [-7, 0],
    [5, -6],
    [7, -3],
    [-6.7, 6.7],
  ])
    models.push({
      kind: 'resource',
      type: ['tang', 'daiviet'].includes(civ) ? 'bamboo' : 'cypress',
      x,
      y,
    });
  for (const model of models) {
    model.scale = scales[model.type];
    const edge = 7.65 - previewGroundRadius(model, age, civ);
    model.x = Math.max(-edge, Math.min(edge, model.x));
    model.y = Math.max(-edge, Math.min(edge, model.y));
  }
  return models.sort((a, b) => a.x + a.y - (b.x + b.y));
}
