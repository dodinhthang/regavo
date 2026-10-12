# Current verification

**English** | [Tiếng Việt](../vi/VALIDATION.md) | [简体中文](../zh-CN/VALIDATION.md)

Review date: **12 October 2026**. Project version: `0.1.0`. These results describe the current working tree, including uncommitted changes; they are not evidence of a tagged release. Environment: macOS, Node.js `22.23.3`, pnpm `12.8.1`.

## Automated checks

`pnpm validate` runs the following checks in order:

| Check               | Result                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| ESLint              | Passed, zero warnings                                                                                   |
| Prettier            | Passed                                                                                                  |
| TypeScript          | Passed with strict checking of source and tests                                                         |
| Dependency licenses | Passed: 176 reachable installed package instances, 16 in the conservative runtime closure               |
| Regression tests    | 141/141 passed                                                                                          |
| Production build    | Passed; main JavaScript chunk 864.51 kB, gzip 284.32 kB                                                 |
| Runtime image check | Passed: 112 WebP images have identical decoded RGBA/dimensions; 3 geometry manifests retain exact bytes |

Vite still reports a chunk-size warning above 500 kB. The build succeeds, but this result does not certify download time, memory use or frame rate.

The license counts on this machine are MIT 133, Apache-2.0 20, ISC 11, BSD-2-Clause 6, BSD-3-Clause 4, BlueOak-1.0.0 1 and CC-BY-4.0 1. Counts describe package metadata; exact bundled notices and attribution are retained in [THIRD-PARTY-NOTICES.md](../../THIRD-PARTY-NOTICES.md) and the distributed `public/third-party-licenses.txt`. Missing optional packages for other platforms are recorded separately, not counted as installed.

Regression checks are grouped by capability: [civilization catalogs and saves](../../tests/civilizations.test.ts), [mobilization](../../tests/mobilization.test.ts) and [art assets](../../tests/art-assets.test.ts). Startup and save/resume tests automatically cover every registered civilization as player and AI on all three terrain layouts. Recruitment checks compare the catalog with actual training commands for every civilization and age.

## Clean installation and documentation

A fresh `pnpm install --frozen-lockfile` followed by `pnpm check:licenses` on the same OS/CPU matches the generated notice files. The audit now follows the graph reachable from `package.json`, excluding stale, unreferenced pnpm store entries. This corrects an earlier inventory discrepancy caused by an unused Vite instance.

The documentation has 9 maintained page families (27 pages), each with English, Vietnamese and Simplified Chinese versions. Topic pages use matching filenames under `docs/en/`, `docs/vi/` and `docs/zh-CN/`; the English project README stays at the repository root. Local file links, matching language switches, roster/age tables and shared numeric evidence have been checked. Raw prompts, manifest identifiers and exact third-party license texts retain their source language.

Public asset records use repository-relative paths or explicit `generation-record:` identifiers. Personal machine paths are retained only in private local records. User-reference photographs and unused concept boards have been deleted and are not distributed. The UI background is in `src/assets/`; measurement/calibration inputs are in `scripts/data/`. Retained PNG bytes and hashes are unchanged by this cleanup.

## Reproduce the checks

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm audit:licenses
pnpm exec playwright install chromium
pnpm validate
pnpm dev
```

License generation is necessary when dependencies or the installation OS/CPU differ from the recorded snapshot. Commit the updated generated notices when maintaining that snapshot. Automated validation does not launch the game for browser interaction; visual and gameplay review is a separate step.

The shared civilization-art registry has been checked against all six playable civilizations. A headless Chrome comparison found **446 pixel-identical unit, cargo, portrait and building samples** for Đại Việt before and after the refactor, including unchanged anchors. All six civilization unit sets loaded, a new civilization rendered from configuration alone, and rapid selection changes evicted stale unit images. This checks the rendering refactor, not the complete gameplay or performance acceptance matrix.

The deployment footprint decreased from **274.7 to 153.2 MiB** by omitting 24 historical PNGs and producing lossless runtime WebP copies. A local headless Chrome lobby sample requested approximately **124.0 MiB before and 26.5 MiB after** (response Content-Length totals; dynamically compressed text is not included). All 18 civilization/age previews and a Dai Viet/Rome match were checked without missing image responses or JavaScript errors. These measurements are local transfer/build observations, not an Internet speed or gameplay performance certification.

## Release-pipeline verification

The CI and release YAML passed actionlint. `pnpm validate` passed **141 tests**, all source checks, the production build and exact RGBA checks for 112 images. All **3 Playwright Chromium smoke tests** passed, covering 18 previews, a running/exit-able match and the workshop. Wrangler **4.149.0** accepted the static-assets configuration with `deploy --dry-run`; its local server passed artifact/MIME/cache checks and returned 404 for a missing image.

The [clean Ubuntu 24.04 GitHub Actions run](https://github.com/dodinhthang/regavo/actions/runs/38252821704) passed the complete pipeline: locked installation, platform-generated license checks, **141 tests**, production build, **112 exact RGBA image checks**, **3 Chromium smoke tests**, and Wrangler dry-run. Bundling uses the official Rollup WASM build. Production credentials are stored in the GitHub `production` environment, and the deployment token has Editor access only to Worker `regavo`. Each release records its deployment verification result in the workflow summary.

## Evidence limits

Earlier browser reviews, screenshots, atlas measurements and performance probes are retained in local QA records, outside the public repository. They apply only to their recorded versions. Local `test-results/` fixtures and logs are ignored by Git; this documentation pass did not repeat the full browser review.

The following targets remain unverified: the full 6×5×3 faction/opponent/map matrix, sustained browser performance at 400 total units, all seeds and congested layouts, competitive balance and final deployment behavior. Art coverage and simulation tests do not establish exclusive copyright or trademark clearance. Remaining acceptance work is listed in [2D plan](PLAN-2D.md).

The v1.0.1 lobby fix requires authored sprites for every preview unit, including villagers and Roman legionaries. Builds export 18 complete scenes in two responsive lossless WebP sizes (36 files, 29.2 MiB total), with source/toolchain fingerprints and cache integrity checks. Lobby browsing no longer downloads sprite atlases. A cold local Chromium lobby sample transferred **4.37 MiB**, compared with the earlier **26.5 MiB** sample; a scene is approximately **0.4–1.35 MiB**. Total deployment size is approximately **183 MiB** because scenes are added while full match art remains available. Four smoke tests cover all scenes, interrupted slow selections, match startup/exit and the workshop. These are local transfer measurements, not Internet load-time guarantees.

The combined patch also tests country-based language initialization (VN, CN, fallback), saved language preference across reload and uncached visitor-specific HTML. The complete Chromium suite contains eight smoke tests.
