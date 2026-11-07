import { StaffText } from './StaffText'
import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'
import type { DatedDelivery } from '../../lib/staffDeliveries'
import { formatDateLabel } from '../../lib/time'
import { formatEur } from '../../lib/money'
import { deliveryStatusLabel } from './DeliveryRow'
import styles from './DeliveryOrderCard.module.css'

type Props = { row: DatedDelivery; from: string; routeMode: boolean; busy: boolean; activeIds: Set<string>; onToggle: (item: DatedDelivery, target: boolean) => void }

/** A cart owns its handover controls; partial handovers never split it into separate cards. */
export function DeliveryOrderCard({ row, from, routeMode, busy, activeIds, onToggle }: Props) {
  const items = row.members ?? [row]
  const itemDue = (item: DatedDelivery) => `${item.deliveryKind === 'vienna' ? 'Vienna' : 'Market'} · ${formatDateLabel(item.date)}${item.deliveryKind === 'market' && (item.timeLabel || item.marketHours) ? ` · ${item.timeLabel || item.marketHours}` : ''}`
  const dueDates = [...new Set(items.map(itemDue))]
  const delivery = items.find(item => item.deliveryKind === 'vienna')
  const address = delivery?.addressLabel
  return <article className={styles.card} aria-label={`Order ${row.orderCode}`}>
    <header className={styles.head}>
      <Link className={styles.order} to={`/staff/orders/${row.orderId}`} state={{ from }}>
        <strong>{row.customerName || 'Customer pending'}</strong>
        <span><StaffText>{`${row.orderCode}${row.source === 'web' ? ' · Web' : ''}`}</StaffText></span>
      </Link>
      {dueDates.length === 1 && <p className={styles.due}><StaffText>{dueDates[0]}</StaffText></p>}
    </header>
    {routeMode && <div className={styles.contact}>
      <strong>{address || 'Address pending'}</strong>
      <div>{delivery?.phone && <a href={`tel:${delivery.phone}`}>{delivery.phone}</a>}{address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">Map ↗</a>}</div>
    </div>}
    {row.remaining != null && row.remaining > 0 && <p className={styles.balance}>Collect {formatEur(row.remaining, 'en')}</p>}
    <ul className={styles.items}>
      {items.map(item => <li key={item.itemId} className={styles.item}>
        {item.photoUrl ? <img className={styles.photo} src={item.photoUrl} alt="" /> : item.color ? <span className={styles.swatch} style={{ background: `var(--ornament-${item.color})` }} role="img" aria-label={`${item.color} ornament`} /> : null}
        <div className={styles.identity}>
          <strong>{item.title || 'Ornament'}</strong>
          <span><StaffText>{[item.finish, item.backName ? `Name: ${item.backName}` : null, deliveryStatusLabel(item)].filter(Boolean).join(' · ')}</StaffText></span>
          {dueDates.length > 1 && <span className={styles.due}><StaffText>{itemDue(item)}</StaffText></span>}
          {!activeIds.has(item.itemId) && <span>Outside current filters</span>}
        </div>
        <Button tone="staff" variant="secondary" className={styles.handover} disabled={busy || !activeIds.has(item.itemId) || (!item.handedOver && item.productionStatus !== 'finished')} onClick={() => onToggle(item, !item.handedOver)} aria-label={`${item.handedOver ? 'Undo handover' : 'Hand over'} ${item.title || 'ornament'}`}>
          {item.handedOver ? 'Undo handover' : 'Hand over'}
        </Button>
      </li>)}
    </ul>
    {items.length > 1 && <Button tone="staff" variant="secondary" disabled={busy || (!row.handedOver && !items.some(item => activeIds.has(item.itemId) && !item.handedOver && item.productionStatus === 'finished'))} onClick={() => onToggle(row, !row.handedOver)}>{row.handedOver ? 'Undo order handover' : 'Hand over ready items'}</Button>}
  </article>
}
