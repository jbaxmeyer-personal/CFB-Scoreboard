import { useState } from 'react'
import './ConferenceBadge.css'
import type { Game } from '../../types/game'
import { useConferences } from '../../hooks/useConferences'
import { conferenceForGame, conferenceLogoUrl } from '../../lib/conferenceBadge'

interface ConferenceBadgeProps {
  game: Game
  /** Tallest the shield may be. */
  size?: number
  /** Widest it may be. Whichever bound bites first decides the size. */
  maxWidth?: number
}

/**
 * The conference shield on a conference game, and nothing at all on a
 * non-conference one — the badge's presence is half of what it says.
 *
 * The shield is a file in the repo, in each conference's own reverse
 * (white) artwork, so nothing sits behind it and nothing is requested at
 * runtime. A conference with no shield yet simply isn't badged.
 *
 * Sized to a box rather than to one dimension. These ten are not one shape:
 * the ACC's is a 3.4:1 wordmark, the SEC's and the Pac-12's are circular
 * crests. Pinning the height makes a wordmark 41px wide and a crest 12px
 * square — the crest ends up a smudge while the wordmark is comfortable.
 * Bounding both lets each use whichever it can, so the wordmarks run wide
 * and the crests stand tall, and neither exceeds the space the surface has.
 */
export function ConferenceBadge({ game, size = 18, maxWidth = 64 }: ConferenceBadgeProps) {
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
      style={{ maxHeight: size, maxWidth }}
      loading="lazy"
      // A local file can't answer with a placeholder the way ESPN did, but
      // a filename typo would still draw a broken image. Hide instead.
      onError={() => setMissing(true)}
    />
  )
}
