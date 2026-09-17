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
 * ESPN's dark-background shield, and nothing at all when there isn't one.
 * Nothing sits behind the logo either: the plain shields would need a light
 * backing to show on these panels, and that is the circle that came off the
 * team logos on purpose.
 *
 * The group ids are ESPN's own and match the ones Dynasty Tracker ships
 * against the same asset path, so a missing shield should be rare. When it
 * happens the game reads as though it weren't a conference game, which is
 * the accepted cost of not drawing a substitute for the logo.
 */
export function ConferenceBadge({ game, size = 18 }: ConferenceBadgeProps) {
  const { conferences } = useConferences()
  const conference = conferenceForGame(game, conferences)
  const url = conference ? conferenceLogoUrl(conference) : undefined
  const [missing, setMissing] = useState(false)

  if (!conference || !url || missing) return null

  return (
    <img
      className="conference-badge"
      src={url}
      alt={`${conference.name} conference game`}
      title={`${conference.name} conference game`}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setMissing(true)}
    />
  )
}
