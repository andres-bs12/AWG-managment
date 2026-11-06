import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useStaffRefresh } from '../../lib/useStaffRefresh'
import { useItemStatus } from '../../components/staff/useItemStatus'
import { PaintStudio } from '../../components/staff/PaintStudio'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
import type { MarketDay, ProductionStatus } from '../../domain/types'
import { agendaSlotPath, handoffLabel, paintSlotLabel } from '../../lib/handoff'
import styles from './PaintPage.module.css'

export function PaintPage() {
  const version = useStaffRefresh()
  const { id = '', itemId = '' } = useParams()
  const location = useLocation()
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof api.orders.getOrderBundle>> | null>(null)
  const order = bundle?.order ?? null
  const customer = bundle?.customer ?? null
  const item = bundle?.items.find(row => row.id === itemId) ?? null
  const block = bundle?.blocks.find(row => row.orderItemId === itemId) ?? null
  const [marketDays, setMarketDays] = useState<MarketDay[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const actionLock = useRef(false)

  const reload = useCallback(async () => {
    const bundle = await api.orders.getOrderBundle(id)
    const next = bundle.items.find((row) => row.id === itemId) ?? null
    setBundle(bundle)
    setError(next ? '' : 'Ornament not found')
  }, [id, itemId])

  useEffect(() => {
    reload().catch((err: Error) => setError(err.message))
  }, [reload, version])

  useEffect(() => {
    api.markets.listMarketDays().then(setMarketDays).catch(err => setError(err instanceof Error ? err.message : 'Could not load painting times.'))
  }, [])

  const orderTo = order ? `/staff/orders/${order.id}` : '/staff/agenda'

  const statusAction = useItemStatus(bundle, async (targetId: string, status: ProductionStatus) => {
    if (actionLock.current) return false
    actionLock.current = true
    setBusy(true); setActionError('')
    try { await api.orders.setItemStatus(id, targetId, status); await reload(); return true }
    catch (err) { setActionError(err instanceof Error ? err.message : 'Could not update ornament.'); return false }
    finally { actionLock.current = false; setBusy(false) }
  }, busy)

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
          <h1 title={title}>{title}</h1>
          <p className={styles.handoff}>{handoff}</p>
          <p className={styles.meta}>{order.code} · {customer.name || 'Customer pending'}</p>
          <p className={styles.meta}>{slot}</p>
          <p className={styles.paintFacts}>{item.withName && item.backName ? <strong>Name on back: {item.backName}</strong> : null}<span>Colour: {item.color ? `${item.color} · ${item.finish ?? 'shiny'}` : 'not set'}</span></p>
          {item.note ? <p className={styles.paintNote}>{item.note}</p> : null}
          {statusAction.unconfirmed && <p role="status">Waiting for online payment review. Painting is unavailable.</p>}
          {actionError ? <p role="alert">{actionError}</p> : null}
        </div>
        <div className={styles.actions}>
          {block ? (
            <ButtonLink to={agendaTo} tone="staff" variant="ghost">
              Agenda slot
            </ButtonLink>
          ) : null}
          {item.productionStatus === 'not_started' ? <Button tone="staff" variant="secondary" disabled={busy || statusAction.unconfirmed} onClick={() => void statusAction.setStatus(item.id, 'in_progress')}>Start painting</Button> : null}
          <Button
            disabled={busy || statusAction.unconfirmed}
            className={styles.done}
            tone="staff"
            variant={item.productionStatus === 'finished' ? 'secondary' : 'primary'}
            onClick={() => void statusAction.setStatus(item.id, item.productionStatus === 'finished' ? 'in_progress' : 'finished')}
          >
            {item.productionStatus === 'finished' ? 'Not finished' : 'Mark finished'}
          </Button>
        </div>
      </header>
      {statusAction.dialog}
      {item.photos.length ? (
        <PaintStudio photos={item.photos} alt={`${title} reference photo`} />
      ) : (
        <p className={styles.message}>No photos yet. Ask the customer to finish the form.</p>
      )}
    </article>
  )
}
