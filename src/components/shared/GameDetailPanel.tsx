import { useEffect, useRef } from 'react'
import './GameDetailPanel.css'
import type { SafeGameEntry } from '../../hooks/useSpoilerSafeGames'
import { ExpandedGame } from '../scoreboard/ExpandedGame'
import { NetworkBadgeList } from './NetworkBadge'

/** How long, after opening a game, the panel keeps trying to bring itself to
 * the top while its content loads — and how close counts as arrived. The
 * tolerance covers the scroll-margin that keeps the panel clear of the phone
 * status bar. */
const SETTLE_MS = 3_000
const SETTLE_TOLERANCE_PX = 40

interface GameDetailPanelProps {
  entries: SafeGameEntry[]
  expandedGameId: string | null
  onClose: () => void
  zoneId: string
  /** Slate's TimeGrid has no outer horizontal padding of its own, so this
   * panel's default margin supplies the page-edge inset there. Scoreboard's
   * card grid already has that padding, so it passes this to avoid a
   * doubled-up inset (extra unused space on both sides). */
  flush?: boolean
}

/**
 * Renders the expanded game detail as its own section below a card/chip
 * grid — never by growing the individual card/chip itself. A CSS grid's row
 * and column tracks are shared across every item in it, so resizing one
 * item in place (rather than appending a separate section like this) warps
 * the layout of unrelated siblings.
 */
export function GameDetailPanel({ entries, expandedGameId, onClose, zoneId, flush }: GameDetailPanelProps) {
  const entry = entries.find((e) => e.game.id === expandedGameId)
  const ref = useRef<HTMLDivElement>(null)
  /** Which game this panel has already scrolled to. */
  const scrolledFor = useRef<string | null>(null)
  // Presence, not identity. `entry` is rebuilt from the feed on every poll,
  // so an effect depending on the object re-runs every few seconds; this only
  // changes when the panel appears or disappears.
  const hasEntry = entry !== undefined

  // Scrolls to the panel once per game opened — not once per update.
  //
  // Keying this on `entry` meant re-scrolling on every refresh. That was
  // invisible while the scoreboard wasn't actually polling; the moment it
  // began refreshing every five seconds, reading the box score became
  // impossible, because the page pulled itself back to the top of the panel
  // mid-scroll.
  //
  // The id alone can't be the dependency either: on the render where it
  // changes, the entry may not exist yet — its day's payload is still in
  // flight — and there would be nothing to scroll to. Hence the pair, plus
  // the ref, which is what actually holds this to once per game.
  useEffect(() => {
    if (!expandedGameId) {
      scrolledFor.current = null
      return
    }
    if (scrolledFor.current === expandedGameId) return
    const panel = ref.current
    if (!panel) return
    scrolledFor.current = expandedGameId

    // Read through the ref each time rather than closing over the element:
    // the panel unmounts and remounts whenever its entry briefly drops out of
    // a refreshed feed, and a held reference would be to a detached node.
    const scrollToPanel = () => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    scrollToPanel()

    // That first scroll usually can't do anything. The panel opens before its
    // box score and play-by-play have loaded, and until they arrive the
    // document is barely taller than the screen — there is nothing to scroll,
    // so the panel stays where it was, halfway down. Measured on a cold open:
    // a document 874px tall in an 874px viewport. A beat later the content
    // lands, the panel grows from 409px to 836px, and only then can it be
    // brought to the top.
    //
    // So it retries until the panel has actually arrived, rather than at
    // fixed offsets — how long the summary takes is not worth guessing at,
    // and a retry that lands before the content does is wasted. The loop owns
    // itself: no cleanup returned from this effect, no teardown in a ref.
    // Both were tried and both killed it, because the effect re-runs whenever
    // the entry comes and goes and React invokes cleanups an extra time on
    // mount in development, so either teardown fired seconds before the
    // content it was waiting for arrived. A ResizeObserver — the tidier way
    // to hear about the growth — dies for a related reason: the remount
    // detaches the node it was watching and it never fires again.
    //
    // It ends when the panel reaches the top, when the panel goes away, or at
    // the deadline, which is what keeps it from becoming the bug above: a
    // live play-by-play grows this panel all game long, and a page that
    // re-centres itself while someone is reading is the whole complaint.
    const deadline = Date.now() + SETTLE_MS
    const settling = window.setInterval(() => {
      const panel = ref.current
      if (!panel || Math.abs(panel.getBoundingClientRect().top) <= SETTLE_TOLERANCE_PX || Date.now() > deadline) {
        clearInterval(settling)
        return
      }
      scrollToPanel()
    }, 200)
  }, [expandedGameId, hasEntry])

  if (!entry) return null

  return (
    <div className={`game-detail-panel${flush ? ' game-detail-panel--flush' : ''}`} ref={ref}>
      {/* Where you're watching it, opposite the way out. Read from the
          sanitized view rather than the raw game — the network is not a
          spoiler, but nothing outside the gate should reach for rawGame. */}
      <div className="game-detail-panel__header">
        <NetworkBadgeList networks={entry.game.broadcasts} />
        <button type="button" className="game-detail-panel__close" onClick={onClose}>
          Close ×
        </button>
      </div>
      <ExpandedGame game={entry.rawGame} zoneId={zoneId} isProtected={entry.isProtected} isDelayed={entry.isDelayed} />
    </div>
  )
}
