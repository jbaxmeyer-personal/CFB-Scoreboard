import './ExpandedGame.css'
import type { Game, GamePlay, Team } from '../../types/game'
import { TeamLogo } from '../shared/TeamLogo'
import { SpoilerGate } from '../shared/SpoilerGate'
import { ConferenceBadge } from '../shared/ConferenceBadge'
import { SeasonLeaders, SeasonTeamComparison, GameSummarySections, FieldPositionBar } from './GameStats'
import { formatDayLabel, formatKickoff } from '../../lib/timezone'
import { seasonYearFromDate, isStatusAhead, espnGameUrl } from '../../lib/espn'
import type { LiveStatus } from '../../lib/espn'
import { useGameSummary } from '../../hooks/useGameSummary'
import { useViewState } from '../../context/ViewStateContext'
import { useCurrentRecords } from '../../hooks/useCurrentRecords'
import { timeoutsLeft, timeoutAllowance } from '../../lib/timeouts'
import { useSettings } from '../../context/SettingsContext'
import { delayBadge } from '../../lib/broadcastDelay'

/** Logo above name (not side by side) so a long team name gets the
 * identity column's full width instead of being squeezed to the right of
 * the logo, where it was clipping (e.g. "North Caroli…"). */
function TeamIdentity({
  team,
  record,
  showRecord,
  timeoutsLeftForTeam,
  timeoutAllowanceForTeam,
  side,
  onOpenTeam,
}: {
  team: Team
  /** The record to print, already resolved and spoiler-checked by the
   * caller — the team's own is only part of the answer, since a game not
   * yet played carries none. */
  record: string | undefined
  showRecord: boolean
  /** Timeouts this team has left, when the game is live and not protected.
   * Undefined draws nothing at all, which is the pre-game, finished and
   * spoiler-protected case. */
  timeoutsLeftForTeam: number | undefined
  timeoutAllowanceForTeam: number
  side: 'Away' | 'Home'
  onOpenTeam?: () => void
}) {
  return (
    <button
      type="button"
      className="expanded-game__identity expanded-game__identity--tappable"
      onClick={onOpenTeam}
      disabled={!onOpenTeam}
      aria-label={onOpenTeam ? `${team.name} team page` : undefined}
    >
      <TeamLogo team={team} size={40} rank={team.rank} />
      <div className="expanded-game__name">
        <span>{team.shortName}</span>
        {showRecord && record && <span className="expanded-game__record">{record}</span>}
        {timeoutsLeftForTeam !== undefined && (
          <TimeoutPips left={timeoutsLeftForTeam} of={timeoutAllowanceForTeam} side={side} />
        )}
      </div>
    </button>
  )
}

/**
 * Everything derived from live score/game-state. Only ever rendered with
 * the *real* game — callers must gate this behind SpoilerGate whenever the
 * game is protected and there's something (a live score or a final) to hide.
 */
/**
 * What the header should say, given the two feeds.
 *
 * Shared because two places need it now — the clock and score inside the
 * live area, and the timeout pips under the crests, which sit outside it.
 * Deriving the period twice would mean the pips could count a different
 * half from the one on screen.
 */
/** The play feed writes its clock zero-padded ("01:59") where the
 * scoreboard writes it plain ("1:59"). The header reads off the plays now,
 * so without this the time would have silently gained a digit. */
function tidyClock(clock: string | undefined): string | undefined {
  return clock?.replace(/^0(\d:\d{2})$/, '$1')
}

function liveHeadline(game: Game, liveStatus: LiveStatus | undefined, plays: GamePlay[]) {
  // Which endpoint's clock to believe for the game's *state*. The scoreboard
  // covers a whole day and the summary covers this one game, and the
  // per-game feed moves first — watched live, the play-by-play had posted
  // "End of 4th quarter." while the header still read Q4 1:41 on a finished
  // game. Take whichever is further along, and only ever forward, so a feed
  // that stalls or rewinds can't pull the header back into a quarter the
  // game has left.
  const status = liveStatus && isStatusAhead(liveStatus, game) ? liveStatus : game
  const latestPlay = plays.at(-1)

  // While a game is being played, the numbers shown come from the newest
  // play and from nothing else.
  //
  // This is an ordering rule, not an accuracy one. The scoreboard endpoint
  // is often a beat quicker than the play feed, so taking the higher of the
  // two meant the score and the clock could jump before the play that
  // caused them appeared in the list below — you would read the new number
  // and only then scroll down to find out what happened. That is the ending
  // of the story printed above the page it happens on. Reading both off the
  // same play keeps the list in front: the score never moves until the play
  // explaining it is there to be read.
  //
  // It costs a little freshness, which is the point. The scoreboard is
  // still believed about state: a game that has ended has ended.
  const followPlays = status.state === 'in' && latestPlay !== undefined
  return {
    status,
    latestPlay,
    followPlays,
    period: followPlays ? latestPlay.period : status.period,
    clock: followPlays ? tidyClock(latestPlay.clock) : status.clock,
  }
}

