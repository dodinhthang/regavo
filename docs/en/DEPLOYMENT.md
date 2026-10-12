# Deployment and releases

**English** | [Tiếng Việt](../vi/DEPLOYMENT.md) | [简体中文](../zh-CN/DEPLOYMENT.md)

Regavo deploys to Cloudflare Workers Static Assets as Worker `regavo`, serving the optimized `dist/` at the domain root. The first URL uses the account's `workers.dev` subdomain. Simulation remains in the browser; no application server, database or API key is needed by players.

## When pipelines run

| Event                                     | Checks                                                                                                   | Production             |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------- |
| Open/update a PR into `main`              | Lint, formatting, types, licenses, tests, build, exact image checks, Chromium smoke and Wrangler dry-run | No                     |
| Push/merge into `main`                    | The same checks                                                                                          | No                     |
| Push a stable tag such as `v1.0.0`        | Verify the tag, then all checks                                                                          | Deploy after success   |
| Run Release manually with an existing tag | Verify and rebuild that tag, then all checks                                                             | Redeploy after success |

PR workflows have read-only repository permissions and receive no Cloudflare credentials. `ci.yml` never deploys. `release.yml` serializes production releases and passes the verified artifact between jobs without rebuilding it in the deploy job. Deployment artifacts and failure diagnostics expire after one day.

## Local review and GitHub setup

This setup can be reviewed and tested entirely locally. Do not create a release tag until the project and workflows are on `main` and CI is green. The target remote is `git@github.com:dodinhthang/regavo.git`; the local setup branch preserves the existing remote license commit and local history. Publishing the branch and creating a PR are separate actions.

When ready to enable GitHub deployment:

1. Publish and merge the setup branch into `main` using a PR; do not force-push or commit `node_modules/`, `dist/`, `.openai/`, `.wrangler/`, test output or environment files.
2. Under repository **Settings → Environments**, create `production`. Store `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` as environment secrets.
3. Create Worker `regavo` before creating the deployment token. Create an account API token named `regavo-github-production` with **Specified Workers → regavo → Editor**. This grants deployment access only to that Worker. Enter the token directly in GitHub Secrets, never in source, workflow YAML or chat. See [Workers roles and scopes](https://developers.cloudflare.com/workers/authorization/workers/).
4. After the first successful CI run, require the **Validate** status check for PRs into `main`. Do not enable a second automatic deploy through Cloudflare Builds.

The workflows use Ubuntu 24.04, Node `22.23.3`, pnpm `12.8.1` and Wrangler `4.149.0`. Actions are pinned to verified commit SHAs. pnpm and lossless-image caches are scoped to the runner platform and toolchain. A missing/corrupt image cache is rebuilt.

License snapshots include platform-specific dependencies. CI runs `pnpm audit:licenses` before `pnpm validate` so Linux notices match the packages actually installed and are included in the release artifact; it does not commit the regenerated files back to GitHub.

## Testing before release

```sh
pnpm install --frozen-lockfile
pnpm audit:licenses
pnpm exec playwright install chromium
pnpm validate
pnpm test:smoke
pnpm dlx wrangler@4.149.0 deploy --dry-run --outdir test-results/wrangler
```

Chromium checks all six civilizations and three ages, starts and exits a Dai Viet match after the simulation Worker ticks, and opens the model workshop using its hash URL. Missing responses, image/Worker MIME failures and JavaScript errors fail the tests. Smoke output is isolated under `test-results/smoke/` and `playwright-report/`.

## Release and recovery

For a release, merge the tested changes and update `package.json` to the intended version. Tag that exact commit on `main`; for the first release:

```sh
git switch main
git pull --ff-only origin main
git tag -a v1.0.0 -m "Regavo 1.0.0"
git push origin v1.0.0
```

Only stable `vMAJOR.MINOR.PATCH` tags are accepted, without leading zeroes or prerelease suffixes. The tag must exist, its commit must be an ancestor of `origin/main`, and the tagged `package.json` version must match. Invalid tags fail before deployment. Next patches use `v1.0.1`, `v1.0.2`, etc.; do not move an existing release tag.

After deployment, the workflow compares served HTML, the asset manifest, representative images, geometry, bootstrap bundles, icons and the simulation Worker against the verified artifact. Hashed assets must have a one-year immutable cache; missing images must return 404. It retries briefly for propagation, then marks the job failed if verification still fails. The job summary records tag, commit, URL and result. There is no automatic rollback.

To recover, open **Actions → Release → Run workflow** from `main` and enter a previously deployed stable tag in `tag`. The pipeline rebuilds and validates that version before redeploying it. Deleted/expired GitHub artifacts do not prevent recovery. The selected tag must contain this pipeline. No new tag is required for recovery.

The initial production URL is `https://regavo.dothang-hit.workers.dev`. Custom domains and PR preview URLs are not configured. Original project content, including code, artwork, logos and audio, uses [MIT](../../LICENSE); dependencies retain their own licenses.
