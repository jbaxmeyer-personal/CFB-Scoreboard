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
 * The shield is a file in the repo, in each conference's own reverse
 * (white) artwork, so nothing sits behind it and nothing is requested at
 * runtime. A conference with no shield yet simply isn't badged.
 *
 * Sized by height, not as a square. These are wordmarks — the ACC's is
 * 202x59 — and forcing one into a square box letterboxes it down to a few
 * pixels tall. Height is the dimension that has to match the row; width
 * follows the artwork.
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
      height={size}
      loading="lazy"
      // A local file can't answer with a placeholder the way ESPN did, but
      // a filename typo would still draw a broken image. Hide instead.
      onError={() => setMissing(true)}
    />
  )
}
