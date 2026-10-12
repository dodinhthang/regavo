import type { CivId } from '../game/data.ts';
import type { CivilizationArtDefinition } from './civilization-art-definition.ts';
import { DAI_VIET_ART } from './civilizations/daiviet.ts';

/** Every civilization registers its source layout here; renderers consume this registry. */
export const CIVILIZATION_ART: Record<CivId, CivilizationArtDefinition> = {
  roman: { kind: 'shared', column: 0 },
  mongol: { kind: 'shared', column: 1 },
  persian: { kind: 'shared', column: 2 },
  tang: { kind: 'shared', column: 3 },
  ottoman: { kind: 'shared', column: 4 },
  daiviet: DAI_VIET_ART,
};

export const ART_CIVILIZATIONS = Object.keys(CIVILIZATION_ART);

export function civilizationArtDefinition(civ: string): CivilizationArtDefinition | undefined {
  return CIVILIZATION_ART[civ as CivId];
}

export function sharedAtlasColumn(civ: string) {
  const definition = civilizationArtDefinition(civ);
  return definition?.kind === 'shared' ? definition.column : -1;
}

export function hasFixedIdleFrame(civ: string) {
  return civilizationArtDefinition(civ)?.idleFrame === 0;
}
