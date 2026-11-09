/** Public routes use the browser's native document scrollport. */
export function publicScroller() {
  return document.scrollingElement ?? document.documentElement
}
