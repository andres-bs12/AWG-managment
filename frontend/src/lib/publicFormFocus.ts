import type { FocusEvent } from 'react'
import { publicScroller } from './publicScroller.ts'

/** Keep the focused control and its ring inside the visible document viewport, clear of overlays. */
export function keepFormFocusVisible(event: FocusEvent<HTMLElement>) {
  const target = event.target
  const form = event.currentTarget
  if (!(target instanceof HTMLElement) || target.tabIndex < 0) return
  requestAnimationFrame(() => {
    if (document.activeElement !== target) return
    const rect = target.getBoundingClientRect()
    const gap = parseFloat(getComputedStyle(form).getPropertyValue('--space-2'))
    const viewport = window.visualViewport
    const viewportTop = viewport?.offsetTop ?? 0
    const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight)
    let top = viewportTop + gap
    let bottom = viewportBottom - gap
    const overlaps = (other: DOMRect) => rect.left < other.right && rect.right > other.left
    const preview = form.querySelector<HTMLElement>('[data-public-preview]')
    if (preview && !preview.contains(target) && getComputedStyle(preview).position === 'sticky') {
      const artwork = preview.getBoundingClientRect()
      if (overlaps(artwork) && artwork.top <= top && artwork.bottom > viewportTop) top = artwork.bottom + gap
    }
    const actions = form.querySelector<HTMLElement>('[data-sticky-actions]')
    if (actions && !actions.contains(target)) {
      const bar = actions.getBoundingClientRect()
      if (overlaps(bar) && bar.top < bottom && bar.bottom > top) bottom = bar.top - gap
    }
    const delta = rect.top < top ? rect.top - top : rect.bottom > bottom ? rect.bottom - bottom : 0
    if (delta) publicScroller().scrollBy({ top: delta, behavior: 'instant' })
  })
}