/**
 * Timeouts left, as pips under the team they belong to.
 *
 * Under the crest rather than in a row of their own: that is where you
 * look for a fact about one team, it reads without a label, and it leaves
 * the space below the clock for the down and distance, which is the thing
 * you actually want while the clock is stopped.
 *
 * A spent timeout keeps its place rather than disappearing, so the row
 * holds still and "two left" is read from the shape instead of counted.
 * The count is spelled out for a screen reader, which cannot see pips.
 *
 * `of` is the allowance for the block being played — three in a half, one
 * in overtime — so this never draws three pips for a team that only ever
 * had one.
 */
function TimeoutPips({ left, of, side }: { left: number; of: number; side: 'Away' | 'Home' }) {
  return (
    <span
      className="expanded-game__timeout-pips"
      aria-label={`${side} ${left} timeout${left === 1 ? '' : 's'} left`}
    >
      {Array.from({ length: of }, (_, i) => (
        <span
          key={i}
          className={`expanded-game__timeout-pip${i < left ? ' expanded-game__timeout-pip--left' : ''}`}
        />
      ))}
    </span>
  )
}

function LiveArea({ game, zoneId, isDelayed }: { game: Game; zoneId: string; isDelayed: boolean }) {
  // The delay is marked at the clock, not only in the app header: the header
  // scrolls away, and a game running two minutes behind reads as a stuck
  // clock rather than as a setting doing its job. The clock is where the lag
  // is noticed, so it is where the reason belongs.
  const { settings } = useSettings()
  const delay = delayBadge(settings.broadcastDelaySeconds)
  // Called unconditionally — game.state can transition pre -> in on this
  // same mounted instance as scoreboard data refreshes, so this can't sit
  // after the pre-game early return below (Rules of Hooks). Only actually
  // fetches once live/final, and shares its query key with
  // GameSummarySections further down, so this never costs an extra request.
  const { plays, currentDrive, liveStatus } = useGameSummary(game, game.state === 'in', game.state !== 'pre')

  const { status, latestPlay, followPlays, period: shownPeriod, clock: shownClock } = liveHeadline(game, liveStatus, plays)

  if (game.state === 'pre') {
    return (
      <span className="ticker expanded-game__clock">
        {game.timeTBD ? 'TIME TBD' : formatKickoff(game.startDate, zoneId)}
      </span>
    )
  }

  // The score fields are stripped while the delay holds this game, and the
  // fallbacks below would render that as 0-0 — a scoreline of its own, and a
  // wrong one. Say what is actually happening instead.
  if (isDelayed) {
    return (
      <div className="expanded-game__score-block">
        <span className="ticker expanded-game__clock expanded-game__clock--live">
          <span className="live-dot" aria-hidden="true" />
          LIVE
        </span>
        <span className="expanded-game__delay-note">Waiting on your broadcast delay…</span>
      </div>
    )
  }

  // The scoreboard endpoint (game.homeScore/awayScore, polled across the
  // whole week's games) and the per-game summary endpoint (plays, polled
  // for just this game while live) can disagree, in both directions, and
  // the old rule — always believe the newest play — got the second one
  // badly wrong.
  //
  // The summary is the faster of the two right after a score, which is why
  // it was preferred. But its play feed can also simply stop short: a
  // finished game came back with its last play reading 14-19 when the game
  // had ended 20-19. The panel showed 14-19 under the word FINAL, directly
  // above a box score that added up to 20-19, next to a card that said
  // 20-19 — and, because the wrong number was lower, it painted Michigan
  // the winner of a game Iowa won.
  //
  // A score never goes down, so the honest reading is the highest any
  // source reports. That takes the newer number when the feed is ahead and
  // the complete one when the feed is short, without having to know which
  // case this is.
  //
  // Only a finished game takes the higher of the two, and only because its
  // feed can stop short: one came back with its last play reading 14-19 on
  // a game that ended 20-19, which printed the loser as the winner. While
  // the game is live, `followPlays` keeps the header behind the play list —
  // see liveHeadline.
  const best = (fromPlay: number | undefined, fromScoreboard: number | undefined): number =>
    followPlays ? (fromPlay ?? 0) : Math.max(fromPlay ?? 0, fromScoreboard ?? 0)
  const awayScore = best(latestPlay?.awayScore, game.awayScore)
  const homeScore = best(latestPlay?.homeScore, game.homeScore)

  // Down, distance and the ball's spot come off the newest play too, for
  // the same reason the score and clock do.
  //
  // The scoreboard's own `situation` is the live one, and it runs ahead:
  // reported with the list showing "1st & 10" at Q3 7:33 while the header
  // read "3rd & 2 · ARIZ 47" — two snaps further on than anything you
  // could read. A play's `end` describes the same thing and belongs to a
  // row in the list, so the two cannot disagree.
  //
  // Only the situation is swapped; everything else about the game is left
  // alone. Where the play carried no usable spot the bar is left to the
  // scoreboard rather than blanked, since that is a gap in the feed rather
  // than a thing running ahead.
  // Not the newest play, but the newest one that left a situation behind.
  // Measured on a day's real feeds, 13% of plays carry none — and they are
  // the ones most likely to be newest: timeouts, touchdowns, end of
  // quarter. The reported game's newest row was itself a timeout. Reading
  // only the last play would have fallen back to the scoreboard at exactly
  // those moments, which is the thing being fixed.
  //
  // Any play in the list is a row that can be read, so none of them is
  // ahead of it.
  const lastSpotted = followPlays ? plays.findLast((p) => p.after !== undefined) : undefined
  const afterPossession =
    lastSpotted?.afterPossessionTeamId === game.home.id
      ? 'home'
      : lastSpotted?.afterPossessionTeamId === game.away.id
        ? 'away'
        : undefined
  // While live, the bar is drawn only from the plays. If nothing in the
  // list has reached a spot yet, nothing is drawn — the scoreboard's own
  // situation is not borrowed, because that is the one that runs ahead.
  const shownSituation = followPlays
    ? lastSpotted?.after
      ? { ...game, situation: lastSpotted.after, possession: afterPossession ?? game.possession }
      : { ...game, situation: undefined }
    : game

  // Only a final score is a real result — a live score can still flip, so
  // only 'post' games ever get a winner highlight.
  const isFinal = status.state === 'post'
  const awayWins = isFinal && awayScore > homeScore
  const homeWins = isFinal && homeScore > awayScore

  return (
    <div className="expanded-game__score-block">
      <div className="expanded-game__digits">
        <span
          className={`expanded-game__led${game.possession === 'away' ? ' expanded-game__led--possession' : ''}${awayWins ? ' expanded-game__led--winner' : ''}`}
        >
          {awayScore}
        </span>
        <span className="expanded-game__led-sep">–</span>
        <span
          className={`expanded-game__led${game.possession === 'home' ? ' expanded-game__led--possession' : ''}${homeWins ? ' expanded-game__led--winner' : ''}`}
        >
          {homeScore}
        </span>
      </div>
      {status.state === 'in' && (
        <span className="ticker expanded-game__clock expanded-game__clock--live">
          <span className="live-dot" aria-hidden="true" />
          {shownPeriod ? `Q${shownPeriod}` : ''} {shownClock ?? ''}
          {delay && (
            <span
              className="expanded-game__clock-delay"
              title={`Held ${settings.broadcastDelaySeconds} seconds behind live by your broadcast delay`}
            >
              {delay}
            </span>
          )}
        </span>
      )}
      {status.state === 'post' && <span className="ticker expanded-game__clock expanded-game__clock--final">FINAL</span>}
      {/* Gated on the corrected state too, so a finished game stops showing
          down, distance and a ball spotted mid-field. */}
      {status.state === 'in' && <FieldPositionBar game={shownSituation} drive={currentDrive} />}
      <GameSummarySections game={game} />
    </div>
  )
}

