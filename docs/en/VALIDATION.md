# Current verification

**English** | [Tiếng Việt](../vi/VALIDATION.md) | [简体中文](../zh-CN/VALIDATION.md)

Review date: **12 October 2026**. Project version: `0.1.0`. These results describe the current working tree, including uncommitted changes; they are not evidence of a tagged release. Environment: macOS, Node.js `22.23.3`, pnpm `12.8.1`.

## Automated checks

`pnpm validate` runs the following checks in order:

| Check               | Result                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------- |
| ESLint              | Passed, zero warnings                                                                     |
| Prettier            | Passed                                                                                    |
| TypeScript          | Passed with strict checking of source and tests                                           |
| Dependency licenses | Passed: 171 reachable installed package instances, 16 in the conservative runtime closure |
| Regression tests    | 133/133 passed                                                                            |
| Production build    | Passed; main JavaScript chunk 853.22 kB, gzip 281.18 kB                                   |

Vite still reports a chunk-size warning above 500 kB. The build succeeds, but this result does not certify download time, memory use or frame rate.

The license counts on this machine are MIT 134, Apache-2.0 14, ISC 11, BSD-2-Clause 6, BSD-3-Clause 4, BlueOak-1.0.0 1 and CC-BY-4.0 1. Counts describe package metadata; exact bundled notices and attribution are retained in [THIRD-PARTY-NOTICES.md](../../THIRD-PARTY-NOTICES.md) and the distributed `public/third-party-licenses.txt`. Missing optional packages for other platforms are recorded separately, not counted as installed.

Regression checks are grouped by capability: [civilization catalogs and saves](../../tests/civilizations.test.ts), [mobilization](../../tests/mobilization.test.ts) and [art assets](../../tests/art-assets.test.ts). Startup and save/resume tests automatically cover every registered civilization as player and AI on all three terrain layouts. Recruitment checks compare the catalog with actual training commands for every civilization and age.

## Clean installation and documentation

A fresh `pnpm install --frozen-lockfile` followed by `pnpm check:licenses` on the same OS/CPU matches the generated notice files. The audit now follows the graph reachable from `package.json`, excluding stale, unreferenced pnpm store entries. This corrects the former 172-versus-171 discrepancy caused by an unused Vite instance.

The documentation has 9 maintained page families (27 pages), each with English, Vietnamese and Simplified Chinese versions. Topic pages use matching filenames under `docs/en/`, `docs/vi/` and `docs/zh-CN/`; the English project README stays at the repository root. Local file links, matching language switches, roster/age tables and shared numeric evidence have been checked. Raw prompts, manifest identifiers and exact third-party license texts retain their source language.

Public asset records use repository-relative paths or explicit `generation-record:` identifiers. Personal machine paths are retained only in private local records. User-reference photographs and unused concept boards have been deleted and are not distributed. The UI background is in `src/assets/`; measurement/calibration inputs are in `scripts/data/`. Retained PNG bytes and hashes are unchanged by this cleanup.

## Reproduce the checks

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm audit:licenses
pnpm validate
pnpm dev
```

License generation is necessary when dependencies or the installation OS/CPU differ from the recorded snapshot. Commit the updated generated notices when maintaining that snapshot. Automated validation does not launch the game for browser interaction; visual and gameplay review is a separate step.

The shared civilization-art registry has been checked against all six playable civilizations. A headless Chrome comparison found **446 pixel-identical unit, cargo, portrait and building samples** for Đại Việt before and after the refactor, including unchanged anchors. All six civilization unit sets loaded, a new civilization rendered from configuration alone, and rapid selection changes evicted stale unit images. This checks the rendering refactor, not the complete gameplay or performance acceptance matrix.

## Evidence limits

Earlier browser reviews, screenshots, atlas measurements and performance probes are retained in local QA records, outside the public repository. They apply only to their recorded versions. Local `test-results/` fixtures and logs are ignored by Git; this documentation pass did not repeat the full browser review.

The following targets remain unverified: the full 6×5×3 faction/opponent/map matrix, sustained browser performance at 400 total units, all seeds and congested layouts, competitive balance and final deployment behavior. Art coverage and simulation tests do not establish exclusive copyright or trademark clearance. Remaining acceptance work is listed in [2D plan](PLAN-2D.md).
