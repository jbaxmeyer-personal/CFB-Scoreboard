import type { EspnScoreboardResponse, EspnSummaryResponse } from '../types/espn'

/**
 * A small, readable extract of what ESPN actually sent for one game.
 *
 * Every field-level bug in this app has come from the same place: ESPN is
 * unreachable from where Slate is built, so what its fields *mean* has been
 * inferred from how the screen looked and then shipped as fact. Several of
 * those inferences were wrong — the field-position frame twice, which clock
 * a play row should use, whether a kickoff carries a down — and each one
 * cost a round of somebody watching a real game to catch.
 *
 * This turns that around. The phone can reach ESPN; this pulls the exact
 * objects those questions hinge on out of the responses already in the
 * cache, small enough to read or paste back.
 *
 * Nothing here is interpreted. Values are copied verbatim, because the whole
 * point is to see them rather than to see this app's opinion of them.
 */
export interface FeedSampleSources {
  gameId: string
  scoreboards: EspnScoreboardResponse[]
  summary?: EspnSummaryResponse
}

/** Trims a drive to its shape plus a couple of plays — enough to see what
 * `start` carries and how a play is described, without pasting a whole
 * quarter. */
function sampleDrive(drive: unknown, plays: number): unknown {
  if (!drive || typeof drive !== 'object') return drive
  const d = drive as Record<string, unknown>
  const list = Array.isArray(d.plays) ? d.plays : []
  return {
    ...d,
    plays: list.slice(0, plays),
    ...(list.length > plays ? { '…': `${list.length - plays} more plays omitted` } : {}),
  }
}

export function buildFeedSample({ gameId, scoreboards, summary }: FeedSampleSources): string {
  const event = scoreboards.flatMap((s) => s?.events ?? []).find((e) => e.id === gameId)
  const competition = event?.competitions?.[0]
  const drives = summary?.drives

  const sample = {
    gameId,
    scoreboard: event
      ? {
          shortName: event.shortName,
          status: competition?.status ?? event.status,
          // The two fields the field-position bar is drawn from.
          situation: competition?.situation ?? '(no situation)',
          competitors: competition?.competitors?.map((c) => ({
            homeAway: c.homeAway,
            id: c.team?.id,
            abbreviation: c.team?.abbreviation,
            score: c.score,
          })),
        }
      : '(this game was not in any cached scoreboard response)',
    summary: summary
      ? {
          headerStatus: summary.header?.competitions?.[0]?.status ?? '(none)',
          playByPlaySource: summary.header?.competitions?.[0]?.playByPlaySource ?? '(absent)',
          driveCounts: `${drives?.previous?.length ?? 0} previous, ${drives?.current ? 1 : 0} current`,
          currentDrive: drives?.current ? sampleDrive(drives.current, 3) : '(none)',
          lastPreviousDrive: drives?.previous?.length ? sampleDrive(drives.previous[drives.previous.length - 1], 2) : '(none)',
          topLevelKeys: Object.keys(summary).join(', '),
        }
      : '(no summary cached — open a live game first)',
  }

  return JSON.stringify(sample, null, 2)
}
