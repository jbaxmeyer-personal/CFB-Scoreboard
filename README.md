# Slate — College Football TV Guide

A dark-themed college football TV viewing guide: kickoff times converted to
your timezone, network badges, AP rankings, a live scoreboard, and a
no-spoilers mode for games you're watching on delay. Built as an installable
website/PWA first (same pattern as Dynasty Tracker); a native Expo port is a
possible future phase, not part of v1.

> **Heads up: this app is built on an unofficial ESPN endpoint.**
> Slate reads from `site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard`,
> which is a **public but undocumented and unofficial** ESPN API. There's no
> auth required, but also no SLA, versioning guarantee, or rate-limit
> disclosure — ESPN can change its response shape or availability at any
> time without notice. The app is built to degrade gracefully (cached data
> via React Query, a "couldn't load the slate" fallback state) but this
> dependency is inherently fragile. Keep that in mind before relying on it
> for anything mission-critical.

## Stack

- React + TypeScript + Vite
- React Query for fetching/caching the ESPN scoreboard endpoint
- Luxon for timezone conversion (the app's core utility)
- localStorage for settings (timezone, favorites, spoiler-protected list)
- PWA (manifest + service worker) — installable to a phone homescreen
- Deployed to GitHub Pages via GitHub Actions on push to `main`

## Features

- **Schedule Grid** — a day-tabbed timeline of every FBS game, kickoff time
  shown in your selected timezone, network badges, AP rank badges, favorite
  toggle per game/team.
- **Scoreboard Overview** — a two-column card grid of the same day's games;
  tap a card to expand it inline into a stadium-scoreboard-style detail view
  (LED score digits, quarter/clock, possession) instead of navigating away.
- **No-Spoilers mode** — a global toggle plus per-game and per-team
  protection, independent of each other. Protected games hide score/status
  everywhere (grid, cards, expanded view) behind a deliberate "tap to
  reveal" gate.
- **Settings** — timezone picker (defaults to your device's timezone),
  favorite teams, and spoiler-list management.

## Development

```bash
npm install
npm run dev
```

Regenerate PWA icons (pure Node, no image-library dependency) if you change
the icon design in `scripts/generate-icons.mjs`:

```bash
node scripts/generate-icons.mjs
```

Build and preview a production bundle:

```bash
npm run build
npm run preview
```

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the
app and publishes `dist/` to GitHub Pages. Enable Pages for this repo under
**Settings → Pages → Source: GitHub Actions** once, and every push to `main`
redeploys automatically.

## Project structure

```
src/
  types/       ESPN API response + app domain types
  lib/         timezone helpers (Luxon), ESPN fetch/parsing, mock data
  hooks/       React Query hooks, settings hooks — UI-agnostic business logic
  context/     Settings provider (timezone, favorites, spoiler protection)
  components/  Schedule Grid, Scoreboard Overview, shared UI (logos, badges)
```

Business logic (data fetching, timezone math, favorites/spoiler state) is
kept out of the rendering components on purpose, so a future native port
(Expo/React Native) can reuse it without a rewrite — see the project brief
for details. This isn't over-engineered for that future, though: it's just
normal separation of concerns.

## Roadmap / not in v1

- FCS support (need to confirm the ESPN `groups` id)
- A Cloudflare Worker proxy, only if the client-side ESPN calls hit rate
  limits or we want server-side caching
- Native Expo/React Native port, only if the web/PWA version earns its keep
