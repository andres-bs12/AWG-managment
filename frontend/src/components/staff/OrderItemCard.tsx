import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'
import { ButtonLink } from '../ui/ButtonLink'
import type { MarketDay, OrderItem, ProductionStatus, TimeBlock } from '../../domain/types'
import { agendaSlotPath, handoffLabel, paintSlotLabel } from '../../lib/handoff'
import { formatEur } from '../../lib/money'
import styles from './OrderItemCard.module.css'

type Props = {
  item: OrderItem
  block?: TimeBlock
  days: MarketDay[]
  selected: boolean
  showHandoff: boolean
  navigationState: { from?: string; itemId?: string } | undefined
  busy: boolean
  onStatus: (status: ProductionStatus) => void
}

export function OrderItemCard({ item, block, days, selected, showHandoff, navigationState, busy, onStatus }: Props) {
  const title = item.petName || (item.kind === 'custom' ? 'Custom ornament' : 'Finished ornament')
  const photo = item.photos[0]
  const paintTo = `/staff/orders/${item.orderId}/paint/${item.id}`
  const status = item.productionStatus === 'finished' ? 'Ready' : item.productionStatus === 'in_progress' ? 'Painting' : 'To paint'
  return (
    <article className={styles.card} data-selected={selected} aria-label={title}>
      <div className={styles.identity}>
        {photo ? <Link to={paintTo} state={navigationState} className={styles.photo} aria-label={`View ${title} reference`}><img src={photo.dataUrl} alt="" /></Link> : <div className={styles.placeholder} aria-hidden="true">✧</div>}
        <div className={styles.title}>
          <span className={styles.status} data-status={item.productionStatus}>{status}</span>
          <h3>{title}</h3>
          <p>{item.kind === 'custom' ? 'Custom ornament' : 'Ready-made'} · {formatEur(item.cost)}</p>
        </div>
      </div>
      <dl className={styles.specs}>
        {item.kind === 'custom' ? <div><dt>Colour</dt><dd>{item.color ? <><i className={styles.swatch} data-color={item.color} aria-hidden="true" />{item.color === 'red' ? 'Red' : 'Grey'}</> : 'Not recorded'}</dd></div> : null}
        {item.withName ? <div><dt>Name to paint</dt><dd className={styles.name}>{item.backName || 'Waiting for form'}</dd></div> : null}
        {showHandoff ? <div><dt>{item.delivery.kind === 'vienna' ? 'Delivery' : 'Pickup'}</dt><dd>{handoffLabel(item, days)}</dd></div> : null}
      </dl>
      {item.note ? <div className={styles.note}><strong>Painter’s note</strong><p>{item.note}</p></div> : null}
      <div className={styles.actions}>
        {photo ? <ButtonLink to={paintTo} state={navigationState} tone="staff" variant={item.productionStatus === 'finished' ? 'secondary' : 'primary'}>{item.productionStatus === 'finished' ? 'View reference' : 'Open painting'}</ButtonLink> : <span className={styles.waiting}>{item.kind === 'custom' ? 'Waiting for reference photos' : 'No reference photo'}</span>}
        {block ? <Link className={styles.schedule} to={agendaSlotPath(block, days)}>{paintSlotLabel(block, days)}</Link> : null}
      </div>
      <details className={styles.adjust}>
        <summary>Adjust production status</summary>
        <div className={styles.statusOptions}>
          {([{value:'not_started',label:'To paint'}, {value:'in_progress',label:'Painting'}, {value:'finished',label:'Ready'}] as const).map(option => <Button key={option.value} tone="staff" variant="secondary" selected={item.productionStatus === option.value} disabled={busy || item.productionStatus === option.value} onClick={() => onStatus(option.value)}>{option.label}</Button>)}
        </div>
      </details>
    </article>
  )
}
