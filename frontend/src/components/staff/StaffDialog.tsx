import { useEffect, useId, useRef, type ReactNode } from 'react'
import styles from './CompleteOrderDialog.module.css'

/** Native modal owns focus trapping, background inertness and Escape. Mount while open. */
export function StaffDialog({ title, busy = false, onClose, children }: { title: string; busy?: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const dialog = ref.current
    dialog?.showModal()
    return () => { dialog?.close(); previous?.focus() }
  }, [])
  return <dialog data-staff-page ref={ref} className={styles.nativeDialog} aria-labelledby={titleId} aria-busy={busy} onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <h2 id={titleId}>{title}</h2>{children}
  </dialog>
}
