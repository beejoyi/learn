/**
 * The header's search button and the command palette live in different trees — the button is in
 * TopBar, the palette is mounted once by the (app) layout — so they talk through a window event,
 * the same way OverlayMenu tells other overlays to close. Keeping the name here (and out of the
 * palette module) means TopBar does not have to import the palette to open it.
 */

export const SEARCH_EVENT = "learn-search-open";

/** Opens the command palette from anywhere on the page. */
export function openSearch(): void {
  window.dispatchEvent(new Event(SEARCH_EVENT));
}
