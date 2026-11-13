import { useEffect, useId, useRef, type ReactNode } from 'react'
import styles from './CompleteOrderDialog.module.css'

/**
 * Native modal owns focus trapping and background inertness. Mount while open.
 * Closing never changes data, so it is always one tap away: the X in the corner, Escape or a tap
 * on the backdrop. `preventEscape` keeps typed input safe from a stray Escape/backdrop tap; the X
 * still closes. Nothing closes while `busy`.
 */
export function StaffDialog({ title, busy = false, onClose, children, preventEscape = false }: { title: string; busy?: boolean; onClose: () => void; children: ReactNode; preventEscape?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const dialog = ref.current
    dialog?.showModal()
    return () => { dialog?.close(); previous?.focus() }
  }, [])
  return <dialog data-staff-page ref={ref} className={styles.nativeDialog} aria-labelledby={titleId} aria-busy={busy}
    onCancel={event => { event.preventDefault(); if (!busy && !preventEscape) onClose() }}
    // A click whose target is the <dialog> itself landed on the backdrop (content sits in children).
    onClick={event => { if (event.target === event.currentTarget && !busy && !preventEscape) onClose() }}>
    <div className={styles.header}>
      <h2 id={titleId}>{title}</h2>
      <button type="button" className={styles.close} aria-label="Close" disabled={busy} onClick={onClose}>
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" /></svg>
      </button>
    </div>
    {children}
  </dialog>
}
