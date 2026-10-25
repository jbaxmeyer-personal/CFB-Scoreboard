import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import './GameDetailPanel.css'
import { useSpoilerSafeGames } from '../../hooks/useSpoilerSafeGames'
import { useViewState } from '../../context/ViewStateContext'
import { useSettings } from '../../context/SettingsContext'
import { ExpandedGame } from '../scoreboard/ExpandedGame'
import { TeamPage } from '../team/TeamPage'
import { NetworkBadgeList } from './NetworkBadge'
import { DETAIL_LAYER_ID } from './GameDetailPanel'

/**
 * A team page opened from a screen that has no game under it — Standings.
 *
 * The sibling of GameDetailPanel, painting into the same layer and reusing
 * its stylesheet, but with a different thing at the bottom of the stack.
 * There, the root is an expanded game and a team page is something you
 * reach from it; here the team page *is* the root, so there is no game to
 * close back to and no networks to badge at the first level.
 *
 * Kept separate rather than folded into GameDetailPanel because that
 * component's whole contract is "the game you opened, plus whatever is on
 * top of it" — it returns null without one, draws the game's broadcasts in
 * its header, and closes back to the list. Teaching it to also mean "no
 * game at all" would have put a branch through every one of those.
 *
 * What is shared is the part that must not drift: a game reached from a
 * team's schedule goes through the same spoiler choke point as a game
 * opened anywhere else.
 */
export function TeamDetailPanel() {
  const { detailStack, pushDetail, popDetail } = useViewState()
  const { settings } = useSettings()
  const top = detailStack.at(-1)

  // A game reached sideways — from a team's schedule — is raw feed data,
  // so it is sanitized before anything renders it. A protected team's past
  // results must not become visible just because you arrived this way.
  const stackedGames = useMemo(() => (top?.kind === 'game' ? [top.game] : []), [top])
  const stackedEntry = useSpoilerSafeGames(stackedGames)[0]

  const layer = typeof document === 'undefined' ? null : document.getElementById(DETAIL_LAYER_ID)
  if (!top || !layer) return null

  // A team page draws its own Back, so it needs no header from the panel.
  // Popping the last frame closes the panel and returns to the table.
  if (top.kind === 'team') {
    return createPortal(
      <div className="game-detail-panel">
        <TeamPage
          team={top.team}
          year={top.year}
          onBack={popDetail}
          onSelectGame={(game) => pushDetail({ kind: 'game', game })}
        />
      </div>,
      layer,
    )
  }

  if (!stackedEntry) return null

  return createPortal(
    <div className="game-detail-panel">
      <div className="game-detail-panel__header">
        <button type="button" className="game-detail-panel__back" onClick={popDetail}>
          ‹ Back
        </button>
        {/* From the sanitized view, like the other panel: the network is not
            a spoiler, but nothing outside the gate reaches for rawGame. */}
        <NetworkBadgeList networks={stackedEntry.game.broadcasts} />
      </div>
      <ExpandedGame
        game={stackedEntry.rawGame}
        zoneId={settings.timezoneId}
        isProtected={stackedEntry.isProtected}
        isDelayed={stackedEntry.isDelayed}
      />
    </div>,
    layer,
  )
}
