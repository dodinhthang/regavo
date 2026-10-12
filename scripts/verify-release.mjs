import { execFileSync } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function verifyRelease(tag, cwd = process.cwd()) {
  if (!/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(tag ?? ''))
    throw new Error('Release tag must be a stable vMAJOR.MINOR.PATCH tag.');
  const git = (...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  let sha;
  try {
    sha = git('rev-parse', '--verify', `refs/tags/${tag}^{commit}`);
  } catch {
    throw new Error(`Release tag ${tag} does not exist.`);
  }
  try {
    git('merge-base', '--is-ancestor', sha, 'refs/remotes/origin/main');
  } catch {
    throw new Error(`Release tag ${tag} must point to a commit in origin/main history.`);
  }
  const manifest = JSON.parse(git('show', `${sha}:package.json`));
  if (manifest.version !== tag.slice(1))
    throw new Error(`Tag ${tag} does not match package version ${manifest.version}.`);
  return { tag, sha };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const release = verifyRelease(process.env.RELEASE_TAG);
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, `tag=${release.tag}\nsha=${release.sha}\n`);
  console.log(`Verified ${release.tag} at ${release.sha}.`);
}
