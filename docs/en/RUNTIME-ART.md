# Runtime art

**English** | [Tiếng Việt](../vi/RUNTIME-ART.md) | [简体中文](../zh-CN/RUNTIME-ART.md)

Current rendering specification, updated **12 October 2026**. The PNG source bytes are preserved; crop, geometry, color calibration and effects are applied by the renderer. This page describes active selection. Older manifests remain provenance snapshots, not current loader specifications.

## Current source selection

| Content                      | Active source / evidence                                                                                                                                                                                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original five civilizations  | Town centers v6 (age I)/v7 (II–III), secondary buildings v3/v6, units/actions v6, civilization traders/siege v7                                                                                                                                                                  |
| Persian elephant             | Five v9 PNGs: [elephant manifest](../../public/art/units-elephant-v9.manifest.json)                                                                                                                                                                                              |
| Đại Việt age I–II buildings  | Original independent sheets, plus age II gate/flag-tower sources                                                                                                                                                                                                                 |
| Đại Việt age III buildings   | [v9 shared atlas](../../public/art/daiviet-v9.manifest.json), with town center/house from [v10](../../public/art/daiviet-v10.manifest.json)                                                                                                                                      |
| Đại Việt building projection | [v11 grid/foundation evidence](../../public/art/daiviet-grid-v11.manifest.json)                                                                                                                                                                                                  |
| Đại Việt walking             | [v12 whole-pose evidence](../../public/art/daiviet-walk-v12.manifest.json), with body/RGB calibration                                                                                                                                                                            |
| Đại Việt workers and cargo   | [Worker calibration](../../public/art/daiviet-worker-calibration.manifest.json), [v13 cargo](../../public/art/daiviet-cargo-v13.manifest.json)                                                                                                                                   |
| Đại Việt shared dragon       | [v4 emblem](../../public/art/daiviet-v4-emblem.manifest.json)                                                                                                                                                                                                                    |
| Nature, wildlife, terrain    | [Nature](../../public/art/nature-v2.manifest.json), [wildlife](../../public/art/wildlife-v3.manifest.json), [walk B](../../public/art/wildlife-walk-b.manifest.json), [terrain](../../public/art/terrain-v3.manifest.json), [scenery](../../public/art/scenery-v3.manifest.json) |

The Đại Việt loader currently loads **30 sprite sheets containing 431 registered frames, plus one emblem PNG**. This includes source frames superseded by more specific selections inside retained sheets. The complete metadata also contains historical building sheets, so registered-history totals and active-loader totals are different. See [loader](../../src/render/sheet-art.ts), [base metadata](../../src/render/daiviet-frames.json) and [cargo metadata](../../src/render/daiviet-cargo-frames.json).

## Geometry and animation

Ground tiles are **64×32** at reference zoom. Units/wildlife render on 4× canvases; buildings/scenery use 2×. Four authored diagonal headings cover the eight requested viewing directions by nearest-heading selection. Crops must contain the whole silhouette, tools and crew; frame boundaries are not a reason to clip feet, hats or roofs.

Town centers have visible foundations of **4/5/6 tiles** and an **8-tile** reserved area. The reserve is not used to enlarge the image. Đại Việt stone gates use 3×3 foundations and fortresses 5×5. Foundation projection aligns measured left/right/front corners; barrier modules align measured end sockets on either axis while keeping vertical columns upright. Placement, collision, preview and selection share the game's foundation rules.

Walking uses intact authored poses. Đại Việt infantry/villagers use **A/D/B/C**, mounted units **A/C/B/D**, and cannon alternate two whole crew contacts. Walking phase follows actual distance; stopping freezes phase, while the workshop uses the unit's nominal speed. The old 12/24-stage limb rig is retired. Combat uses separate windup/impact poses synchronized to simulation attack phases; vector arrows/projectiles/flashes are original effects.

