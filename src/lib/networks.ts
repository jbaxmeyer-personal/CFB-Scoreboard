// ESPN sometimes gives the full network name instead of its usual short
// abbreviation ("ACC Network" for ACCN, "SEC Network+" for SECN+), and it is
// not consistent about which it sends for the same network on the same day.
// Everything that groups, ranks or labels a network goes through
// shortNetworkName first, so one network is one row no matter which spelling
// arrived with the game.
const NETWORK_ABBREVIATIONS: Record<string, string> = {
  'acc network': 'ACCN',
  'acc network extra': 'ACCNX',
  'sec network': 'SECN',
  'sec network+': 'SECN+',
  'big ten network': 'BTN',
  'pac-12 network': 'PAC-12',
  'espn deportes': 'ESPN Dep.',
}

export function shortNetworkName(name: string): string {
  return NETWORK_ABBREVIATIONS[name.trim().toLowerCase()] ?? name.trim()
}

/**
 * Network running order for the Slate grid, best slate first.
 *
 * Rows used to be ordered by earliest kickoff, which is a fact about the
 * schedule rather than about what's worth watching: a noon game on a
 * streaming tier opened the day above an ABC night game. This is a fixed
 * editorial ranking instead — where a network sits never depends on when its
 * first game happens to start.
 *
 * The first ten are the running order the app's owner asked for. The rest are
 * ordered by how good their typical slate is, and anything not listed at all
 * falls between this list and the tail below, in kickoff order — an unknown
 * network gets no invented rank.
 */
const NETWORK_ORDER = [
  'ABC',
  'ESPN',
  'FOX',
  'NBC',
  'CBS',
  'FS1',
  'BTN',
  'SECN',
  'SECN+',
  'ESPNU',
  // Below here the ordering is ours.
  'ESPN2',
  'ACCN',
  'CBSSN',
  'THE CW',
  'CW',
  'TNT',
  'TBS',
  'TRUTV',
  'PEACOCK',
  'PARAMOUNT+',
  'FS2',
  'ESPNEWS',
  'ACCNX',
  'ESPN3',
]

/**
 * Networks pinned to the bottom, in this order, however early they kick off.
 * These are overflow tiers carrying many simultaneous lower-profile games, so
 * their rows stack several lanes tall (see layoutRow). Anywhere but last they
 * would push the marquee rows down the screen; at the bottom they can grow as
 * tall as they need to without displacing anything above them.
 */
const NETWORK_TAIL = ['UCONN+', 'ESPN+']

const UNRANKED = NETWORK_ORDER.length

/** Lower sorts higher. Unlisted networks all share one rank, so they keep
 * their kickoff ordering relative to each other. */
export function networkRank(name: string): number {
  const key = shortNetworkName(name).toUpperCase()
  const tail = NETWORK_TAIL.indexOf(key)
  if (tail !== -1) return UNRANKED + 1 + tail
  const ranked = NETWORK_ORDER.indexOf(key)
  return ranked === -1 ? UNRANKED : ranked
}
