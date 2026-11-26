import { useState } from 'react'
import { sizeShort } from '../../lib/ornamentSize'
import { StaffText } from './StaffText'
import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import type { DatedDelivery } from '../../lib/staffDeliveries'
import { formatDateLabel } from '../../lib/time'
import { formatEur } from '../../lib/money'
import { formatStaffShortDate, TRACKING_NUMBER_REGEX } from '../../lib/postShipping'
import { deliveryStatusLabel } from './DeliveryRow'
import { customerLabel, handoverBlocker, ornamentLabel, paymentLine, productionLabel, viennaDistrict } from '../../lib/deliveryFacts'
import styles from './DeliveryOrderCard.module.css'

type Props = {
  row: DatedDelivery
  from: string
  routeMode: boolean
  busy: boolean
  activeIds: Set<string>
  hideDueDate?: boolean
  onToggle: (item: DatedDelivery, target: boolean) => void
  onHandToPost?: (row: DatedDelivery, trackingNumber: string) => void
}

/** A cart owns its handover controls; partial handovers never split it into separate cards. */
export function DeliveryOrderCard({ row, from, routeMode, busy, activeIds, hideDueDate = false, onToggle, onHandToPost }: Props) {
  const [tracking, setTracking] = useState('')
  const [trackingError, setTrackingError] = useState('')
  const [addressCopied, setAddressCopied] = useState(false)
  const items = row.members ?? [row]
  const itemDue = (item: DatedDelivery) => {
    if (item.deliveryKind === 'post') return `Post · ${formatStaffShortDate(item.date)}`
    if (item.deliveryKind === 'vienna') {
      return ['Vienna delivery', viennaDistrict(item.postalCode), formatDateLabel(item.date)].filter(Boolean).join(' · ')
    }
    return `${item.marketName ?? 'Market pickup'} · ${formatDateLabel(item.date)}${item.timeLabel || item.marketHours ? ` · ${item.timeLabel || item.marketHours}` : ''}`
  }
  const dueDates = [...new Set(items.map(itemDue))]
  const postItems = items.filter(item => item.deliveryKind === 'post')
  const isPostOrder = postItems.length > 0 && postItems.length === items.length
  const viennaDelivery = items.find(item => item.deliveryKind === 'vienna')
  const postDelivery = postItems[0]
  const address = postDelivery?.addressLabel ?? viennaDelivery?.addressLabel ?? null
  const payment = paymentLine(row, amount => formatEur(amount, 'en'))
  const allPostFinished = postItems.length > 0 && postItems.every(item => item.productionStatus === 'finished')
  const allPostHandedOver = postItems.length > 0 && postItems.every(item => item.handedOver)
  const canHandToPost = allPostFinished && !allPostHandedOver && postItems.some(item => activeIds.has(item.itemId))
  const trimmedTracking = tracking.trim()
  const trackingInvalid = Boolean(trimmedTracking && !TRACKING_NUMBER_REGEX.test(trimmedTracking))

  function copyAddress() {
    if (!address) return
    const text = [row.customerName && row.customerName !== 'Walk-in' ? row.customerName : '', address.replace(/ · /g, '\n')].filter(Boolean).join('\n')
    void navigator.clipboard.writeText(text).then(() => setAddressCopied(true)).catch(() => setAddressCopied(false))
  }

  function submitPostHandover() {
    if (trackingInvalid) {
      setTrackingError('Enter 8–40 letters or digits.')
      return
    }
    setTrackingError('')
    if (onHandToPost) onHandToPost(row, trimmedTracking)
    else onToggle(row, true)
  }

  return <article className={styles.card} aria-label={`Order ${row.orderCode}`}>
    <header className={styles.head}>
      <Link className={styles.order} to={`/staff/orders/${row.orderId}`} state={{ from }}>
        <strong>{customerLabel(row.customerName)}</strong>
        <span><StaffText>{`${row.orderCode}${row.source === 'web' ? ' · Web' : ''}`}</StaffText></span>
      </Link>
      {!hideDueDate && dueDates.length === 1 && <p className={styles.due}><StaffText>{dueDates[0]}</StaffText></p>}
    </header>
    {postDelivery ? (
      <div className={styles.postAddress}>
        <span className={styles.addressText}>{address || 'Address not given yet'}</span>
        {address && (
          <Button tone="staff" variant="secondary" onClick={copyAddress}>
            {addressCopied ? 'Address copied' : 'Copy address'}
          </Button>
        )}
      </div>
    ) : viennaDelivery ? (
      <div className={styles.contact}>
        <span>{address || 'Address not given yet'}</span>
        {routeMode && <div>{viennaDelivery.phone && <a href={`tel:${viennaDelivery.phone}`}>{viennaDelivery.phone}</a>}{address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">Map ↗</a>}</div>}
      </div>
    ) : null}
    {payment && <p className={payment.due ? styles.balance : styles.paid}><StaffText>{payment.text}</StaffText></p>}
    <ul className={styles.items}>
      {items.map(item => <li key={item.itemId} className={styles.item}>
        {item.photoUrl ? <img className={styles.photo} src={item.photoUrl} alt="" /> : item.color ? <span className={styles.swatch} style={{ background: `var(--ornament-${item.color})` }} role="img" aria-label={`${item.color} ornament`} /> : null}
        <div className={styles.identity}>
          <strong>{ornamentLabel(item)}</strong>
          <span className={styles.facts}>
            <span><StaffText>{`Production: ${[item.kind === 'custom' && item.color ? [item.size ? sizeShort(item.size) : '', item.color, item.finish ?? ''].filter(Boolean).join(' ') : null, productionLabel(item)].filter(Boolean).join(' · ')}`}</StaffText></span>
            <span data-blocked={Boolean(handoverBlocker(item)) || undefined}><StaffText>{`Handover: ${handoverBlocker(item) ? `not yet · ${handoverBlocker(item)}` : deliveryStatusLabel(item)}`}</StaffText></span>
          </span>
          {dueDates.length > 1 && <span className={styles.due}><StaffText>{itemDue(item)}</StaffText></span>}
          {!activeIds.has(item.itemId) && <span>Outside current filters</span>}
        </div>
        {!isPostOrder && (
          <Button tone="staff" variant="secondary" className={styles.handover} disabled={busy || !activeIds.has(item.itemId) || (!item.handedOver && (item.productionStatus !== 'finished' || (item.deliveryKind === 'post' && !allPostFinished)))} onClick={() => onToggle(item, !item.handedOver)} aria-label={`${item.handedOver ? 'Undo handover' : 'Hand over'} ${ornamentLabel(item)}`}>
            {item.handedOver ? 'Undo handover' : 'Hand over'}
          </Button>
        )}
      </li>)}
    </ul>
    {isPostOrder ? (
      <div className={styles.postActions}>
        {!allPostHandedOver && (
          <Field
            label="Tracking number (optional)"
            htmlFor={`tracking-${row.orderId}`}
            error={trackingError || (trackingInvalid ? 'Enter 8–40 letters or digits.' : undefined)}
          >
            <input
              id={`tracking-${row.orderId}`}
              value={tracking}
              autoComplete="off"
              disabled={busy || !canHandToPost}
              onChange={event => { setTracking(event.target.value); setTrackingError('') }}
            />
          </Field>
        )}
        {allPostHandedOver ? (
          <Button tone="staff" variant="secondary" disabled={busy || !postItems.some(item => activeIds.has(item.itemId))} onClick={() => onToggle(row, false)}>
            Undo handover
          </Button>
        ) : (
          <Button tone="staff" size="lg" disabled={busy || !canHandToPost || trackingInvalid} onClick={submitPostHandover}>
            Handed to Post
          </Button>
        )}
      </div>
    ) : items.length > 1 ? (
      <Button tone="staff" variant="secondary" disabled={busy || (!row.handedOver && !items.some(item => activeIds.has(item.itemId) && !item.handedOver && item.productionStatus === 'finished' && (item.deliveryKind !== 'post' || allPostFinished)))} onClick={() => onToggle(row, !row.handedOver)}>{row.handedOver ? 'Undo order handover' : 'Hand over ready items'}</Button>
    ) : null}
  </article>
}
