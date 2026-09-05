import { useEffect, useRef } from 'react'

/** Marks a card or chip so the collapse scroll below can find it. */
export const GAME_ANCHOR_ATTR = 'data-game-id'

/**
 * Scrolls the collapsed card back into view when its expanded detail closes.
 *
 * Opening a game scrolls the detail panel to the top of the screen, and the
 * panel is tall — taller than the viewport for a game with play-by-play. So
 * by the time you close it you are well below where the card sits, and
 * closing left the scroll position untouched: the card you were just looking
 * at was somewhere off the top of the screen, and you had to scroll up to
 * find it again.
 *
 * The lookup goes through the DOM rather than a ref because the card lives in
 * a different subtree from the screen that owns the expanded id — on
 * Scoreboard the panel is a sibling inserted after the card's grid row, and
 * on Slate the chip is inside the scrolling time grid. Threading refs up out
 * of both would be more plumbing than the one query this needs.
 *
 * `block: 'nearest'` scrolls the minimum required, so closing a card that is
 * already on screen doesn't move the page at all; `inline: 'nearest'` keeps
 * Slate's horizontally scrolling grid from sliding sideways as well.
 */
export function useScrollToCollapsedGame(expandedGameId: string | null): void {
  const previousId = useRef(expandedGameId)

  useEffect(() => {
    const closedId = previousId.current
    previousId.current = expandedGameId

    // Only on a close. Switching straight from one game to another leaves the
    // detail panel open, and it scrolls itself into view — pulling the page
    // back to the previous card first would fight that.
    if (expandedGameId !== null || closedId === null) return

    // Runs after the commit that removed the panel, so the page has already
    // shrunk back and these offsets are the final ones.
    document
      .querySelector(`[${GAME_ANCHOR_ATTR}="${CSS.escape(closedId)}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [expandedGameId])
}
