import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useMockStoreVersion } from '../../api/mock/useMockStore'
import { PaintStudio } from '../../components/staff/PaintStudio'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
import type { Customer, MarketDay, Order, OrderItem, TimeBlock } from '../../domain/types'
import { agendaSlotPath, handoffLabel, paintSlotLabel } from '../../lib/handoff'
import styles from './PaintPage.module.css'

export function PaintPage() {
  useMockStoreVersion()
  const { id = '', itemId = '' } = useParams()
  const location = useLocation()
  const [order, setOrder] = useState<Order | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [item, setItem] = useState<OrderItem | null>(null)
  const [block, setBlock] = useState<TimeBlock | null>(null)
  const [marketDays, setMarketDays] = useState<MarketDay[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  async function reload() {
    const bundle = await api.orders.getOrderBundle(id)
    const next = bundle.items.find((row) => row.id === itemId) ?? null
    setOrder(bundle.order)
    setCustomer(bundle.customer)
    setItem(next)
    setBlock(bundle.blocks.find((row) => row.orderItemId === itemId) ?? null)
    if (!next) setError('Ornament not found')
  }

  useEffect(() => {
    reload().catch((err: Error) => setError(err.message))
  }, [id, itemId])

  useEffect(() => {
    api.markets.listMarketDays().then(setMarketDays)
  }, [])

  const orderTo = order ? `/staff/orders/${order.id}` : '/staff/agenda'

  if (error) {
    return (
      <div className={styles.message}>
        <p role="alert">{error}</p>
        <p>
          <Link to={orderTo} state={location.state}>
            ← Back
          </Link>
        </p>
      </div>
    )
  }

  if (!order || !customer || !item) {
    return (
      <div className={styles.message}>
        <p>Loading photo…</p>
      </div>
    )
  }

  const title = item.petName || 'Custom ornament'
  const slot = block ? paintSlotLabel(block, marketDays) : 'No paint slot'
  const handoff = handoffLabel(item, marketDays)
  const agendaTo = block ? agendaSlotPath(block, marketDays) : '/staff/agenda'

  async function updateStatus(status: 'in_progress' | 'finished') {
    if (!order || !item || busy) return
    setBusy(true)
    setActionError('')
    try {
      await api.orders.setItemStatus(order.id, item.id, status)
      await reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update ornament')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className={styles.page}>
      <header className={styles.top}>
        <ButtonLink
          className={styles.back}
          to={orderTo}
          state={location.state}
          tone="staff"
          variant="secondary"
          aria-label={`Back to order ${order.code}`}
        >
          ← Back
        </ButtonLink>
        <div className={styles.who}>
          <h1>{title}</h1>
          <p className={styles.handoff}>{handoff}</p>
          <p className={styles.meta}>{order.code} · {customer.name}</p>
          <p className={styles.meta}>{slot}</p>
          {(item.withName && item.backName) || item.color ? <p className={styles.paintFacts}>{item.withName && item.backName ? <strong>Back: {item.backName}</strong> : null}{item.color ? <span>Colour: {item.color}</span> : null}</p> : null}
          {item.note ? <p className={styles.paintNote}>{item.note}</p> : null}
          {actionError ? <p role="alert">{actionError}</p> : null}
        </div>
        <div className={styles.actions}>
          {block ? (
            <ButtonLink to={agendaTo} tone="staff" variant="ghost">
              Agenda slot
            </ButtonLink>
          ) : null}
          {item.productionStatus === 'not_started' ? <Button tone="staff" variant="secondary" disabled={busy} onClick={() => void updateStatus('in_progress')}>Start painting</Button> : null}
          <Button
            disabled={busy}
            className={styles.done}
            tone="staff"
            variant={item.productionStatus === 'finished' ? 'secondary' : 'primary'}
            onClick={() => void updateStatus(item.productionStatus === 'finished' ? 'in_progress' : 'finished')}
          >
            {item.productionStatus === 'finished' ? 'Not finished' : 'Mark finished'}
          </Button>
        </div>
      </header>
      {item.photos.length ? (
        <PaintStudio photos={item.photos} alt={`${title} reference photo`} />
      ) : (
        <p className={styles.message}>No photos yet. Ask the customer to finish the form.</p>
      )}
    </article>
  )
}
