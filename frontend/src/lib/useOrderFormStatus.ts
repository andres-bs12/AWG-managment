import { useEffect, useState } from 'react'
import { api } from '../api/client'

type Status = { orderId: string; received: boolean; customerName: string; error: string }

/** The QR stays open while another device saves the form; never overlap reads or retry in a tight loop. */
export function useOrderFormStatus(orderId: string | undefined, waiting: boolean) {
  const [status, setStatus] = useState<Status | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!orderId || !waiting) return
    let active = true
    let reading = false
    let received = false
    let failures = 0
    let timer: number | undefined
    async function read() {
      if (!active || reading || received || document.visibilityState === 'hidden') return
      window.clearTimeout(timer)
      reading = true
      try {
        const bundle = await api.orders.getOrderBundle(orderId!)
        if (!active) return
        const custom = bundle.items.filter(item => item.kind === 'custom')
        received = custom.length > 0 && custom.every(item => item.formComplete)
        failures = 0
        setStatus({ orderId: orderId!, received, customerName: bundle.customer.name, error: '' })
      } catch {
        failures += 1
        if (active) setStatus(current => ({ orderId: orderId!, received: Boolean(current && current.orderId === orderId && current.received), customerName: '', error: 'Could not check the customer form. Retrying automatically.' }))
      } finally {
        reading = false
        if (active && !received) timer = window.setTimeout(() => void read(), Math.min(30_000, 5000 * 2 ** failures))
      }
    }
    const visible = () => { if (document.visibilityState === 'visible') void read() }
    document.addEventListener('visibilitychange', visible)
    window.addEventListener('focus', visible)
    void read()
    return () => {
      active = false
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', visible)
      window.removeEventListener('focus', visible)
    }
  }, [orderId, waiting, retry])
  return { received: Boolean(status && status.orderId === orderId && status.received), customerName: status && status.orderId === orderId ? status.customerName : '', error: status && status.orderId === orderId ? status.error : '', retry: () => setRetry(value => value + 1) }
}