Đại Việt walking calibration aligns silhouette height, upper-body width/pivot and RGB with the corresponding reference pose, preserving alpha. Worker tool poses use uniform X/Y anatomy scales and can be shorter when crouching. Cargo art selects actual carried inventory: wood, gold, stone and meat each have four complete walking poses in four directions; food keeps the original basket. Other civilizations use their existing wood/bag/material cues. Work tools remain visible while gathering.

## Home preview and loading

The home preview composes the same runtime models but has documented **preview-only scales** for Đại Việt: town center 95%, barracks/stable/range 82%, granary 88%, farm 94%, cannon 90%. Other models retain their preview scale. These factors do not change match/workshop model sizes or logical foundations. See [preview layout](../../src/ui/empire-preview-layout.ts).

Caches are bounded; loaders coalesce pending work and reject stale results when switching civilization. Normal selection prefers current sources; prototype sheets remain evidence or fallback material. [asset-origins.json](../../public/asset-origins.json) inventories retained source PNGs, including historical assets; being listed there does not mean a sheet is currently decoded.

Production builds derive lossless WebP copies only for sources referenced by renderers or the active civilization registry, including intentional fallback atlases. Original PNGs and historical manifests stay in the repository. Hashed image/geometry URLs support immutable caching; `dist/asset-manifest.json` connects deployed copies to source hashes. `pnpm check:assets` verifies identical decoded RGBA and dimensions for every image. The home preview loads the selected civilization/age and idle poses on demand, without warming all other civilizations; matches and the workshop retain full animation loading.

## Shared civilization registration

All six civilizations register their art in [civilization-art-data.ts](../../src/render/civilization-art-data.ts). The shared atlas layout preserves the original five civilization columns; independent sheets use [sheet-art.ts](../../src/render/sheet-art.ts). Loading, unit/portrait dispatch and building selection use this registry. Đại Việt's source and action choices are declared in [civilizations/daiviet.ts](../../src/render/civilizations/daiviet.ts), without a dedicated civilization renderer. Existing crops, calibration, pose order and source PNGs are preserved.

To add art for another civilization:

1. Place its runtime PNGs in `public/art/` and record their source, dimensions, frames, anchors and hashes. Independent unit sheets register four source headings per pose row.
2. Add `src/render/civilizations/<id>.ts` exporting a `SheetArtDefinition`: declare sheets, unit actions/cargo cycles, building choices for each age and any optional calibration. Use the Đại Việt definition as a structural example; measure the new artwork's own coordinates and proportions.
3. Register the definition in `CIVILIZATION_ART`. The common loader/renderer discovers it; no new civilization-specific dispatch branch or measurement script is required. The `shared` layout is suitable only when the existing atlas actually contains that civilization's column.
4. Add the civilization's game ID, roster/mechanics, translations, icons and menu/preview content in their corresponding modules. Art registration alone does not add a playable civilization.

Measurement scripts and `scripts/data/` are authoring inputs for the current Đại Việt assets. New artwork can supply measured metadata directly; calibration profiles are optional. These inputs are separate from the runtime definition and are not distributed in `dist/`.

## Tools, records and limits

Measurement tools: [walk measurement](../../scripts/measure-daiviet-walk-v12.py), [walking calibration](../../scripts/calibrate-daiviet-walk.py), [worker calibration](../../scripts/calibrate-daiviet-workers.py) and [cargo measurement](../../scripts/measure-daiviet-cargo-v13.py). They use Python with Pillow/NumPy as required by their imports; normal game installation does not require them. The three JSON inputs are in [scripts/data/](../../scripts/data/); their image sources are retained runtime PNGs in `public/art/`. The tools do not require removed concept boards or user-reference photographs.

There are no full death animations, damaged-building sets, complete tool-action cycles or distinct uniforms for every unit/age. Four headings and independently generated clothing details remain limits. No 400-unit FPS claim follows from frame/crop checks. Earlier version counts and rig experiments remain in local QA records; the current public verification is in [Validation](VALIDATION.md).

[Rights](RIGHTS-AND-LICENSES.md) covers project/user inputs and AI limitations; [validation](VALIDATION.md) records verified checks. Exact license texts remain in their original form.
