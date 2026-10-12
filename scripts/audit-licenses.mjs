/**
 * Reproducible installed-dependency inventory and exact license/notice capture.
 * Run: node scripts/audit-licenses.mjs [--check]
 * No network requests; supports npm's layout and pnpm's symlinked store layout.
 * This checks dependency evidence, not ownership of game code, art or trademarks.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const relative = (file) => path.relative(root, file).split(path.sep).join('/');
const hash = (data) => crypto.createHash('sha256').update(data).digest('hex');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const exists = (file) => fs.existsSync(file);
const sort = (values) => [...values].sort((a, b) => a.localeCompare(b, 'en'));
const packages = new Map();
const scannedModules = new Set();
const missingRequired = new Set();
const missingOptional = new Set();
const repositoryLicenses = JSON.parse(
  fs.readFileSync(path.join(root, 'licenses/upstream/dependency-fallbacks.json'), 'utf8'),
);

// npm registry metadata for @pixi/colord@2.9.6 records this gitHead. The fork's
// package.json at this commit confirms name/version. Its tarball omits LICENSE.
// Preserve the exact upstream file bytes locally so later audits work offline.
const colordFallback = {
  version: '2.9.6',
  registrySource: 'https://registry.npmjs.org/@pixi%2Fcolord/2.9.6',
  source:
    'https://raw.githubusercontent.com/pixijs/colord/5344fbf77b736f81cd33c21050021bc09bc9dd1d/LICENSE.md',
  versionEvidence:
    'https://raw.githubusercontent.com/pixijs/colord/5344fbf77b736f81cd33c21050021bc09bc9dd1d/package.json',
  text: `MIT License

Copyright (c) 2020 Vlad Shilov omgovich@ya.ru

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`,
};

function readPackage(directory) {
  const real = fs.realpathSync(directory);
  if (packages.has(real)) return packages.get(real);
  const file = path.join(real, 'package.json');
  if (!exists(file)) return null;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!data.name || !data.version) return null;
  const entry = { real, data, scopes: new Set(), files: [], issues: [] };
  packages.set(real, entry);
  scanModules(path.join(real, 'node_modules'));
  return entry;
}

function scanModules(directory) {
  if (!exists(directory)) return;
  const real = fs.realpathSync(directory);
  if (scannedModules.has(real)) return;
  scannedModules.add(real);
  for (const name of sort(fs.readdirSync(real))) {
    const candidate = path.join(real, name);
    if (name === '.pnpm') {
      for (const storeEntry of sort(fs.readdirSync(candidate))) {
        const entryPath = path.join(candidate, storeEntry);
        if (!fs.statSync(entryPath).isDirectory()) continue;
        scanModules(
          storeEntry === 'node_modules' ? entryPath : path.join(entryPath, 'node_modules'),
        );
      }
    } else if (name.startsWith('@') && fs.statSync(candidate).isDirectory()) {
      for (const scopedName of sort(fs.readdirSync(candidate)))
        readPackage(path.join(candidate, scopedName));
    } else if (!name.startsWith('.') && fs.statSync(candidate).isDirectory()) {
      readPackage(candidate);
    }
  }
}

function resolvePackage(fromDirectory, name) {
  if (!/^(@[a-zA-Z0-9._-]+\/)?[a-zA-Z0-9._-]+$/.test(name))
    throw new Error(`Invalid dependency name: ${name}`);
  let current = fromDirectory;
  while (true) {
    const candidate = path.join(current, 'node_modules', name, 'package.json');
    if (exists(candidate)) return readPackage(path.dirname(candidate));
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function visit(entry, scope) {
  if (!entry || entry.scopes.has(scope)) return;
  entry.scopes.add(scope);
  const dependencyNames = new Set([
    ...Object.keys(entry.data.dependencies ?? {}),
    ...Object.keys(entry.data.optionalDependencies ?? {}),
    ...Object.keys(entry.data.peerDependencies ?? {}),
  ]);
  for (const name of sort(dependencyNames)) {
    const resolved = resolvePackage(entry.real, name);
    if (resolved) visit(resolved, scope);
    else {
      const optional =
        Object.hasOwn(entry.data.optionalDependencies ?? {}, name) ||
        entry.data.peerDependenciesMeta?.[name]?.optional;
      (optional ? missingOptional : missingRequired).add(
        `${entry.data.name}@${entry.data.version} -> ${name}`,
      );
    }
  }
}

if (!exists(path.join(root, 'node_modules')))
  throw new Error('Install the locked dependencies before auditing.');
scanModules(path.join(root, 'node_modules'));
for (const [scope, dependencies] of [
  ['runtime', manifest.dependencies],
  ['build', manifest.devDependencies],
]) {
  for (const name of sort(Object.keys(dependencies ?? {}))) {
    const entry = resolvePackage(root, name);
    if (!entry) missingRequired.add(`${manifest.name} -> ${name}`);
    else visit(entry, scope);
  }
}

const licenseName =
  /^(?:licen[cs]e|copying|copyright|notice)(?:$|[._-])|^third[-_ ]?party.*(?:licen[cs]e|notic)/i;
function noticeFiles(directory, depth = 0) {
  const files = [];
  for (const name of sort(fs.readdirSync(directory))) {
    const file = path.join(directory, name);
    const stats = fs.lstatSync(file);
    if (stats.isFile() && licenseName.test(name)) files.push(file);
    else if (
      stats.isDirectory() &&
      depth < 3 &&
      /^(licen[cs]es?|notices?|third[-_ ]?party)$/i.test(name)
    ) {
      files.push(...noticeFiles(file, depth + 1));
    }
  }
  return files;
}

function capturedFile(file, sourceType = 'installed-file') {
  const data = fs.readFileSync(file);
  return { source: relative(file), sourceType, sha256: hash(data), text: data.toString('utf8') };
}

// These releases ship their complete license inside source/README rather than
// a separate LICENSE file. Capture the exact section and its source-file hash.
function embeddedLicense(entry) {
  const key = `${entry.data.name}@${entry.data.version}`;
  const sources = {
    'esrecurse@4.3.0': { file: 'esrecurse.js', start: '/*', end: '*/' },
    'imurmurhash@0.1.4': { file: 'README.md', start: 'License (MIT)' },
    'natural-compare@1.4.0': { file: 'README.md', start: 'Copyright (c) 2012-2015' },
  };
  const source = sources[key];
  if (!source) return null;
  const file = path.join(entry.real, source.file);
  const data = fs.readFileSync(file);
  const text = data.toString('utf8');
  const start = text.indexOf(source.start);
  const end = source.end ? text.indexOf(source.end, start) : text.length;
  if (start < 0 || end < 0) return null;
  const section = text.slice(start, source.end ? end + source.end.length : end);
  return {
    source: relative(file),
    sourceType: 'installed-embedded-license-or-attribution',
    sourceFileSha256: hash(data),
    sha256: hash(section),
    text: section,
  };
}

