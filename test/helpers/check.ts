/**
 * The assertion harness the tests share.
 *
 * Deliberately tiny: no framework, no globals, no magic. A test file
 * imports `check`, calls it, and ends with `report()`, which decides the
 * exit code. `test/run.mjs` treats a non-zero exit as a failure.
 *
 * Every check names the value it expects. That is not decoration — tests
 * asserting that something "renders" or "is visible" passed repeatedly
 * while the thing under them was wrong, so a check here states the answer
 * it wants and prints both sides when it does not get it.
 */

let failures = 0

export function check(label: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  if (a === b) {
    console.log(`  ok   ${label}`)
    return
  }
  failures += 1
  console.log(`  FAIL ${label}\n         got      ${a}\n         expected ${b}`)
}

/** Exits non-zero if anything failed. Call once, at the end of a file. */
export function report(): void {
  if (failures > 0) {
    console.log(`  ${failures} FAILURE${failures === 1 ? '' : 'S'}`)
    process.exit(1)
  }
}
