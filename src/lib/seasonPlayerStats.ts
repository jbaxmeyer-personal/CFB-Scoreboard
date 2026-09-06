import type { PlayerStatCategory } from '../types/game'

/**
 * One team's season player stats, added up from that team's own games.
 *
 * ESPN publishes no per-team source for these. The roster carries bios; the
 * team statistics response carries team totals; the core API needs a request
 * per athlete and then some; `athletes/{id}/stats` is a 404; and
 * `statistics/byathlete`, which has exactly the right shape, cannot be
 * narrowed to a team — five ways of asking all came back league-wide.
 *
 * But the numbers are already in reach without any of that. Every game's
 * summary carries both teams' per-player lines, the team page already knows
 * which games the team has played, and the app already caches those
 * summaries under the same key the expanded game uses. So a season is the
 * team's own box scores added together: one request per game played, most of
 * them already in hand, and nothing downloaded that belongs to another team.
 */

/** Longest-play columns take the best of the season, not the sum of them. */
const MAX_COLUMNS = new Set(['LONG', 'LNG'])

/** Games played, counted here rather than read from anywhere — a player is
 * credited with a game in a category when they have a line in it. */
const GAMES_PLAYED = 'GP'

const COMBINED = /^(\d+)\/(\d+)$/
const INTEGER = /^-?\d+$/

/**
 * How a column of per-game values becomes one season value.
 *
 * Decided from the values themselves rather than from what the header is
 * called, because a header is a label and a label is a guess. Counting stats
 * add up; "22/28" adds up on both sides of the slash; longest-play columns
 * take the maximum. Anything else — an average, a percentage, a rating, a
 * QBR — is left out entirely rather than added into nonsense, since none of
 * those can be recovered from per-game figures without knowing which other
 * columns they were derived from.
 */
function combine(label: string, values: string[]): string | undefined {
  const present = values.filter((v) => v !== '' && v !== '—' && v !== '-')
  if (present.length === 0) return undefined

  if (MAX_COLUMNS.has(label.toUpperCase()) && present.every((v) => INTEGER.test(v))) {
    return String(Math.max(...present.map(Number)))
  }
  if (present.every((v) => COMBINED.test(v))) {
    let left = 0
    let right = 0
    for (const value of present) {
      const match = value.match(COMBINED)!
      left += Number(match[1])
      right += Number(match[2])
    }
    return `${left}/${right}`
  }
  if (present.every((v) => INTEGER.test(v))) {
    return String(present.reduce((sum, v) => sum + Number(v), 0))
  }
  return undefined
}

/**
 * Adds a team's per-game categories into season lines.
 *
 * Takes the categories exactly as the game box score produces them, so both
 * screens read the same feed the same way. Columns that can't be added are
 * dropped from the header as well as the rows, so nothing is left sitting
 * under a heading it doesn't answer to.
 */
export function aggregateSeasonPlayers(perGame: PlayerStatCategory[][]): PlayerStatCategory[] {
  // Category -> column labels, in the order the feed first gave them.
  const columnsByCategory = new Map<string, { label: string; columns: string[] }>()
  // Category -> player -> column index -> that player's value in each game.
  const valuesByCategory = new Map<string, Map<string, string[][]>>()
  const gamesByCategory = new Map<string, Map<string, number>>()

  for (const game of perGame) {
    for (const category of game) {
      if (!columnsByCategory.has(category.name)) {
        columnsByCategory.set(category.name, { label: category.label, columns: category.columns })
      }
      const columns = columnsByCategory.get(category.name)!.columns
      const players = valuesByCategory.get(category.name) ?? new Map<string, string[][]>()
      const appearances = gamesByCategory.get(category.name) ?? new Map<string, number>()

      for (const row of category.rows) {
        const cells = players.get(row.playerName) ?? columns.map(() => [] as string[])
        for (let i = 0; i < columns.length; i++) {
          const value = row.stats[i]
          if (value !== undefined) cells[i].push(value)
        }
        players.set(row.playerName, cells)
        appearances.set(row.playerName, (appearances.get(row.playerName) ?? 0) + 1)
      }
      valuesByCategory.set(category.name, players)
      gamesByCategory.set(category.name, appearances)
    }
  }

  const categories: PlayerStatCategory[] = []
  for (const [name, header] of columnsByCategory) {
    const players = valuesByCategory.get(name)
    if (!players || players.size === 0) continue

    // A column survives only if every player's season value could be
    // combined; a column that works for one player and not another would put
    // a blank in a total.
    const keep: number[] = []
    for (let i = 0; i < header.columns.length; i++) {
      const label = header.columns[i]
      const everyone = [...players.values()].map((cells) => combine(label, cells[i]))
      if (everyone.length > 0 && everyone.every((v) => v !== undefined)) keep.push(i)
    }
    if (keep.length === 0) continue

    const appearances = gamesByCategory.get(name)!
    const rows = [...players.entries()].map(([playerName, cells]) => ({
      playerName,
      stats: [String(appearances.get(playerName) ?? 0), ...keep.map((i) => combine(header.columns[i], cells[i])!)],
    }))
    // Most productive first, by the column most likely to be yardage, else
    // by games played — a season table sorted by whoever ESPN listed first
    // reads as unsorted.
    const sortIndex = keep.findIndex((i) => header.columns[i].toUpperCase() === 'YDS')
    rows.sort((a, b) => Number(b.stats[sortIndex + 1] ?? b.stats[0]) - Number(a.stats[sortIndex + 1] ?? a.stats[0]))

    categories.push({
      name,
      label: header.label,
      columns: [GAMES_PLAYED, ...keep.map((i) => header.columns[i])],
      rows,
    })
  }
  return categories
}