interface ExpandedGameProps {
  /** The true, unsanitized game — only safe here because the score/state
   * portion below is gated by SpoilerGate whenever `isProtected` is set. */
  game: Game
  zoneId: string
  isProtected: boolean
  /** The broadcast delay is holding this game's live state back. */
  isDelayed?: boolean
}

export function ExpandedGame({ game, zoneId, isProtected, isDelayed = false }: ExpandedGameProps) {
  const hasHideableResult = isProtected && game.state !== 'pre'
  const { pushDetail } = useViewState()
  const currentRecord = useCurrentRecords(seasonYearFromDate(game.startDate))

  /**
   * The record under a crest.
   *
   * ESPN attaches a team's record *as of that game*, and for a game not
   * yet played it attaches none — so an upcoming matchup opened from a
   * team's schedule showed no records at all under either crest. Those
   * fall back to the team's record now, from the standings feed.
   *
   * Never on a protected game, whichever side and whatever its state: a
   * protected game shows no records, and filling a gap the sanitizer
   * deliberately left is exactly how one would get back in.
   */
  const recordFor = (team: Game['home']): string | undefined =>
    isProtected ? undefined : (team.record ?? currentRecord(team.id))

  /**
   * Timeouts left, for the pips under each crest.
   *
   * Computed up here because the crests are drawn outside the spoiler gate
   * below, and so the gate cannot do the withholding for them — a
   * protected game has to be refused the numbers at the source. Which is
   * why `isProtected` is checked here and not merely leaned on downstream:
   * how many timeouts a team has left is a fact about a game in progress,
   * and that is the whole of what being protected hides.
   *
   * The same query key as the live area below, so this costs no extra
   * request; the shared `liveHeadline` keeps the half counted here the
   * same as the quarter shown there.
   */
  const { plays, liveStatus } = useGameSummary(game, game.state === 'in', game.state !== 'pre')
  const headline = liveHeadline(game, liveStatus, plays)
  const timeouts =
    isProtected || headline.status.state !== 'in'
      ? undefined
      : timeoutsLeft(plays, game.home, game.away, headline.period)
  const pipsOf = timeoutAllowance(headline.period)

  // Opening a team stacks its page on top of this one — GameDetailPanel owns
  // that stack, so a game reached from a team's schedule goes through the
  // same spoiler-safe path as one opened from the grid.
  const openTeam = (team: Game['home']) => pushDetail({ kind: 'team', team, year: seasonYearFromDate(game.startDate) })

  return (
    <div className="expanded-game">
      <div className="expanded-game__panel">
        <div className="expanded-game__bezel">
          <div className="expanded-game__matchup">
            {/* Records show on every game — upcoming, live and finished —
                except one case. This block sits outside the spoiler gate
                below, and once a game is over the record ESPN sends counts
                it, so a protected final would give its result away here
                while the scoreline next to it stayed hidden. That is the
                only thing `hasHideableResult` withholds. */}
            <TeamIdentity
              team={game.away}
              record={recordFor(game.away)}
              showRecord={!hasHideableResult}
              timeoutsLeftForTeam={timeouts?.away}
              timeoutAllowanceForTeam={pipsOf}
              side="Away"
              onOpenTeam={() => openTeam(game.away)}
            />
            {/* The shield stacks above the "@", between the two crests: on
                this screen the conference is the one thing about the game
                that belongs to neither side, and the middle of the matchup
                is where that reads. Nothing on a non-conference game, and
                the "@" stays put either way. */}
            <div className="expanded-game__between">
              <ConferenceBadge game={game} size={28} maxWidth={64} />
              <span className="expanded-game__at">@</span>
            </div>
            <TeamIdentity
              team={game.home}
              record={recordFor(game.home)}
              showRecord={!hasHideableResult}
              timeoutsLeftForTeam={timeouts?.home}
              timeoutAllowanceForTeam={pipsOf}
              side="Home"
              onOpenTeam={() => openTeam(game.home)}
            />
          </div>

          <div className={`expanded-game__live-area${hasHideableResult ? ' expanded-game__live-area--gated' : ''}`}>
            {hasHideableResult ? (
              <SpoilerGate>
                <LiveArea game={game} zoneId={zoneId} isDelayed={isDelayed} />
              </SpoilerGate>
            ) : (
              <LiveArea game={game} zoneId={zoneId} isDelayed={isDelayed} />
            )}
          </div>
        </div>

        {game.state === 'pre' && <SeasonTeamComparison home={game.home} away={game.away} year={seasonYearFromDate(game.startDate)} />}
        {game.state === 'pre' && <SeasonLeaders home={game.home} away={game.away} />}

        <div className="expanded-game__footer">
          <span className="expanded-game__venue">{game.venue ?? formatDayLabel(game.startDate, zoneId)}</span>
          {/* Always here, for every game, not only when the stats came back
              empty: this is the way out to the source when Slate and ESPN
              disagree about something, and a link you can only reach by
              first hitting a failure is a link you can't reach when you
              need it. It carries the game id and nothing else, so it's
              safe to show above a spoiler-protected game. */}
          <a
            className="expanded-game__source"
            href={espnGameUrl(game.id)}
            target="_blank"
            rel="noreferrer"
          >
            View on ESPN
          </a>
        </div>
      </div>
    </div>
  )
}
