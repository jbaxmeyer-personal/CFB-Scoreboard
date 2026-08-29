import './NetworkBadge.css'

const NETWORK_COLORS: Record<string, string> = {
  ESPN: '#d00000',
  ESPN2: '#d00000',
  ESPNU: '#d00000',
  ABC: '#2f2f2f',
  FOX: '#004890',
  FS1: '#004890',
  CBS: '#0057b8',
  NBC: '#6f42c1',
  BTN: '#c8102e',
  ACCN: '#003876',
  SECN: '#c8102e',
  CBSSN: '#0057b8',
}

export function NetworkBadge({ name }: { name: string }) {
  const color = NETWORK_COLORS[name] ?? '#3a4150'
  return (
    <span className="network-badge" style={{ '--nb-color': color } as React.CSSProperties}>
      {name}
    </span>
  )
}

export function NetworkBadgeList({ networks }: { networks: string[] }) {
  if (networks.length === 0) return null
  return (
    <div className="network-badge-list">
      {networks.map((n) => (
        <NetworkBadge key={n} name={n} />
      ))}
    </div>
  )
}
