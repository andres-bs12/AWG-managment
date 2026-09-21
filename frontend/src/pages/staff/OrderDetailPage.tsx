import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useMockStoreVersion } from '../../api/mock/useMockStore'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import type { Customer, Order, OrderItem, PaymentMethod, PaymentState, ProductionStatus, TimeBlock } from '../../domain/types'
import { formatEur } from '../../lib/money'
import { formatHour } from '../../lib/time'
import styles from './OrderDetailPage.module.css'

const PROD_OPTIONS: { value: ProductionStatus; label: string; selectedLabel: string }[] = [
  { value: 'not_started', label: 'Not started', selectedLabel: 'Current: Not started' },
  { value: 'in_progress', label: 'Start', selectedLabel: 'Current: Started' },
  { value: 'finished', label: 'Finished', selectedLabel: 'Current: Finished' },
]

const PAY_STATE_OPTIONS: { value: PaymentState; label: string; selectedLabel: string }[] = [
  { value: 'unpaid', label: 'Unpaid', selectedLabel: 'Current: Unpaid' },
  { value: 'deposit', label: 'Deposit', selectedLabel: 'Current: Deposit' },
  { value: 'paid', label: 'Paid', selectedLabel: 'Current: Paid' },
]

const PAY_METHOD_OPTIONS: { value: PaymentMethod; label: string; selectedLabel: string }[] = [
  { value: 'cash', label: 'Cash', selectedLabel: 'Current: Cash' },
  { value: 'card', label: 'Card', selectedLabel: 'Current: Card' },
]

export function OrderDetailPage() {
  useMockStoreVersion()
  const { id = '' } = useParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [blocks, setBlocks] = useState<TimeBlock[]>([])
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function reload() {
    const bundle = await api.orders.getOrderBundle(id)
    setOrder(bundle.order)
    setCustomer(bundle.customer)
    setItems(bundle.items)
    setBlocks(bundle.blocks)
  }

  useEffect(() => {
    reload().catch((err: Error) => setError(err.message))
  }, [id])

  if (error) return <p role="alert">{error}</p>
  if (!order || !customer) return <p>Loading order…</p>

  const orderId = order.id
  const formUrl = `${window.location.origin}/form/${order.formToken}`
  const methodLabel = order.paymentMethod === 'cash' ? 'Cash' : order.paymentMethod === 'card' ? 'Card' : null
  const stateLabel = PAY_STATE_OPTIONS.find((option) => option.value === order.paymentState)?.label ?? order.paymentState

  const payMethod = order.paymentMethod
  const needsCustomerForm = items.some((item) => item.kind === 'custom')

  async function pay(state: PaymentState, method: PaymentMethod | null) {
    await api.payments.setPaymentState(orderId, state, method)
    await reload()
  }

  async function setStatus(itemId: string, status: ProductionStatus) {
    await api.orders.setItemStatus(orderId, itemId, status)
    await reload()
  }

  function setPayState(state: PaymentState) {
    if (state === 'unpaid') {
      void pay('unpaid', null)
      return
    }
    void pay(state, payMethod)
  }

  return (
    <article className={styles.page}>
      <p>
        <Link className={styles.back} to="/staff/agenda">
          ← Agenda
        </Link>
      </p>
      <h1>
        {order.code} · {customer.name}
      </h1>
      <p className={styles.meta}>
        {customer.phone || 'Phone on form'} · {customer.email || 'Email on form'}
      </p>
      <p>
        Total {formatEur(order.total)}
      </p>

      <h2>Items</h2>
      {items.map((item) => {
        const block = blocks.find((b) => b.orderItemId === item.id)
        return (
          <section key={item.id} className={styles.card}>
            <h3>
              {item.kind === 'custom'
                ? `Custom · ${item.petName || 'Waiting for form'}`
                : 'Finished'}
            </h3>
            <p>
              {item.kind === 'custom'
                ? item.withName
                  ? `Name: ${item.backName || '(on form)'}`
                  : 'No name'
                : 'Ready-made'}{' '}
              · {formatEur(item.cost)}
            </p>
            {block ? (
              <p>
                Paint {formatHour(block.startHour)}–{formatHour(block.endHour)}
              </p>
            ) : null}
            <p>
              {item.delivery.kind === 'vienna'
                ? `Vienna · ${item.delivery.address?.line1 || 'Wed/Fri, no clock'}`
                : `Market pickup${item.delivery.pickupHour != null ? ` · ${formatHour(item.delivery.pickupHour)}` : ''}`}
            </p>
            {item.photos[0] ? (
              <div className={styles.ref}>
                <Link
                  className={styles.photoLink}
                  to={`/staff/orders/${orderId}/paint/${item.id}`}
                  aria-label={`Paint ${item.petName || 'ornament'} from the full photo`}
                >
                  <img src={item.photos[0].dataUrl} alt={`${item.petName || 'Pet'} reference`} />
                </Link>
                <ButtonLink to={`/staff/orders/${orderId}/paint/${item.id}`} tone="staff">
                  {item.productionStatus === 'in_progress' ? 'Continue painting' : 'Paint'}
                </ButtonLink>
              </div>
            ) : (
              <p>No photos yet</p>
            )}
            <SegmentedControl
              legend="Production"
              name={`prod-${item.id}`}
              value={item.productionStatus}
              onChange={(status) => void setStatus(item.id, status)}
              options={PROD_OPTIONS}
            />
          </section>
        )
      })}

      <h2>Payment</h2>
      <p className={styles.payNow} role="status">
        On now: {stateLabel}
        {order.paymentState !== 'unpaid' && methodLabel ? ` · ${methodLabel}` : ''}
      </p>
      <div className={styles.payBlock}>
        <SegmentedControl
          legend="Payment state"
          name="pay-state"
          value={order.paymentState}
          onChange={setPayState}
          options={PAY_STATE_OPTIONS}
        />
        {order.paymentState !== 'unpaid' ? (
          <SegmentedControl
            legend="Method"
            name="pay-method"
            value={order.paymentMethod}
            onChange={(method) => void pay(order.paymentState, method)}
            options={PAY_METHOD_OPTIONS}
          />
        ) : (
          <p className={styles.meta}>Choose Deposit or Paid, then Cash or Card.</p>
        )}
      </div>

      {needsCustomerForm ? (
        <>
          <h2>Customer form</h2>
          <p className={styles.link}>{formUrl}</p>
          <div className={styles.row}>
            <Button
              tone="staff"
              variant="secondary"
              onClick={() => {
                void navigator.clipboard.writeText(formUrl)
                setCopied(true)
              }}
            >
              {copied ? 'Copied' : 'Copy link'}
            </Button>
            <ButtonLink to={`/form/${order.formToken}`} variant="secondary" tone="staff">
              Open form here
            </ButtonLink>
            <ButtonLink to={`/track/${order.code}`} variant="ghost" tone="staff">
              Public track
            </ButtonLink>
          </div>
        </>
      ) : (
        <div className={styles.row}>
          <ButtonLink to={`/track/${order.code}`} variant="ghost" tone="staff">
            Public track
          </ButtonLink>
        </div>
      )}
    </article>
  )
}
