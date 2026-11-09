import { useLayoutEffect, useRef } from 'react'

/** CSS owns sticky positioning; observe the card end and available reading room only. */
export function usePublicActions() {
  const ref = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const bar = ref.current
    const end = endRef.current
    const page = bar?.closest<HTMLElement>('[data-public-page]')
    if (!bar || !end || !page) return
    const root = document.documentElement
    const desktop = matchMedia('(min-width: 1024px)')
    const visualViewport = window.visualViewport
    let preview: HTMLElement | null = null
    let frame = 0
    let previousHeight = 0
    let previousTop = 0
    const measure = () => {
      const currentPreview = page.querySelector<HTMLElement>('[data-public-preview]')
      if (currentPreview !== preview) {
        if (preview) resize.unobserve(preview)
        preview = currentPreview
        if (preview) resize.observe(preview)
      }
      const css = getComputedStyle(page)
      const gap = parseFloat(css.getPropertyValue('--space-4'))
      const control = parseFloat(css.getPropertyValue('--size-control'))
      const height = visualViewport?.height ?? innerHeight
      const top = visualViewport?.offsetTop ?? 0
      const reserved = Math.ceil(bar.getBoundingClientRect().height)
      const keyboardOrZoom = height < innerHeight - control
      const sticky = !desktop.matches && !keyboardOrZoom && height - reserved - gap >= 3 * control
      const relaxed = !desktop.matches && (!sticky || height - reserved - gap - (preview?.offsetHeight ?? 0) < 3 * control)
      const clearance = `${sticky ? reserved : 0}px`
      const changed = bar.dataset.relaxedActions !== String(!sticky) || page.dataset.relaxedPreview !== String(relaxed)
        || root.style.getPropertyValue('--public-actions-height') !== clearance
        || height !== previousHeight || top !== previousTop
      previousHeight = height
      previousTop = top
      bar.dataset.relaxedActions = String(!sticky)
      page.dataset.relaxedPreview = String(relaxed)
      root.style.setProperty('--public-actions-height', clearance)
      page.style.setProperty('--public-sticky-top', `${!relaxed && !desktop.matches ? preview?.offsetHeight ?? 0 : 0}px`)
      // Resizing or opening the keyboard can move a sticky region over the current field.
      const active = document.activeElement
      if (changed && active instanceof HTMLElement && page.contains(active)) {
        requestAnimationFrame(() => {
          if (document.activeElement === active) active.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
        })
      }
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    // The marker stays at the card's natural bottom while the bar sticks to the viewport.
    const intersection = new IntersectionObserver(([entry]) => {
      bar.dataset.stuck = String(entry.boundingClientRect.bottom <= (entry.rootBounds?.bottom ?? innerHeight))
    }, { threshold: [0, 1] })
    intersection.observe(end)
    const resize = new ResizeObserver(schedule)
    resize.observe(bar)
    resize.observe(page)
    const content = new MutationObserver(schedule)
    content.observe(page, { childList: true, subtree: true })
    desktop.addEventListener('change', schedule)
    window.addEventListener('resize', schedule)
    visualViewport?.addEventListener('resize', schedule)
    visualViewport?.addEventListener('scroll', schedule)
    measure()
    return () => {
      cancelAnimationFrame(frame)
      intersection.disconnect()
      resize.disconnect()
      content.disconnect()
      desktop.removeEventListener('change', schedule)
      window.removeEventListener('resize', schedule)
      visualViewport?.removeEventListener('resize', schedule)
      visualViewport?.removeEventListener('scroll', schedule)
      root.style.removeProperty('--public-actions-height')
      page.style.removeProperty('--public-sticky-top')
      delete bar.dataset.stuck
      delete bar.dataset.relaxedActions
      delete page.dataset.relaxedPreview
    }
  }, [])
  return { ref, endRef }
}
