import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import styles from './HelpTip.module.css'

/** Inline help disclosure shared by public constraints. It never depends on hover. */
export function HelpTip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId()
  const root = useRef<HTMLSpanElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      trigger.current?.focus()
    }
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('keydown', escape)
    document.addEventListener('pointerdown', outside)
    return () => { document.removeEventListener('keydown', escape); document.removeEventListener('pointerdown', outside) }
  }, [open])
  return <span ref={root} className={styles.root}>
    <button ref={trigger} type="button" className={styles.trigger} aria-label={label} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-10h.01" />
      </svg>
    </button>
    <span id={id} className={styles.panel} hidden={!open}>{children}</span>
  </span>
}
