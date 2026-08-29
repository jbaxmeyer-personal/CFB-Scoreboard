import { useState } from 'react'
import './TeamLogo.css'
import type { Team } from '../../types/game'
import { RankBadge } from './RankBadge'

interface TeamLogoProps {
  team: Team
  size?: number
  /** AP rank, rendered as a small badge overlaid on the logo's corner. */
  rank?: number
}

type Stage = 'dark' | 'light' | 'fallback'

function initialStage(team: Team): Stage {
  if (team.logoDark && team.logoDark !== team.logoLight) return 'dark'
  if (team.logoLight) return 'light'
  return 'fallback'
}

export function TeamLogo({ team, size = 40, rank }: TeamLogoProps) {
  const [stage, setStage] = useState<Stage>(() => initialStage(team))
  const src = stage === 'dark' ? team.logoDark : stage === 'light' ? team.logoLight : undefined

  const logo =
    stage === 'fallback' || !src ? (
      <div
        className="team-logo team-logo--fallback"
        style={{ width: size, height: size, background: team.color ?? 'var(--bg-panel-raised)' }}
      >
        {team.abbreviation.slice(0, 3)}
      </div>
    ) : (
      <div className="team-logo" style={{ width: size, height: size }}>
        <img
          src={src}
          alt={`${team.name} logo`}
          width={size}
          height={size}
          loading="lazy"
          // The "-dark" CDN variant 404s for teams that don't have one — fall
          // back to the regular logo, then finally to the initials circle.
          onError={() => setStage((s) => (s === 'dark' && team.logoLight ? 'light' : 'fallback'))}
        />
      </div>
    )

  if (!rank || rank <= 0) return logo

  return (
    <span className="team-logo-rank-wrap">
      {logo}
      <RankBadge rank={rank} size={Math.round(size * 0.5)} />
    </span>
  )
}
