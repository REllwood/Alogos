/**
 * Smoke test for the built package.
 *
 * Loads the package through its own name (package self-reference via the
 * "exports" map) using both require() and import, and checks that the two
 * entry points expose the same working API.
 *
 * Run with `npm run test:package` (which builds first).
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const cjs = require(pkg.name);
const esm = await import(pkg.name);

const cjsKeys = Object.keys(cjs).sort();
const esmKeys = Object.keys(esm).sort();

assert.ok(cjsKeys.length > 0, 'require() returned no exports');
assert.deepEqual(cjsKeys, esmKeys, 'require() and import expose different exports');

for (const [label, mod] of [
  ['require', cjs],
  ['import', esm],
]) {
  assert.equal(
    typeof mod.detectSyntheticImage,
    'function',
    `${label}: detectSyntheticImage missing`
  );
  assert.equal(
    typeof mod.SyntheticImageDetector,
    'function',
    `${label}: SyntheticImageDetector missing`
  );
  assert.equal(mod.VERSION, pkg.version, `${label}: VERSION does not match package.json`);

  const size = 64;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < data.length; i += 4) {
    const v = ((i / 4) * 37) % 256;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  const result = mod.detectSyntheticImage({ width: size, height: size, data });
  assert.equal(typeof result.isSynthetic, 'boolean', `${label}: analyse() returned no verdict`);
}

console.log(`Runtime check passed: ${cjsKeys.length} exports via require() and import`);

// Check the published type declarations resolve correctly for every module
// resolution mode, using the tarball npm would actually publish.
const packDir = mkdtempSync(join(tmpdir(), 'alogos-pack-'));
try {
  const packed = spawnSync(
    'npm',
    ['pack', '--ignore-scripts', '--json', '--pack-destination', packDir],
    {
      encoding: 'utf8',
      shell: process.platform === 'win32',
    }
  );
  assert.equal(packed.status, 0, `npm pack failed:\n${packed.stderr}`);
  const [{ filename }] = JSON.parse(packed.stdout);

  const attw = spawnSync('npx', ['--no-install', 'attw', join(packDir, filename)], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  assert.equal(attw.status, 0, 'Type declaration check (attw) failed');
} finally {
  rmSync(packDir, { recursive: true, force: true });
}
