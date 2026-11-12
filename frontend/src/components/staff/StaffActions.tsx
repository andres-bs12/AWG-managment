import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { formatEur } from '../../lib/money'
import styles from './StaffActions.module.css'

/** The tablet shell reserves a separate row for actions, so the scrollport never sits behind them. */
export function StaffActions({ total, totalLabel = 'Total', className = '', children }: { total: number | null; totalLabel?: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [docked, setDocked] = useState(false)
  const target = document.getElementById('staff-actions-root')
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => {
      const next = window.innerWidth < 1024 && element.offsetHeight < (window.visualViewport?.height ?? window.innerHeight) / 2
      setDocked(next)
      if (next) document.documentElement.style.setProperty('--staff-actions-height', `${element.offsetHeight}px`)
      else document.documentElement.style.removeProperty('--staff-actions-height')
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element); measure()
    window.visualViewport?.addEventListener('resize', measure)
    window.addEventListener('resize', measure)
    return () => { observer.disconnect(); window.visualViewport?.removeEventListener('resize', measure); window.removeEventListener('resize', measure); document.documentElement.style.removeProperty('--staff-actions-height') }
  }, [docked])
  const bar = <div ref={ref} data-staff-actions data-docked={docked} className={`${styles.bar} ${className}`}>
    <p className={styles.total}><span>{totalLabel}</span><strong>{total === null ? 'Price unavailable' : formatEur(total, 'en')}</strong></p>
    {children}
  </div>
  return docked && target ? createPortal(bar, target) : bar
}
