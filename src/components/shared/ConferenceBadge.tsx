import { useState } from 'react'
import './ConferenceBadge.css'
import type { Game } from '../../types/game'
import { useConferences } from '../../hooks/useConferences'
import { conferenceForGame, conferenceLogoUrl } from '../../lib/conferenceBadge'

interface ConferenceBadgeProps {
  game: Game
  size?: number
}

/**
 * The conference shield on a conference game, and nothing at all on a
 * non-conference one — the badge's presence is half of what it says.
 *
 * The dark-background shield, and the conference's short name as a text
 * chip when there isn't one. Nothing sits behind the logo: the plain
 * shields would need a light backing to show on these panels, and that is
 * the circle that came off the team logos on purpose.
 *
 * The group ids are ESPN's own and match the ones Dynasty Tracker ships, so
 * they're corroborated rather than guessed; the text chip covers a shield
 * that has moved anyway.
 */
export function ConferenceBadge({ game, size = 18 }: ConferenceBadgeProps) {
  const { conferences } = useConferences()
  const conference = conferenceForGame(game, conferences)
  const url = conference ? conferenceLogoUrl(conference) : undefined
  const [missing, setMissing] = useState(false)

  if (!conference) return null

  const src = missing ? undefined : url

  // As tall as the shield and as wide as it needs to be. It can take the
  // width: on Slate the badge is positioned rather than laid out, and on
  // Scoreboard it has a column of its own — neither takes the room from the
  // team names.
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
      onError={() => setMissing(true)}
    />
  )
}