const allowedLicenses = new Set([
  'MIT',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  '0BSD',
  'CC0-1.0',
  'BlueOak-1.0.0',
]);
function checkLicense(label, entry, context) {
  // Browser compatibility data used by lint/compiler tooling; no game art or
  // runtime data is licensed under this exception. Attribution is distributed.
  if (label === 'CC-BY-4.0' && entry.data.name === 'caniuse-lite' && !entry.scopes.has('runtime'))
    return;
  if (/\b(?:AGPL|GPL|LGPL|MPL|EPL|CDDL)(?:-|\b)/i.test(label))
    entry.issues.push(`${context}: copyleft license requires review (${label}).`);
  else if (/non.?commercial|CC-BY-NC|BUSL|SSPL|proprietary|UNLICENSED/i.test(label))
    entry.issues.push(
      `${context}: restricted or source-available license requires review (${label}).`,
    );
  else if (!allowedLicenses.has(label))
    entry.issues.push(`${context}: license expression not in reviewed allowlist (${label}).`);
}

// Audit the reachable dependency graph. Stale pnpm store entries must not make
// a clean installation disagree with a developer's long-lived node_modules.
const ordered = [...packages.values()]
  .filter((entry) => entry.scopes.size > 0)
  .sort((a, b) =>
    `${a.data.name}@${a.data.version}:${relative(a.real)}`.localeCompare(
      `${b.data.name}@${b.data.version}:${relative(b.real)}`,
      'en',
    ),
  );
