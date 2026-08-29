import './RankBadge.css'

interface RankBadgeProps {
  rank: number
  /** Badge diameter in px — scales with whatever logo it's overlaid on. */
  size?: number
}

export function RankBadge({ rank, size = 20 }: RankBadgeProps) {
  const fontSize = Math.max(9, Math.round(size * 0.55))
  return (
    <span
      className="rank-badge"
      style={{ width: size, height: size, fontSize, lineHeight: `${size - 3}px` }}
      aria-label={`Ranked number ${rank}`}
    >
      {rank}
    </span>
  )
}
