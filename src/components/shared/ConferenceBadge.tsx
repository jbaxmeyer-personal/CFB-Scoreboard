import { useState } from 'react'
import './ConferenceBadge.css'
import type { Game } from '../../types/game'
import { useConferences } from '../../hooks/useConferences'
import { conferenceForGame, conferenceLogoSources } from '../../lib/conferenceBadge'

type Stage = 'dark' | 'light' | 'fallback'

interface ConferenceBadgeProps {
  game: Game
  size?: number
}

/**
 * The conference shield on a conference game, and nothing at all on a
 * non-conference one — the badge's presence is half of what it says.
 *
 * Falls back the same way TeamLogo does: the dark-background variant, then
 * the plain one, then the conference's short name as a text chip. ESPN's
 * group ids couldn't be verified from the build environment, so the text
 * chip is what keeps a wrong id from showing a broken image — you'd see
 * "ACC" instead of the shield, which still reads.
 */
export function ConferenceBadge({ game, size = 18 }: ConferenceBadgeProps) {
  const { conferences } = useConferences()
  const conference = conferenceForGame(game, conferences)
  const sources = conference ? conferenceLogoSources(conference) : undefined
  const [stage, setStage] = useState<Stage>('dark')

  if (!conference) return null

  const src = sources && stage !== 'fallback' ? (stage === 'dark' ? sources.dark : sources.light) : undefined

  // As tall as the shield and as wide as it needs to be. It can take the
  // width: on Slate the badge is positioned rather than laid out, and on
  // Scoreboard it has a column of its own — neither takes the room from the
  // team names, which is what a square box was guarding against before the
  // badge came out of the chip's flow.
  if (!src) {
    return (
      <span
        className="conference-badge conference-badge--text"
        style={{ height: size }}
        title={`${conference.name} conference game`}
      >
        {conference.shortName}
      </span>
    )
  }

  return (
    <img
      className="conference-badge"
      src={src}
      alt={`${conference.name} conference game`}
      title={`${conference.name} conference game`}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setStage((s) => (s === 'dark' ? 'light' : 'fallback'))}
    />
  )
}
