import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { verifyRelease } from '../scripts/verify-release.mjs';

test('release policy accepts stable tags on main and rejects invalid, mismatched or off-main tags', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'regavo-release-'));
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
  try {
    git('init', '-b', 'main');
    git('config', 'user.name', 'Release test');
    git('config', 'user.email', 'test@example.invalid');
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ version: '0.1.0' }));
    git('add', '.');
    git('commit', '-m', 'Initial release');
    const first = git('rev-parse', 'HEAD');
    git('update-ref', 'refs/remotes/origin/main', first);
    git('tag', '-a', 'v0.1.0', '-m', 'v0.1.0');
    assert.deepEqual(verifyRelease('v0.1.0', cwd), { tag: 'v0.1.0', sha: first });
    for (const invalid of ['', 'main', 'v1.0', 'v01.0.0', 'v0.1.0-rc.1', 'v0.1.0;echo bad'])
      assert.throws(() => verifyRelease(invalid, cwd), /stable/);
    assert.throws(() => verifyRelease('v0.2.0', cwd), /does not exist/);
    git('tag', 'v1.0.0');
    assert.throws(() => verifyRelease('v1.0.0', cwd), /does not match/);
    git('switch', '-c', 'feature');
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ version: '0.2.0' }));
    git('add', '.');
    git('commit', '-m', 'Unmerged feature');
    git('tag', 'v0.2.0');
    assert.throws(() => verifyRelease('v0.2.0', cwd), /origin\/main history/);
    git('switch', 'main');
    git('merge', '--ff-only', 'feature');
    git('update-ref', 'refs/remotes/origin/main', git('rev-parse', 'HEAD'));
    assert.equal(verifyRelease('v0.2.0', cwd).tag, 'v0.2.0');
    assert.equal(verifyRelease('v0.1.0', cwd).sha, first, 'old tags remain redeployable');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
