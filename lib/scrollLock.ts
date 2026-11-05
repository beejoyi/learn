/**
 * Freezing the page behind an overlay (the header's mobile menu, OverlayMenu's sheets, the command
 * palette). Several can be open at once in principle, so the holds are counted and only the last
 * one to be released gives scrolling back.
 */

let locks = 0;

/** Holds the page still; call the returned function once to release this hold. */
export function lockPageScroll(): () => void {
  locks += 1;
  if (locks === 1) document.body.style.overflow = "hidden";
  let released = false;
  return () => {
    // Guarded so a double release (React re-running a cleanup) cannot free another overlay's hold.
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks === 0) document.body.style.overflow = "";
  };
}
