import type { FocusEvent } from 'react'

/** Keep focused controls and their rings clear of the document edges and sticky actions. */
export function keepFormFocusVisible(event: FocusEvent<HTMLElement>) {
  const target = event.target
  const form = event.currentTarget
  if (!(target instanceof HTMLElement) || target.tabIndex < 0) return
  requestAnimationFrame(() => {
    if (document.activeElement !== target) return
    const rect = target.getBoundingClientRect()
    const gap = parseFloat(getComputedStyle(form).getPropertyValue('--space-2'))
    const viewport = window.visualViewport
    let top = (viewport?.offsetTop ?? 0) + gap
    const preview = form.querySelector<HTMLElement>('[data-public-preview]')
    if (preview && !preview.contains(target) && getComputedStyle(preview).position === 'sticky') {
      const box = preview.getBoundingClientRect()
      if (rect.left < box.right && rect.right > box.left && box.top <= top && box.bottom > top) top = box.bottom + gap
    }
    let bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight) - gap
    const actions = form.querySelector<HTMLElement>('[data-sticky-actions]')
    if (actions && !actions.contains(target)) {
      const bar = actions.getBoundingClientRect()
      if (bar.top < bottom && bar.bottom >= bottom) bottom = bar.top - gap
    }
    const delta = rect.top < top ? rect.top - top : rect.bottom > bottom ? rect.bottom - bottom : 0
    if (delta) window.scrollBy({ top: delta, behavior: 'instant' })
  })
}
