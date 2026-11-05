import { useEffect, useId, useRef, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { OrderItem } from '../../domain/types'
import { Button } from '../ui/Button'
import styles from './CompleteOrderDialog.module.css'

type Props = {
  orderCode: string
  customerName: string
  items: OrderItem[]
  pendingItemId: string
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/** Mount only while open — mounting resets focus and body overflow. */
export function CompleteOrderDialog({
  orderCode,
  customerName,
  items,
  pendingItemId,
  busy,
  onClose,
  onConfirm,
}: Props) {
  const titleId = useId()
  const descId = useId()
  const cardRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => {
      const first = cardRef.current?.querySelector<HTMLElement>(FOCUSABLE)
      first?.focus()
    }, 0)
    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = overflow
      restoreRef.current?.focus?.()
    }
  }, [])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      if (!busy) onClose()
      return
    }
    if (event.key !== 'Tab') return
    const nodes = cardRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
    if (!nodes || nodes.length === 0) return
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const displayName = customerName || 'Customer details pending'

  return createPortal(
    <div className={styles.overlay} onKeyDown={onKeyDown}>
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Close"
        onClick={onClose}
        disabled={busy}
      />
      <div
        className={styles.card}
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        aria-busy={busy}
      >
        <h2 className={styles.title} id={titleId}>
          Complete order?
        </h2>
        <p className={styles.message} id={descId}>
          This is the last ornament in order {orderCode} ({displayName}). Marking it as finished
          sets the whole order to ready, and the customer sees it on the tracking page.
          Are you sure all items are ready?
        </p>
        {items.some(item => item.kind === 'custom' && (!item.formComplete || !item.petName || item.photos.length === 0)) ? <p role="alert">Some custom ornaments are missing form details or photos. Check them before marking the order ready.</p> : null}
        <ul className={styles.list}>
          {items.map(item => {
            const ready = item.productionStatus === 'finished' || item.id === pendingItemId
            const label = item.petName || (item.kind === 'custom' ? 'Custom ornament' : 'Finished ornament')
            return (
              <li key={item.id} className={styles.row} data-ready={ready}>
                <span className={styles.check} aria-hidden="true">{ready ? '✓' : '·'}</span>
                <span>{label}</span>
                <span className={styles.rowStatus}>{ready ? 'Ready' : 'Pending'}</span>
              </li>
            )
          })}
        </ul>
        <div className={styles.actions}>
          <Button tone="staff" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel / Keep working
          </Button>
          <Button tone="staff" variant="primary" onClick={onConfirm} disabled={busy}>
            Confirm &amp; mark ready
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