for (const entry of ordered) {
  entry.files = noticeFiles(entry.real).map((file) => capturedFile(file));
  if (!entry.files.length) {
    const embedded = embeddedLicense(entry);
    if (embedded) entry.files.push(embedded);
    const fallback = repositoryLicenses[`${entry.data.name}@${entry.data.version}`];
    if (fallback && fallback.license === entry.data.license) {
      entry.files.push({
        source: fallback.source,
        sourceType: 'version-pinned-upstream-fallback',
        sha256: hash(fallback.text),
        text: fallback.text,
      });
      entry.fallbackEvidence = {
        registrySource: fallback.registrySource,
        versionEvidence: fallback.versionEvidence,
        applicability: fallback.applicability,
      };
    }
  }
  const label =
    typeof entry.data.license === 'string' ? entry.data.license : entry.data.license?.type;
  entry.license = label ?? 'UNKNOWN';
  checkLicense(entry.license, entry, 'package metadata');
  if (
    !entry.files.length &&
    entry.data.name === '@pixi/colord' &&
    entry.data.version === colordFallback.version
  ) {
    entry.files.push({
      source: colordFallback.source,
      sourceType: 'version-pinned-upstream-fallback',
      sha256: hash(colordFallback.text),
      text: colordFallback.text,
    });
    entry.fallbackEvidence = {
      registrySource: colordFallback.registrySource,
      versionEvidence: colordFallback.versionEvidence,
    };
  }
}

// Platform binaries omit their own license file. Preserve their matching parent
// package's full license/notice files, explicitly recording the source.
for (const entry of ordered) {
  if (!entry.files.length && /^@(?:esbuild|rollup)\//.test(entry.data.name)) {
    const parentName = entry.data.name.startsWith('@esbuild/') ? 'esbuild' : 'rollup';
    const parent = ordered.find(
      (item) => item.data.name === parentName && item.data.version === entry.data.version,
    );
    if (parent)
      entry.files = parent.files.map((file) => ({
        ...file,
        sourceType: 'matching-version-parent-package',
      }));
  }
  if (!entry.files.length)
    entry.issues.push(
      'No license/notice text captured; obtain version-specific upstream evidence.',
    );
  entry.bundledLicenseLabels = sort(
    new Set(
      entry.files.flatMap((file) =>
        [...file.text.matchAll(/^License:\s*(.+?)\s*$/gm)].map((match) => match[1]),
      ),
    ),
  );
  for (const label of entry.bundledLicenseLabels)
    checkLicense(label, entry, 'bundled license declaration');
}

const counts = {};
for (const entry of ordered) counts[entry.license] = (counts[entry.license] ?? 0) + 1;
const issues = ordered.flatMap((entry) =>
  entry.issues.map((issue) => `${entry.data.name}@${entry.data.version}: ${issue}`),
);
const lockfiles = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']
  .filter((name) => exists(path.join(root, name)))
  .map((name) => ({ file: name, sha256: hash(fs.readFileSync(path.join(root, name))) }));
const audit = {
  schemaVersion: 1,
  scope:
    'Installed dependency graph reachable from package.json, including runtime/build closure, peers and optional packages present. Unreferenced installed packages are excluded. Not an asset, trademark, exclusivity or legal-risk certification.',
  reproducibleCommand: 'node scripts/audit-licenses.mjs',
  project: `${manifest.name}@${manifest.version}`,
  packageManifestSha256: hash(fs.readFileSync(path.join(root, 'package.json'))),
  lockfiles,
  licenseCounts: Object.fromEntries(Object.entries(counts).sort()),
  packageCount: ordered.length,
  runtimeClosureCount: ordered.filter((entry) => entry.scopes.has('runtime')).length,
  interpretation:
    'Runtime means conservative dependency-graph reachability, not proof of inclusion in the final JavaScript bundle. Build-only notices are included conservatively. Platform-specific optional dependencies absent from this machine are not audited or claimed to be installed.',
  issues,
  missingRequired: sort(missingRequired),
  missingOptional: sort(missingOptional),
  packages: ordered.map((entry) => ({
    name: entry.data.name,
    version: entry.data.version,
    installedPath: relative(entry.real),
    scopes: sort(entry.scopes),
    license: entry.license,
    repository: entry.data.repository ?? null,
    packageJsonSha256: hash(fs.readFileSync(path.join(entry.real, 'package.json'))),
    bundledLicenseLabels: entry.bundledLicenseLabels,
    fallbackEvidence: entry.fallbackEvidence ?? null,
    issues: entry.issues,
    licenseFiles: entry.files,
  })),
};

