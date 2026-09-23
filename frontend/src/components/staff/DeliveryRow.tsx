import { useNavigate } from 'react-router-dom'
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
    timeZone: 'UTC',
  })
}

type Props = {
  row: AgendaDelivery
  from: string
}

export function DeliveryRow({ row, from }: Props) {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      className={styles.dlv}
      onClick={() => navigate(`/staff/orders/${row.orderId}`, { state: { from } })}
    >
      {row.photoUrl ? (
        <img src={row.photoUrl} alt="" width={48} height={48} />
      ) : (
        <span className={styles.thumb} />
      )}
      <span className={styles.dlvBody}>
        <strong>
          {row.orderCode} · {row.title}
        </strong>
        <span>{deliveryStatusLabel(row)}</span>
      </span>
      <span className={styles.dlvAside}>
        <span>{row.methodLabel}</span>
        {row.timeLabel ? <span className={styles.dlvTime}>{row.timeLabel}</span> : null}
      </span>
    </button>
  )
}
