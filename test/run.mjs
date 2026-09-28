/**
 * Runs every test/**\/*.test.ts.
 *
 * The tests import application source directly, so each one is bundled with
 * esbuild and then run on plain node. That is the whole runner: no test
 * framework, and nothing to learn beyond `npm test`.
 *
 * A file fails if it exits non-zero, which `check`/`report` in
 * test/helpers/check.ts take care of.
 */
import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')

function findTests(dir) {
  const found = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) found.push(...findTests(full))
    else if (name.endsWith('.test.ts')) found.push(full)
  }
  return found.sort()
}

const only = process.argv[2]
const tests = findTests(join(ROOT, 'test')).filter((f) => !only || f.includes(only))
if (tests.length === 0) {
  console.error(only ? `No test files match "${only}".` : 'No test files found.')
  process.exit(1)
}

const out = mkdtempSync(join(tmpdir(), 'slate-tests-'))
let failed = 0

for (const file of tests) {
  const name = relative(join(ROOT, 'test'), file).replace(/\.test\.ts$/, '')
  const bundle = join(out, `${name.replace(/[\\/]/g, '__')}.mjs`)
  console.log(`\n${name}`)
  try {
    await build({
      entryPoints: [file],
      bundle: true,
      format: 'esm',
      platform: 'node',
      outfile: bundle,
      logLevel: 'error',
      // The app reads Vite's env at module scope; node has no import.meta.env.
      define: { 'import.meta.env': JSON.stringify({ BASE_URL: '/CFB-Scoreboard/' }) },
    })
  } catch {
    console.log('  FAIL could not be bundled')
    failed += 1
    continue
  }
  const run = spawnSync(process.execPath, [bundle], { stdio: 'inherit' })
  if (run.status !== 0) failed += 1
}

rmSync(out, { recursive: true, force: true })
console.log(failed === 0 ? `\n${tests.length} file(s), all passed` : `\n${failed} of ${tests.length} file(s) failed`)
process.exit(failed === 0 ? 0 : 1)