const warningText = [
  ...issues,
  ...sort(missingRequired).map((item) => `Missing required dependency: ${item}`),
];
const fallbackRows = ordered.filter((entry) =>
  entry.files.some((file) => file.sourceType !== 'installed-file'),
);
const lines = [
  '# Regavo — third-party dependency notices',
  '',
  'Generated by `node scripts/audit-licenses.mjs` from the installed dependency graph reachable from package.json and the current lockfile. Unreferenced store entries are excluded. Regenerate after dependency changes or on a different installation platform. These records do not apply a public license to the original game code or artwork.',
  '',
  `Installed package instances: **${ordered.length}**. Conservative runtime dependency closure: **${audit.runtimeClosureCount}**.`,
  '',
  '| Package metadata license | Installed package count |',
  '|---|---:|',
  ...Object.entries(counts)
    .sort()
    .map(([label, count]) => `| ${label} | ${count} |`),
  '',
  'Counts above describe package metadata, not every bundled component. Vite and Rollup contain additional bundled license text. TypeScript’s `ThirdPartyNoticeText.txt` includes notices for DefinitelyTyped, Unicode data, WHATWG DOM (CC BY 4.0), W3C specifications, and Khronos WebGL; that file is preserved in full. These are build-tool records, not additional art or runtime libraries imported by the game.',
  '',
  warningText.length
    ? 'Review required:\n\n' + warningText.map((line) => `- ${line}`).join('\n')
    : 'No missing required dependency, missing notice text, unrecognized package-license expression, or copyleft/noncommercial package-license declaration was detected in this installed tree. This is an evidence inventory and a bounded automated check, not a guarantee of exclusive ownership or absence of third-party claims.',
  '',
  'License text captured from embedded sections or pinned upstream sources:',
  '',
  ...fallbackRows.map(
    (entry) =>
      `- \`${entry.data.name}@${entry.data.version}\`: ${entry.files[0].sourceType}; source: ${entry.files[0].source.startsWith('https://') ? `[upstream license](${entry.files[0].source})` : `\`${entry.files[0].source}\``}.${entry.fallbackEvidence ? ` Version evidence: [package.json](${entry.fallbackEvidence.versionEvidence}), [npm metadata](${entry.fallbackEvidence.registrySource}).` : ''}`,
  ),
  '',
  'The public `/third-party-licenses.txt` file contains the exact captured texts for every installed package, including build tools conservatively. SHA-256 digests and full captured text are also recorded in `licenses/dependency-audit.json`. Optional platform packages not installed on this machine are listed separately in that JSON and are not included in these package counts.',
  '',
  '| Installed package | Scope | Declared license | Notice source |',
  '|---|---|---|---|',
  ...ordered.map(
    (entry) =>
      `| ${entry.data.name}@${entry.data.version} | ${sort(entry.scopes).join(', ')} | ${entry.license} | ${entry.files.map((file) => file.source).join(', ')} |`,
  ),
  '',
];
const publicHeader =
  'Regavo — third-party dependency licenses and notices\n\nThis file preserves original third-party notices. The package graph includes build tools conservatively; listing them here does not mean their code is bundled into the browser game. These licenses apply to their respective third-party components. Original game code and artwork are not licensed by this file.\n';
let publicText = publicHeader;
for (const entry of ordered) {
  publicText += `\n${'='.repeat(78)}\n${entry.data.name}@${entry.data.version}\nDeclared license: ${entry.license}\nDependency scope: ${sort(entry.scopes).join(', ')}\n`;
  for (const file of entry.files) {
    publicText += `\nSource (${file.sourceType}): ${file.source}\nSHA-256: ${file.sha256}\n--- BEGIN ORIGINAL TEXT ---\n${file.text}`;
    if (!file.text.endsWith('\n')) publicText += '\n';
    publicText += '--- END ORIGINAL TEXT ---\n';
  }
}

const outputs = [
  ['licenses/dependency-audit.json', JSON.stringify(audit, null, 2) + '\n'],
  ['THIRD-PARTY-NOTICES.md', lines.join('\n')],
  ['public/third-party-licenses.txt', publicText],
];
let stale = false;
for (const [name, content] of outputs) {
  const file = path.join(root, name);
  if (process.argv.includes('--check')) {
    if (!exists(file) || fs.readFileSync(file, 'utf8') !== content) {
      console.error(`Stale or missing generated notice: ${name}`);
      stale = true;
    }
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, 'utf8');
  }
}
console.log(
  JSON.stringify(
    {
      installedPackages: ordered.length,
      runtimeClosure: audit.runtimeClosureCount,
      licenseCounts: audit.licenseCounts,
      issues: warningText,
      outputs: outputs.map(([name]) => name),
    },
    null,
    2,
  ),
);
if (warningText.length || stale) process.exitCode = 1;
