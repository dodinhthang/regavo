# Rights, asset sources and licenses

**English** | [Tiếng Việt](../vi/RIGHTS-AND-LICENSES.md) | [简体中文](../zh-CN/RIGHTS-AND-LICENSES.md)

Updated **11 October 2026**. This is a bounded source and license record for the current prototype, not an exclusivity certificate. Exact third-party notices are preserved separately. The repository does not grant a public reuse license for original game code, art or audio.

## Original content

Original TypeScript/Canvas/SVG/CSS code provides the simulation, renderer, UI, emblems and effects. Music and sound effects are synthesized using original Web Audio code. The UI uses system fonts; it distributes no third-party font files, stock icon pack or external audio recordings. No Age of Empires sprite, logo, screenshot, UI, audio or source code was imported. AoE is a gameplay/economy reference, not Regavo branding.

Public visibility of this repository does not grant the licenses of its dependencies to original content. Third-party copyright remains with the respective authors. “Regavo” is a working name; this record includes no completed trademark clearance or exclusive-name determination.

## Dependency evidence

Direct versions: **PixiJS 8.13.2**, **React/React DOM 19.2.0**, **Vite 7.3.7** and **TypeScript 5.9.3**. Development tools also include ESLint, typescript-eslint, React Hooks lint and Prettier. The exact installed graph is recorded by the audit, not fixed permanently in this prose.

| Component                     | License                                        | Distribution record                                             |
| ----------------------------- | ---------------------------------------------- | --------------------------------------------------------------- |
| PixiJS, React/React DOM, Vite | MIT                                            | Preserve applicable copyright and license text                  |
| TypeScript and some tooling   | Apache-2.0                                     | Preserve applicable license/notice and modification records     |
| Other reviewed dependencies   | ISC, BSD-2-Clause, BSD-3-Clause, BlueOak-1.0.0 | Preserve their corresponding notices/terms                      |
| caniuse-lite development data | CC-BY-4.0                                      | Preserve attribution and license; original data is not modified |

[Blue Oak 1.0.0](https://blueoakcouncil.org/license/1.0.0) and [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.en) apply to the respective tooling/data, not original game artwork. Browser APIs such as WebGL/DOM/Web Worker are not browser implementation code distributed by this repository.

Use [THIRD-PARTY-NOTICES.md](../../THIRD-PARTY-NOTICES.md), [dependency-audit.json](../../licenses/dependency-audit.json) and [the distributed exact license texts](../../public/third-party-licenses.txt) for package sources, hashes and notices, including bundled components. Upstream fallback evidence is in [dependency-fallbacks.json](../../licenses/upstream/dependency-fallbacks.json). These files are generated; do not edit original third-party text or translate it.

Run `pnpm audit:licenses` after dependency/platform changes, then `pnpm check:licenses`. The audit follows reachable runtime/build dependencies and excludes stale, unreferenced store entries. Platform-specific optional packages vary by OS/CPU; the checked snapshot is not a universal package count. An audit pass checks the recorded graph and notices, not art ownership or all legal risks.

## AI-generated artwork and references

Concepts and runtime atlases were generated/edited with integrated `image_gen`. Inputs include project-created images **and user-provided sculpture/architecture references** for Đại Việt. Museum/history URLs in the civilization document are research citations, not licenses to copy their pictures. This record does not establish exclusive ownership of the reference photographs or depicted objects.

OpenAI's [Terms of Use](https://openai.com/policies/terms-of-use/#content) and [Services Agreement](https://openai.com/policies/services-agreement/) describe output ownership subject to applicable law and the applicable account agreement. Outputs may be similar to others' outputs. This record has not verified the account's contract type and does not certify exclusive copyright or third-party clearance.

Runtime prompts, retained source PNGs, SHA-256 and frame/anchor data remain in [runtime manifests](RUNTIME-ART.md). Original reference images and unused concept/draft files have been removed. Retained PNG bytes are unchanged. Whole-pose calibration changes cached geometry/RGB, not source PNGs. Đại Việt uses the generated v4 dragon, v9/v10 architecture, v11 foundation geometry, v12 walking and v13 resource cargo. Historical SVG/rig sources are not the current rendering specification.

## Public and private files

- `public/art/` contains runtime PNGs, source metadata and documentation, all copied into the website build. Public provenance uses repository-relative paths or opaque generation identifiers, without personal filesystem paths.
- `src/assets/battlefield.png` is the background imported by UI CSS. Vite emits it as a hashed build asset; civilization previews compose runtime sprites.
- `scripts/data/` holds the three JSON inputs used by art measurement/calibration tools and tests. Their image sources are retained runtime PNGs in `public/art/`.
- User-provided reference photographs and unused concept/draft images have been deleted. Public records retain a description of their design role without publishing the original input images.
- Original tool-path mappings and pre-normalization records are retained locally in ignored `.openai/*local*` files. These are private evidence, not portable repository dependencies.

Do not label AI art CC0, public domain, “copyright-free” or guaranteed exclusive. Adding a LICENSE file, background removal or redraw alone does not establish third-party clearance. Any future asset needs a source record and suitable rights; the current record remains subject to reference-source and account-contract limitations.
