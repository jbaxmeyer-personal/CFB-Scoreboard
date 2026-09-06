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

/** Yards per game, computed here from figures this file already has exactly:
 * the season's yards, which are summed, over the games the player actually
 * appeared in, which are counted. Unlike the averages ESPN reports per game,
 * this one can be derived rather than guessed at — which is why it is the
 * one average that comes back.
 *
 * Only for the categories where a per-game yardage is the number people
 * quote. A defensive back's tackles per game is not a stat anyone asks for,
 * and inventing it for every category would bury the totals. */
const PER_GAME_YARDS = 'YDS/G'
const PER_GAME_CATEGORIES = new Set(['passing', 'rushing', 'receiving'])

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
 *
 * The one column added back is yards per game, and only where it is the
 * number people quote — see PER_GAME_YARDS. Games played is counted to
 * divide by it and is not shown: it is the workings, not the answer.
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
    const yardsAt = keep.findIndex((i) => header.columns[i].toUpperCase() === 'YDS')
    const showPerGame = yardsAt !== -1 && PER_GAME_CATEGORIES.has(name.toLowerCase())

    const rows = [...players.entries()].map(([playerName, cells]) => {
      const stats = keep.map((i) => combine(header.columns[i], cells[i])!)
      if (showPerGame) {
        const games = appearances.get(playerName) ?? 0
        const yards = Number(stats[yardsAt])
        // Inserted beside the total it comes from, so the two read together.
        stats.splice(yardsAt + 1, 0, games > 0 && Number.isFinite(yards) ? (yards / games).toFixed(1) : '—')
      }
      return { playerName, stats }
    })

    // Most productive first. A season table in the order ESPN happened to
    // list people reads as unsorted.
    const sortAt = yardsAt === -1 ? 0 : yardsAt
    rows.sort((a, b) => Number(b.stats[sortAt]) - Number(a.stats[sortAt]))

    const columns = keep.map((i) => header.columns[i])
    if (showPerGame) columns.splice(yardsAt + 1, 0, PER_GAME_YARDS)

    categories.push({ name, label: header.label, columns, rows })
  }
  return categories
}
