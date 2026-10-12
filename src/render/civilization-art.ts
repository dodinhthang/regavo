import { CIVILIZATION_ART, ART_CIVILIZATIONS } from './civilization-art-data.ts';
import { createSheetArt } from './sheet-art.ts';

const renderers = new Map(
  Object.entries(CIVILIZATION_ART).flatMap(([civ, definition]) =>
    definition.kind === 'sheets' ? [[civ, createSheetArt(definition)] as const] : [],
  ),
);

export function civilizationRenderer(civ: string) {
  return renderers.get(civ);
}

export async function loadCivilizationBuildings(
  civs?: readonly string[],
  ages?: readonly number[],
) {
  return (
    await Promise.all(
      [...renderers]
        .filter(([civ]) => !civs || civs.includes(civ))
        .map(([, renderer]) => renderer.loadBuildings(ages)),
    )
  ).every(Boolean);
}

export async function loadCivilizationUnits(civs: ReadonlySet<string>, preview = false) {
  return (
    await Promise.all(
      [...renderers].map(([civ, renderer]) => renderer.loadUnits(civs.has(civ), preview)),
    )
  ).every(Boolean);
}

export function civilizationArtStatus() {
  return Object.fromEntries(
    ART_CIVILIZATIONS.map((civ) => [
      civ,
      {
        kind: CIVILIZATION_ART[civ as keyof typeof CIVILIZATION_ART].kind,
        ...renderers.get(civ)?.status(),
      },
    ]),
  );
}
