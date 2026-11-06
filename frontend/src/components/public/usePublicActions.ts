import { useLayoutEffect, useRef } from 'react'

/**
 * Dock actions outside the scrollport so even unfocused targets cannot sit underneath them.
 * The docked bar spans the card's full width and continues it; once the end of the card scrolls
 * into view the bar returns to the flow as the card's last row ("stuck"), so it merges with the
 * card's bottom edge instead of floating as a pill inside a pill. The switch keeps every content
 * position: the scrollport grows by exactly the height the bar now takes in the flow.
 */
export function usePublicActions() {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const bar = ref.current
    const page = bar?.closest<HTMLElement>('[data-public-page]')
    const shell = bar?.closest<HTMLElement>('[data-public-scroll]')
    if (!bar || !page || !shell) return
    const desktop = matchMedia('(min-width: 1024px)')
    const visualViewport = window.visualViewport
    let frame = 0
    const reset = () => {
      delete bar.dataset.docked
      delete bar.dataset.stuck
      delete shell.dataset.dockedActions
      shell.style.removeProperty('--public-sticky-bottom')
    }
    const measure = () => {
      const css = getComputedStyle(page)
      const gap = parseFloat(css.getPropertyValue('--space-4'))
      const control = parseFloat(css.getPropertyValue('--size-control'))
      const height = visualViewport?.height ?? innerHeight
      const keyboardOrZoom = height < innerHeight - control
      if (desktop.matches) {
        reset()
        delete page.dataset.relaxedPreview
        return
      }
      const rect = page.getBoundingClientRect()
      bar.style.setProperty('--public-actions-left', `${rect.left}px`)
      bar.style.setProperty('--public-actions-width', `${rect.width}px`)
      const wasStuck = bar.dataset.stuck === 'true'
      bar.dataset.docked = 'true'
      const barRect = bar.getBoundingClientRect()
      const reserved = Math.ceil(barRect.height)
      // Where the bar's slot starts at the end of the card, measured the same way in both states.
      const slotGap = parseFloat(css.getPropertyValue('--space-5'))
      const contentEnd = wasStuck ? barRect.top - slotGap : rect.bottom - parseFloat(css.paddingBottom)
      // A short viewport or the virtual keyboard needs reading room before sticky regions.
      const dock = !keyboardOrZoom && height - reserved - gap >= 3 * control
      const preview = page.querySelector<HTMLElement>('[data-public-preview]')
      page.dataset.relaxedPreview = String(!dock || height - reserved - gap - (preview?.offsetHeight ?? 0) < 3 * control)
      const stuck = dock && contentEnd + slotGap + reserved <= innerHeight
      // Switching between docked and stuck resizes the scrollport. A focused control was placed for
      // the previous geometry, so ask the page's focus repair (onFocus handlers) to place it again.
      if (stuck !== wasStuck) {
        const active = document.activeElement
        if (active instanceof HTMLElement && page.contains(active) && !bar.contains(active)) requestAnimationFrame(() => active.dispatchEvent(new FocusEvent('focusin', { bubbles: true })))
      }
      if (dock && stuck) {
        bar.dataset.stuck = 'true'
        shell.style.removeProperty('--public-sticky-bottom')
        delete shell.dataset.dockedActions
      } else if (dock) {
        delete bar.dataset.stuck
        shell.style.setProperty('--public-sticky-bottom', `${reserved}px`)
        shell.dataset.dockedActions = 'true'
      } else reset()
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    const resize = new ResizeObserver(schedule)
    resize.observe(bar)
    resize.observe(page)
    const content = new MutationObserver(schedule)
    content.observe(page, { childList: true, subtree: true })
    shell.addEventListener('scroll', schedule, { passive: true })
    desktop.addEventListener('change', schedule)
    window.addEventListener('resize', schedule)
    visualViewport?.addEventListener('resize', schedule)
    measure()
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      content.disconnect()
      shell.removeEventListener('scroll', schedule)
      desktop.removeEventListener('change', schedule)
      window.removeEventListener('resize', schedule)
      visualViewport?.removeEventListener('resize', schedule)
      reset()
      delete page.dataset.relaxedPreview
    }
  }, [])
  return ref
}
