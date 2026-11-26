import { useEffect, useRef, useState } from 'react'
import { sizeLabel } from '../../lib/ornamentSize'
import { StaffText } from './StaffText'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { seedMarketPhoto } from '../../api/marketStockPhotos'
import { Button } from '../ui/Button'
import { ButtonLink } from '../ui/ButtonLink'
import { marketOrnamentLabel, marketOrnamentParts } from '../../domain/marketStock'
import type { MarketDay, OrderItem, ProductionStatus, TimeBlock } from '../../domain/types'
import { agendaSlotPath, handoffArrivalLabel, handoffLabel, paintSlotLabel } from '../../lib/handoff'
import { formatEur } from '../../lib/money'
import { handoverBlocker } from '../../lib/deliveryFacts'
import { colorLabel, finishLabel } from '../../lib/stats'
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
  /** The whole order is handed over: show only what still matters (no production or handover controls). */
  orderDone?: boolean
  onHandover?: () => void
  onStatus: (status: ProductionStatus) => void
}

export function OrderItemCard({ item, block, days, selected, navigationState, busy, held = false, orderDone = false, onHandover, onStatus }: Props) {
  const marketId = item.kind === 'finished' ? item.marketOrnamentId : null
  const marketParts = marketId ? marketOrnamentParts(marketId) : null
  const title = marketId
    ? marketOrnamentLabel(marketId)
    : item.petName || (item.kind === 'custom' ? 'Custom ornament' : 'Finished ornament')
  const photo = item.photos[0]
  const paintTo = `/staff/orders/${item.orderId}/paint/${item.id}`
  const blocker = handoverBlocker({ kind: item.kind, productionStatus: item.productionStatus, handedOver: Boolean(item.handedOver),
    waitingForCustomer: item.kind === 'custom' && (!item.photos.length || (item.withName && !item.backName)) })
  const status = item.handedOver ? 'Handed over' : item.productionStatus === 'finished' ? 'Ready' : item.productionStatus === 'in_progress' ? 'Painting' : 'To paint'
  return (
    <article className={styles.card} data-selected={selected} aria-label={title}>
      <div className={styles.identity}>
        {marketId ? (
          <MarketItemPhoto id={marketId} />
        ) : photo ? (
          <Link to={paintTo} state={navigationState} className={styles.photo} aria-label={`View ${title} reference`}><img src={photo.dataUrl} alt="" /></Link>
        ) : (
          <div className={styles.placeholder} aria-hidden="true">✧</div>
        )}
        <div className={styles.title}>
          <span className={styles.status} data-status={item.productionStatus}>{status}</span>
          {marketId ? (
            <>
              <h3 className={styles.marketCode} title={title} aria-label={title}>{marketId}</h3>
              {marketParts ? (
                <p className={styles.marketSpec}>
                  <span className={styles.marketSwatch} style={{ background: marketParts.color.swatch }} aria-hidden="true" />
                  <StaffText>{`${marketParts.color.label} · ${marketParts.finish.code}`}</StaffText>
                </p>
              ) : null}
            </>
          ) : (
            <h3 title={title}><StaffText>{title}</StaffText></h3>
          )}
          <p><StaffText>{[item.kind === 'custom' ? 'Personalised' : 'Ready-made', item.kind === 'custom' && item.size ? sizeLabel(item.size) : null, formatEur(item.cost, 'en')].filter(Boolean).join(' · ')}</StaffText></p>
        </div>
      </div>
      {/* No empty block: a ready-made piece without a name has no specs, so nothing (and no gap) is rendered. */}
      {item.kind === 'custom' || item.withName ? <dl className={styles.specs}>
        {item.kind === 'custom' ? <div><dt>Colour</dt><dd>{item.color ? <><i className={styles.swatch} data-color={item.color} role="img" aria-hidden="true" />{`${colorLabel(item.color)} · ${finishLabel(item.finish ?? 'shiny')}`}</> : 'Not recorded'}</dd></div> : null}
        {item.withName ? <div><dt>Name to paint</dt><dd className={styles.name}>{item.backName || 'Waiting for form'}</dd></div> : null}
      </dl> : null}
      {item.note ? <div className={styles.note}><strong>Painter’s note</strong><p>{item.note}</p></div> : null}
      {orderDone ? (
        // Finished order: production and handover are history. Only a personalised piece keeps a link to its reference.
        photo && !marketId ? <div className={styles.actions}><ButtonLink to={paintTo} state={navigationState} tone="staff" variant="secondary">View reference</ButtonLink></div> : null
      ) : <>
      {/* Ready-made pieces are already painted: no reference photo, no painting, no production status. */}
      {item.kind === 'custom' ? <section className={styles.production} aria-label="Production"><h4>Production</h4>
      <div className={styles.actions}>
        {held ? <span className={styles.waiting}>Painting starts once the online payment is confirmed</span> : photo ? <ButtonLink to={paintTo} state={navigationState} tone="staff" variant={item.productionStatus === 'finished' || held ? 'secondary' : 'primary'}>{item.productionStatus === 'finished' ? 'View reference' : 'Open painting'}</ButtonLink> : <span className={styles.waiting}>Waiting for reference photos</span>}
        {block ? <Link className={styles.schedule} to={agendaSlotPath(block, days)}><StaffText>{paintSlotLabel(block, days)}</StaffText></Link> : null}
      </div>
      {/* A handed-over ornament cannot go back to the workshop; undo the handover first. */}
      {item.handedOver ? null : <details className={styles.adjust}>
        <summary>Adjust production status</summary>
        <div className={styles.statusOptions}>
          {([{value:'not_started',label:'To paint'}, {value:'in_progress',label:'Painting'}, {value:'finished',label:'Ready'}] as const).map(option => <Button key={option.value} tone="staff" variant="secondary" selected={item.productionStatus === option.value} disabled={busy} onClick={() => onStatus(option.value)}>{option.label}</Button>)}
        </div>
      </details>}
      </section> : null}
      <section className={styles.handover} aria-label="Handover">
        <div>
          <h4>Handover</h4>
          <p><StaffText>{[handoffLabel(item, days), handoffArrivalLabel(item)].filter(Boolean).join(' · ')}</StaffText></p>
        </div>
        {!item.handedOver && blocker ? <p className={styles.blocked}>{`Can't hand over yet: ${blocker.toLowerCase()}.`}</p> : null}
        {/* With one ornament, or once the whole order is handed over, the order panel owns the handover: one control, not two. */}
        {onHandover ? <Button tone="staff" variant="secondary" disabled={busy || held || (!item.handedOver && item.productionStatus !== 'finished')} onClick={onHandover}>{item.handedOver ? 'Undo handover' : item.delivery.kind === 'post' ? 'Handed to Post' : 'Hand over this one'}</Button> : null}
      </section>
      </>}
    </article>
  )
}

function MarketItemPhoto({ id }: { id: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState<{ id: string; url: string | null } | null>(null)
  const seeded = seedMarketPhoto(id)
  const parts = marketOrnamentParts(id)

  useEffect(() => {
    if (!ref.current) return
    let active = true
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      void api.marketStock.photo(id).then(url => {
        if (active) setLoaded({ id, url })
      }).catch(() => {
        // Keep the reference photo or placeholder if the uploaded photo cannot be read.
      })
    }, { rootMargin: '120px' })
    observer.observe(ref.current)
    return () => { active = false; observer.disconnect() }
  }, [id])

  const uploaded = loaded?.id === id ? loaded.url : null
  const src = uploaded ?? seeded

  return (
    <div ref={ref} className={styles.marketPhoto}>
      {src ? (
        <img src={src} alt={`Ornament ${id}`} loading="lazy" />
      ) : (
        <div className={styles.marketPlaceholder} aria-hidden="true">
          {parts ? <span className={styles.marketPlaceholderSwatch} style={{ background: parts.color.swatch }} /> : null}
          <span className={styles.marketPlaceholderCode}>{id}</span>
        </div>
      )}
    </div>
  )
}
