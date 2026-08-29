import './NetworkBadge.css'

// ESPN sometimes gives the full network name instead of its usual short
// abbreviation (e.g. "ACC Network" instead of "ACCN") — normalize those so
// badges stay compact and still hit the color map below.
const NETWORK_ABBREVIATIONS: Record<string, string> = {
  'ACC Network': 'ACCN',
  'ACC Network Extra': 'ACCNX',
  'SEC Network': 'SECN',
  'SEC Network+': 'SECN+',
  'Big Ten Network': 'BTN',
  'Pac-12 Network': 'PAC-12',
  'ESPN Deportes': 'ESPN Dep.',
}

function shortNetworkName(name: string): string {
  return NETWORK_ABBREVIATIONS[name] ?? name
}

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
  const short = shortNetworkName(name)
  const color = NETWORK_COLORS[short] ?? '#3a4150'
  return (
    <span className="network-badge" style={{ '--nb-color': color } as React.CSSProperties}>
      {short}
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
