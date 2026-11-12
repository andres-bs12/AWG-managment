import { StaffText } from './StaffText'
import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'
import { ButtonLink } from '../ui/ButtonLink'
import type { MarketDay, OrderItem, ProductionStatus, TimeBlock } from '../../domain/types'
import { agendaSlotPath, handoffLabel, paintSlotLabel } from '../../lib/handoff'
import { formatEur } from '../../lib/money'
import { handoverBlocker } from '../../lib/deliveryFacts'
import styles from './OrderItemCard.module.css'

type Props = {
  item: OrderItem
  block?: TimeBlock
  days: MarketDay[]
  selected: boolean
  navigationState: { from?: string; itemId?: string } | undefined
  busy: boolean
  /** Online payment not confirmed: painting is possible but not the next step. */
  held?: boolean
  onHandover?: () => void
  onStatus: (status: ProductionStatus) => void
}

export function OrderItemCard({ item, block, days, selected, navigationState, busy, held = false, onHandover, onStatus }: Props) {
  const title = item.petName || (item.kind === 'custom' ? 'Custom ornament' : 'Finished ornament')
  const photo = item.photos[0]
  const paintTo = `/staff/orders/${item.orderId}/paint/${item.id}`
  const blocker = handoverBlocker({ kind: item.kind, productionStatus: item.productionStatus, handedOver: Boolean(item.handedOver),
    waitingForCustomer: item.kind === 'custom' && (!item.photos.length || (item.withName && !item.backName)) })
  const status = item.productionStatus === 'finished' ? 'Ready' : item.productionStatus === 'in_progress' ? 'Painting' : 'To paint'
  return (
    <article className={styles.card} data-selected={selected} aria-label={title}>
      <div className={styles.identity}>
        {photo ? <Link to={paintTo} state={navigationState} className={styles.photo} aria-label={`View ${title} reference`}><img src={photo.dataUrl} alt="" /></Link> : <div className={styles.placeholder} aria-hidden="true">✧</div>}
        <div className={styles.title}>
          <span className={styles.status} data-status={item.productionStatus}>{status}</span>
          <h3 title={title}>{title}</h3>
          <p><StaffText>{`${item.kind === 'custom' ? 'Personalised' : 'Ready-made'} · ${formatEur(item.cost, 'en')}`}</StaffText></p>
        </div>
      </div>
      <dl className={styles.specs}>
        {item.kind === 'custom' ? <div><dt>Colour</dt><dd>{item.color ? <><i className={styles.swatch} data-color={item.color} role="img" aria-label={`${item.color} colour`} />{item.finish ?? 'shiny'}</> : 'Not recorded'}</dd></div> : null}
        {item.withName ? <div><dt>Name to paint</dt><dd className={styles.name}>{item.backName || 'Waiting for form'}</dd></div> : null}
      </dl>
      {item.note ? <div className={styles.note}><strong>Painter’s note</strong><p>{item.note}</p></div> : null}
      <section className={styles.production} aria-label="Production"><h4>Production</h4>
      <div className={styles.actions}>
        {held ? <span className={styles.waiting}>Painting starts once the online payment is confirmed</span> : photo ? <ButtonLink to={paintTo} state={navigationState} tone="staff" variant={item.productionStatus === 'finished' || held ? 'secondary' : 'primary'}>{item.productionStatus === 'finished' ? 'View reference' : 'Open painting'}</ButtonLink> : <span className={styles.waiting}>{item.kind === 'custom' ? 'Waiting for reference photos' : 'No reference photo'}</span>}
        {block ? <Link className={styles.schedule} to={agendaSlotPath(block, days)}><StaffText>{paintSlotLabel(block, days)}</StaffText></Link> : null}
      </div>
      <details className={styles.adjust}>
        <summary>Adjust production status</summary>
        <div className={styles.statusOptions}>
          {([{value:'not_started',label:'To paint'}, {value:'in_progress',label:'Painting'}, {value:'finished',label:'Ready'}] as const).map(option => <Button key={option.value} tone="staff" variant="secondary" selected={item.productionStatus === option.value} disabled={busy} onClick={() => onStatus(option.value)}>{option.label}</Button>)}
        </div>
      </details>
      </section>
      <section className={styles.handover} aria-label="Handover">
        <div><h4>Handover</h4><p><StaffText>{handoffLabel(item, days)}</StaffText></p></div>
        {!item.handedOver && blocker ? <p className={styles.blocked}>{`Can't hand over yet: ${blocker.toLowerCase()}.`}</p> : null}
        {/* With one ornament the order panel owns the handover: one control, not two. */}
        {onHandover ? <Button tone="staff" variant="secondary" disabled={busy || held || (!item.handedOver && item.productionStatus !== 'finished')} onClick={onHandover}>{item.handedOver ? 'Undo handover' : 'Hand over this one'}</Button> : null}
      </section>
    </article>
  )
}
