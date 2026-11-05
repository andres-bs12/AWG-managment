import type { FocusEvent } from 'react'

/** Keep the focused control and its focus ring clear of the public scroll viewport and action bar. */
export function keepFormFocusVisible(event: FocusEvent<HTMLElement>) {
  const target = event.target
  const form = event.currentTarget
  if (!(target instanceof HTMLElement) || target.tabIndex < 0 || target.closest('[data-sticky-actions][data-docked="true"]')) return
  requestAnimationFrame(() => {
    if (document.activeElement !== target) return
    // The public shell is the vertical scroller. A horizontally scrolling ancestor (e.g. the item tabs)
    // also computes overflow-y:auto, so it must not be mistaken for it.
    let scroller = target.closest<HTMLElement>('[data-public-scroll]') ?? target.parentElement
    while (scroller && !scroller.hasAttribute('data-public-scroll') && !(/(auto|scroll)/.test(getComputedStyle(scroller).overflowY) && scroller.scrollHeight > scroller.clientHeight)) scroller = scroller.parentElement
    const rect = target.getBoundingClientRect()
    const viewport = scroller?.getBoundingClientRect()
    const gap = parseFloat(getComputedStyle(form).getPropertyValue('--space-2'))
    const top = Math.max(0, viewport?.top ?? 0) + gap
    let bottom = Math.min(window.innerHeight, viewport?.bottom ?? window.innerHeight) - gap
    const actions = form.querySelector<HTMLElement>('[data-sticky-actions]')
    if (actions && !actions.contains(target)) {
      const bar = actions.getBoundingClientRect()
      if (bar.top < bottom && bar.bottom >= bottom) bottom = bar.top - gap
    }
    const delta = rect.top < top ? rect.top - top : rect.bottom > bottom ? rect.bottom - bottom : 0
    if (delta) (scroller ?? window).scrollBy({ top: delta, behavior: 'instant' })
  })
}
