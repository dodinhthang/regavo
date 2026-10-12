# 2D design plan and roadmap

**English** | [Tiếng Việt](../vi/PLAN-2D.md) | [简体中文](../zh-CN/PLAN-2D.md)

Updated **11 October 2026**. This document describes design targets and acceptance criteria. [README](../../README.md), [civilizations](CIVILIZATIONS.md), [economy](ECONOMY.md) and [runtime art](RUNTIME-ART.md) describe what is implemented. A target listed here is not evidence that it has passed verification.

## Product direction

A desktop-browser, single-player RTS against AI, with six civilizations and three ages. Fixed-angle 2D isometric art should read clearly at normal play distance: civilization, unit role, building purpose and current action. The player can pan and zoom, without rotating the camera. Historical inspiration spans different periods; the game does not reconstruct a shared historical battle.

Core rules: four resources, hunting meat as food, a 200-unit cap per side, one irreplaceable town center, current-visibility fog, AI using player rules, and cargo credited only at delivery. Losing both town centers in one tick produces a draw. Age progression changes architecture and unlocks recruitment; it does not automatically upgrade existing units. Detailed current values belong in the rules documents rather than being duplicated here.

## Current baseline and production targets

| Area          | Current baseline                                                               | Remaining target                                                 |
| ------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Civilizations | Six playable rosters, including Đại Việt mobilization                          | More match-based balance and AI skill coverage                   |
| Architecture  | Age-specific art, visible town-center foundations 4/5/6 tiles, reserved area 8 | Full construction/damage/destruction visuals                     |
| Units         | Four diagonal source headings and whole-pose movement/attack art               | Eight authored headings, stable feet and fuller action cycles    |
| Cargo         | Inventory-driven appearance; Đại Việt has separate resource atlases            | Fuller movement consistency across all civilizations/items       |
| Movement      | A*, local avoidance, group destinations and escape commands                    | More robust narrow-passage tests and advanced formation behavior |
| Maps          | 96×96; three terrain presets; old 64×64 saves readable                         | Richer terrain, transitions and readable battlefield detail      |
| UI            | Menu/HUD/workshop in Vietnamese, English and Simplified Chinese                | Continued accessibility, viewport and interaction verification   |
| Performance   | Browser and simulation checks for bounded scenarios                            | Measured 400-unit target with real assets                        |

## Art requirements

Ground projection uses a 2:1 grid: **64×32 pixels** per tile at reference zoom. Before camera transforms, `sx = (x-y) × 32` and `sy = (x+y) × 16`. Logical foundations, image silhouettes and selection shapes are separate measurements; roofs must not define path blockers.

Preserve each civilization's architecture, material palette and equipment identity. Common building functions must remain readable across all six. Age changes keep building identity, current HP, queues and rally points. Wooden barriers remain wooden rather than turning into stone walls. Current runtime foundation rules take precedence over older concept dimensions.

Target unit states include idle, walk, work, attack preparation/release, hit and death; relevant siege units also need load/deploy/pack states. Stable anchors, symmetric scaling and simulation-driven attack timing matter more than raw frame count. Eight-direction animation is a future production target. PNG/WebP atlases need genuine alpha, padding, measured frames/anchors, source hashes and rights notes. Team-color masks and damaged-building assets remain production work.

Unused concept boards and user-provided reference images have been removed after serving as design inputs. The retained game art follows [runtime rules](RUNTIME-ART.md) and [rights](RIGHTS-AND-LICENSES.md). Historical research sources are collected in [civilizations](CIVILIZATIONS.md).

## Technical direction

PixiJS renders the WebGL scene; React owns menu/HUD rather than one component per actor. A Web Worker simulates at a fixed **20 Hz**, while the main thread receives snapshots and interpolates for display. Rendering 60 FPS does not mean the simulation runs at 60 Hz.

Cull offscreen sprites, bound texture/canvas caches, limit expensive pathfinding work, and keep hidden enemies out of rendering and hit-testing. Saves must retain resources, cargo, queues, orders, HP, age, seed, AI and animal/carcass state. Recompute visibility after loading. Performance claims require FPS/frame-time, Worker cost and memory measurements using actual assets.

## Roadmap

1. Maintain the playable core: economy, hunt/deliver, build/recruit, age progression, fog, victory and save/load.
2. Maintain parity across six civilization rosters, three ages, three maps and three UI languages.
3. Complete missing production art and expand movement/accessibility coverage.
4. Run budget-aware faction balance trials and the full configuration matrix.
5. Measure performance and verify the exact production build before release.

## Release acceptance

- Civilization, unit role and building function remain readable at normal zoom; identity does not depend only on team color.
- Art changes preserve defined foundations, recruitment queues, cargo drop-offs and HP; new source frames have verified crop/alpha/anchor/hash data.
- Selection, queued orders, attack-move, retreat, hold, groups, rally points and building placement work consistently in map/minimap contexts.
- Actors can navigate or report blocked destinations, without crossing static obstacles or piling indefinitely at a single point.
- Delivery/death/refund/population/visibility/save rules have regression coverage, including mobilization and shared carcasses.
- Test at least **90 configurations: 6 player civilizations × 5 different opponents × 3 maps**; add mirror matches and difficulty-specific checks. This target matrix is not yet a completed QA report.
- Benchmark **400 total units at 1080p Medium on M3 Pro**, targeting 60 FPS with actual assets; record frame time, Worker time and texture memory. Set broader hardware targets after measurement.

No online, campaign, navy or four-team simulation is part of the current prototype scope. Release evidence belongs in [validation](VALIDATION.md). Versioned asset manifests remain public; superseded QA notes are retained locally.
