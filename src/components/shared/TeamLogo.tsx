import { useState } from 'react'
import './TeamLogo.css'
import type { Team } from '../../types/game'

interface TeamLogoProps {
  team: Team
  size?: number
}

export function TeamLogo({ team, size = 40 }: TeamLogoProps) {
  const [failed, setFailed] = useState(false)
  const src = team.logoDark ?? team.logoLight

  if (!src || failed) {
    return (
      <div
        className="team-logo team-logo--fallback"
        style={{ width: size, height: size, background: team.color ?? 'var(--bg-panel-raised)' }}
      >
        {team.abbreviation.slice(0, 3)}
      </div>
    )
  }
  return (
    <div className="team-logo" style={{ width: size, height: size }}>
      <img src={src} alt={`${team.name} logo`} width={size} height={size} loading="lazy" onError={() => setFailed(true)} />
    </div>
  )
}
