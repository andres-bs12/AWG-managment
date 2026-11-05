import { formatEur } from '../../lib/money'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import type { AgendaDay, AgendaDelivery, ProductionStatus } from '../../domain/types'
import styles from './DeliveryRow.module.css'

export function prodLabel(status: ProductionStatus): string {
  if (status === 'in_progress') return 'Started'
  if (status === 'finished') return 'Finished'
  return 'Not started'
}

export function deliveryStatusLabel(
  row: Pick<AgendaDelivery, 'productionStatus' | 'handedOver' | 'deliveryKind'>,
): string {
  if (row.handedOver) return row.deliveryKind === 'vienna' ? 'Delivered' : 'Handed over'
  if (row.productionStatus === 'finished') {
    return row.deliveryKind === 'vienna' ? 'Ready for delivery' : 'Ready to pick up'
  }
  return prodLabel(row.productionStatus)
}

export function dayChipLabel(day: AgendaDay): string {
  const [y, m, d] = day.marketDay.date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

type Props = {
  row: AgendaDelivery
  from: string
}

export function DeliveryRow({ row, from }: Props) {
  const navigate = useNavigate()
  const [photoFailed, setPhotoFailed] = useState(false)

  return (
    <button
      type="button"
      className={styles.dlv}
      onClick={() => navigate(`/staff/orders/${row.orderId}`, { state: { from } })}
    >
      {row.photoUrl && !photoFailed ? (
        <img src={row.photoUrl} alt="" width={48} height={48} onError={() => setPhotoFailed(true)} />
      ) : (
        <span className={styles.thumb} />
      )}
      <span className={styles.dlvBody}>
        <strong>
          {row.orderCode} · {row.title}
        </strong>
        <span>{[row.customerName, row.color, row.finish, deliveryStatusLabel(row)].filter(Boolean).join(' · ')}</span>
      </span>
      <span className={styles.dlvAside}>
<span>{row.methodLabel}</span>
        {row.remaining != null && row.remaining > 0 && <strong>Collect {formatEur(row.remaining, 'en')}</strong>}
        {row.timeLabel ? <span className={styles.dlvTime}>{row.timeLabel}</span> : null}
      </span>
    </button>
  )
}
