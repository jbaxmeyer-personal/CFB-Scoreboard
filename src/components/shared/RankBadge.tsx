import './RankBadge.css'

interface RankBadgeProps {
  rank: number
  /** Badge diameter in px — scales with whatever logo it's overlaid on. */
  size?: number
}

export function RankBadge({ rank, size = 20 }: RankBadgeProps) {
  const fontSize = Math.max(9, Math.round(size * 0.55))
  // A two-digit rank widens into a pill rather than being squeezed into the
  // circle — at the small sizes this is used at, a fixed square clipped "12"
  // outright once the display face stopped being a condensed one.
  const wide = String(rank).length > 1
  return (
    <span
      className="rank-badge"
      style={{
        minWidth: size,
        width: wide ? 'auto' : size,
        height: size,
        padding: wide ? '0 3px' : 0,
        fontSize,
        lineHeight: `${size - 3}px`,
      }}
      aria-label={`Ranked number ${rank}`}
    >
      {rank}
    </span>
  )
}
