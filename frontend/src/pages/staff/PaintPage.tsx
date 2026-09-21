import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useMockStoreVersion } from '../../api/mock/useMockStore'
import { PaintStudio } from '../../components/staff/PaintStudio'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
import type { Customer, Order, OrderItem, TimeBlock } from '../../domain/types'
import { formatHour } from '../../lib/time'
import styles from './PaintPage.module.css'

export function PaintPage() {
  useMockStoreVersion()
  const { id = '', itemId = '' } = useParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [item, setItem] = useState<OrderItem | null>(null)
  const [block, setBlock] = useState<TimeBlock | null>(null)
  const [error, setError] = useState('')

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
    if (!order || !item) return
    if (item.kind !== 'custom' || item.productionStatus !== 'not_started') return
    void api.orders.setItemStatus(order.id, item.id, 'in_progress').then(() => reload())
  }, [order?.id, item?.id, item?.kind, item?.productionStatus])

  if (error) {
    return (
      <div className={styles.message}>
        <p role="alert">{error}</p>
        <p>
          <Link to={order ? `/staff/orders/${order.id}` : '/staff/agenda'}>Back</Link>
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
  const slot = block ? `${formatHour(block.startHour)}–${formatHour(block.endHour)}` : 'No paint slot'

  async function toggleDone() {
    if (!order || !item) return
    const next = item.productionStatus === 'finished' ? 'in_progress' : 'finished'
    await api.orders.setItemStatus(order.id, item.id, next)
    await reload()
  }

  return (
    <article className={styles.page}>
      <header className={styles.top}>
        <div className={styles.who}>
          <h1>{title}</h1>
          <p className={styles.meta}>
            {order.code} · {customer.name} · {slot}
            {item.withName && item.backName ? ` · Back: ${item.backName}` : ''}
          </p>
        </div>
        <div className={styles.actions}>
          <ButtonLink to={`/staff/orders/${order.id}`} tone="staff" variant="ghost">
            Order
          </ButtonLink>
          <Button
            tone="staff"
            variant={item.productionStatus === 'finished' ? 'secondary' : 'primary'}
            onClick={() => void toggleDone()}
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
