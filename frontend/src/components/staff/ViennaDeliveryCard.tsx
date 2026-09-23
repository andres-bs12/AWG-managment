import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'
import type { AgendaDelivery } from '../../domain/types'
import { deliveryStatusLabel } from './DeliveryRow'
import styles from './ViennaDeliveryCard.module.css'

type Props = {
  row: AgendaDelivery
  from: string
  busy?: boolean
  onToggle: (orderId: string, handedOver: boolean) => void
}

export function ViennaDeliveryCard({ row, from, busy, onToggle }: Props) {
  const canHandOver = row.productionStatus === 'finished' || row.handedOver

  return (
    <article className={styles.card}>
      {row.photoUrl ? <img src={row.photoUrl} alt="" width={56} height={56} /> : <span className={styles.thumb} />}
      <div className={styles.body}>
        <div className={styles.head}>
          <h3>
            {row.addressLabel ?? 'Address pending'}
          </h3>
          <span className={styles.status}>{deliveryStatusLabel(row)}</span>
        </div>
        <p className={styles.customer}><strong>{row.customerName || 'Customer pending'}</strong><span>{row.orderCode}</span></p>
        <p className={styles.item}>{[row.title, row.color, row.backName ? `Name: ${row.backName}` : null].filter(Boolean).join(' · ')}</p>
        <div className={styles.quickLinks}>
          {row.phone ? (
            <a href={`tel:${row.phone}`}>{row.phone}</a>
          ) : (
            <span className={styles.missing}>No phone yet</span>
          )}
          {row.addressLabel ? <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row.addressLabel)}`} target="_blank" rel="noreferrer">Map ↗</a> : null}
        </div>
        <div className={styles.actions}>
          <Button
            tone="staff"
            variant={row.handedOver ? 'secondary' : 'primary'}
            disabled={busy || !canHandOver}
            onClick={() => onToggle(row.orderId, !row.handedOver)}
          >
            {row.handedOver ? 'Undo delivery' : 'Mark delivered'}
          </Button>
          <Link className={styles.orderLink} to={`/staff/orders/${row.orderId}`} state={{ from }}>
            Order
          </Link>
        </div>
        {canHandOver ? null : <p className={styles.note}>Finish before handoff.</p>}
      </div>
    </article>
  )
}
