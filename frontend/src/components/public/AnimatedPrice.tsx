import { useEffect, useRef, useState } from 'react'
import { formatEur } from '../../lib/money'

export function AnimatedPrice({ value, locale }: { value: number; locale: 'de' | 'en' }) {
  const [display, setDisplay] = useState(value)
  const current = useRef(value)
  useEffect(() => {
    const start = current.current
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      current.current = value
      setDisplay(value)
      return
    }
    let frame = 0
    const started = performance.now()
    function tick(now: number) {
      const progress = Math.min((now - started) / 300, 1)
      current.current = start + (value - start) * progress
      setDisplay(current.current)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return <span><span className="visually-hidden">{formatEur(value, locale)}</span><span aria-hidden="true">{formatEur(display, locale)}</span></span>
}
