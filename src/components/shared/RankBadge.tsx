import './RankBadge.css'

export function RankBadge({ rank }: { rank: number }) {
  return (
    <span className="rank-badge" aria-label={`Ranked number ${rank}`}>
      {rank}
    </span>
  )
}
