import { useEffect, useMemo, useState } from 'react'
import './TimeGrid.css'
import type { SafeGameEntry } from '../../hooks/useSpoilerSafeGames'
import { GameChip } from './GameChip'
import { NetworkBadge } from '../shared/NetworkBadge'
import { EmptyState } from '../shared/StatusStates'
import { computeGridBounds, groupByNetwork, hourTicks, nowOffsetMinutes, pxPerMinute, layoutRow, LABEL_WIDTH } from '../../lib/scheduleGrid'

const ROW_HEIGHT = 64

interface TimeGridProps {
  entries: SafeGameEntry[]
  zoneId: string
  onSelectGame: (gameId: string) => void
}

export function TimeGrid({ entries, zoneId, onSelectGame }: TimeGridProps) {
  const games = useMemo(() => entries.map((e) => e.game), [entries])
  const protectedIds = useMemo(() => new Set(entries.filter((e) => e.isProtected).map((e) => e.game.id)), [entries])

  const bounds = useMemo(() => computeGridBounds(games, zoneId), [games, zoneId])
  const rows = useMemo(() => groupByNetwork(games), [games])

  // Ticks every minute so the "now" line keeps advancing while the screen stays open.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  if (!bounds || games.length === 0) return <EmptyState />

  const totalWidth = bounds.totalMinutes * pxPerMinute()
  const ticks = hourTicks(bounds)
  const nowOffset = nowOffsetMinutes(zoneId, bounds)
  const showNowLine = nowOffset >= 0 && nowOffset <= bounds.totalMinutes

  return (
    <div className="time-grid-scroll scrollbar-hide">
      <div className="time-grid" style={{ width: totalWidth + LABEL_WIDTH }}>
        {showNowLine && (
          <div className="time-grid__now-line" style={{ left: LABEL_WIDTH + nowOffset * pxPerMinute() }} />
        )}
        <div className="time-grid__header">
          <div className="time-grid__corner" />
          <div className="time-grid__ticks" style={{ width: totalWidth }}>
            {ticks.map((tick) => (
              <span
                key={tick.toISO()}
                className="time-grid__tick ticker"
                style={{ left: tick.diff(bounds.start, 'minutes').minutes * pxPerMinute() }}
              >
                {tick.toFormat('h a')}
              </span>
            ))}
          </div>
        </div>

        {rows.map((row) => (
          <div className="time-grid__row" key={row.network} style={{ height: ROW_HEIGHT }}>
            <div className="time-grid__row-label">
              <NetworkBadge name={row.network} />
            </div>
            <div
              className="time-grid__row-track"
              style={{
                width: totalWidth,
                height: ROW_HEIGHT,
                backgroundSize: `${totalWidth / (bounds.totalMinutes / 60)}px 100%`,
              }}
            >
              {layoutRow(row.games, zoneId, bounds).map(({ game, left, width }) => (
                <GameChip
                  key={game.id}
                  game={game}
                  isProtected={protectedIds.has(game.id)}
                  zoneId={zoneId}
                  left={left}
                  top={4}
                  width={width - 6}
                  onSelect={() => onSelectGame(game.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
