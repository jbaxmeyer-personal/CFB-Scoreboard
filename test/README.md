# Tests

    npm test              # everything
    npm test linescore    # just the files whose path contains "linescore"

`test/run.mjs` bundles each `*.test.ts` with esbuild and runs it on node.
There is no test framework: a file imports `check` from `helpers/check.ts`,
calls it, and ends with `report()`, which sets the exit code. CI runs this
on every push and pull request.

## Browser tests

`test/ui/*.mjs` drive the real app in Playwright. They are not in `npm test`
— they need a dev server and a browser — so run them by hand:

    npm run dev -- --port 5199        # in one shell
    node test/ui/slate.mjs            # in another

They cover what unit tests cannot: stacking order, scroll behaviour, which
element actually paints on top.

## What these are for

Every suite here defends a bug that actually reached a phone on a Saturday.
The header comment on each file says which one. They are not written for
coverage — they are written so that specific failure cannot come back.

Two habits worth keeping, both learned the hard way:

- **Assert a named value, not a property.** Checks like "the strip still
  renders" or "something is visible" passed repeatedly while the thing
  under them was wrong. Every check here states the answer it expects.
- **Keep the bug reproducible.** Where a fixture encodes bad data from the
  real feed — the score that never existed, the misnumbered safety, the
  midnight placeholder — there is a check asserting the raw data really is
  still wrong, so the fixture cannot quietly stop reproducing the thing it
  exists to catch.
- **Put the bug back and watch the test fail.** A test written after a fix
  can easily pass for the wrong reason. One of these was written against a
  chip that had been tapped, and passed against the bug it was meant to
  catch, because the trigger was `:hover` and a click does not set it.
  Re-introducing the fault is the only way to know.

## Fixtures

These fixtures are reconstructed from real ESPN payloads: the shapes and
the specific wrong values in them were observed in responses captured on a
phone, because ESPN is not reachable from where this is built.

That is the weak point. A fixture written from a guess at ESPN's shape will
pass while the app breaks — which is exactly how a box-score fix once
shipped doing nothing for an hour, having required a numeric `value` on a
field ESPN sends as a `displayValue` string.

So: when a real payload can be captured, commit it under `test/fixtures/`
and point the tests at it. Real payloads settle questions that no amount of
reasoning does.
