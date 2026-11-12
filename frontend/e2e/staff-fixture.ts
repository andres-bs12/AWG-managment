import { expect, type Page, type Route } from '@playwright/test'
import type { AgendaDay, CreateSaleInput, Market, Order, OrderItem, TimeBlock } from '../src/domain/types'
import { formatHour } from '../src/lib/time'

export const staffUser = { id: 'staff-gaby', name: 'Gaby', email: 'gaby@artwithgab.com' }
export const today = '2026-11-06'
export const token = 'staff-review-session'
export const market: Market = { id: 'market-review', name: 'Review Christmas Market', kind: 'market', totalCost: 1250, startDate: today, finishDate: '2026-11-08', stall: 4 }
export const marketDay = { id: 'day-review', marketId: market.id, date: today, openHour: 10, closeHour: 20, isToday: true }
export const spareMarket: Market = { ...market, id: 'market-spare', name: 'Unused market', startDate: '2026-12-04', finishDate: '2026-12-06' }
export const spareDays = ['2026-12-04', '2026-12-05', '2026-12-06'].map((date, index) => ({ ...marketDay, id: `spare-${index}`, marketId: spareMarket.id, date, isToday: false }))
export const config = { enabled: true, seasonOver: false, seasonEnd: '2026-12-24', deliveriesFrom: '2026-11-30', customPrice: 57, finishedPrice: 41, nameExtra: 14, deliveryFee: 0, maxItems: 8, colors: ['red', 'green', 'beige'].flatMap(color => ['shiny', 'matte'].map(finish => ({ color, finish, inStock: true }))) }

export function order(id = 'order-review', overrides: Partial<Order> = {}): Order {
  return { id, customerId: `customer-${id}`, code: id === 'order-review' ? 'AWGREVIEW' : `AWG${id.toUpperCase()}`, trackToken: `track-${id}`, formToken: `form-${id}`, paymentState: 'deposit', paymentMethod: 'cash', total: 57, amountPaid: 20, createdAt: `${today}T08:00:00`, itemIds: [`item-${id}`], handedOver: false, ...overrides }
}
export function item(parent: Order, overrides: Partial<OrderItem> = {}): OrderItem {
  return { id: parent.itemIds[0], orderId: parent.id, kind: 'custom', petName: 'Luna', withName: false, color: 'red', finish: 'matte', backName: '', note: '', cost: parent.total, productionStatus: 'not_started', photos: [], formComplete: true, delivery: { kind: 'market', marketId: market.id, marketDayId: marketDay.id, pickupHour: 17 }, ...overrides }
}
export function summary(parent: Order, checkoutStatus: string | null = null) {
  return { id: parent.id, code: parent.code, customerName: 'Alex Review', phone: '+43 660 1234567', createdAt: parent.createdAt, paymentState: parent.paymentState, checkoutStatus, total: parent.total, items: parent.itemIds.length, nextHandoffDate: today, handedOver: parent.handedOver }
}

type FixtureOptions = { multi?: boolean; mixedHandoff?: boolean; finished?: boolean; handedOver?: boolean; held?: boolean; attention?: boolean; missingForm?: boolean; controlledClock?: boolean; checkoutStatus?: 'pending' | 'review' }

/**
 * Serve the actual HTTP entry in the existing Vite test server. Only the selected
 * API module and backend responses are substituted: components, HTTP error/auth
 * handling and request serialisation are the production implementations. The
 * HTTP demo entry keeps its store version constant, so mock notifications cannot
 * accidentally hide a missing HTTP re-fetch.
 */
export async function httpFixture(page: Page, options: FixtureOptions = {}) {
  const instant = new Date(`${today}T09:00:00Z`) // 10:00 in Vienna, independently of device timezone.
  if (options.controlledClock) await page.clock.install({ time: instant })
  else await page.clock.setFixedTime(instant)
  await page.addInitScript(value => {
    if (!sessionStorage.getItem('staff-fixture-initialized')) {
      localStorage.setItem('awg-staff-token', value)
      sessionStorage.setItem('staff-fixture-initialized', 'true')
    }
  }, token)
  await page.route('**/src/api/mock/entry.ts', route => route.fulfill({ contentType: 'application/javascript', body: "export { httpApi as selectedApi } from '/src/api/http/services.ts'" }))
  await page.route('**/src/api/mock/demo.ts', route => route.fulfill({ contentType: 'application/javascript', body: "export * from '/src/api/http/demo.ts'" }))
  const original = order('order-review', { handedOver: options.handedOver ?? false, ...(options.checkoutStatus ? { source: 'web', checkoutStatus: options.checkoutStatus, paymentState: 'unpaid', paymentMethod: null, amountPaid: 0 } : {}) })
  if (options.multi || options.mixedHandoff) original.itemIds.push('item-second')
  const records = new Map([[original.id, original]])
  const items = new Map([[original.id, item(original, { productionStatus: options.finished ? 'finished' : 'not_started', formComplete: !options.missingForm })]])
  const extraItem = options.multi || options.mixedHandoff ? item(original, { id: 'item-second', petName: 'Milo', productionStatus: 'finished', handedOver: options.handedOver ?? false, ...(options.mixedHandoff ? { delivery: { kind: 'vienna', marketId: 'market-home', marketDayId: 'day-vienna', deliveryDate: '2026-12-02', pickupHour: null, address: { line1: 'Examplegasse 2', postalCode: '1010', city: 'Vienna' } } } : {}) }) : null
  const blocks = new Map<string, TimeBlock>([[original.id, { id: 'block-review', marketDayId: marketDay.id, orderItemId: original.itemIds[0], startHour: 12, endHour: 13, status: options.finished ? 'finished' : 'not_started' }]])
  const createdByKey = new Map<string, Order>()
  const mutations: { path: string; body: unknown }[] = []
  const saleRequests: { key: string; input: CreateSaleInput; id: string }[] = []
  const searches: string[] = []
  let dayReads = 0
  let meStatus: number | 'offline' = 200
  let logoutOffline = false
  let agendaStatus = 200
  let mutationError: { code: string; message: string } | null = null
  const inventory = [...config.colors.map((row, index) => ({ id: `stock-${index}`, kind: 'custom', color: row.color, finish: row.finish, quantity: 3 })), { id: 'stock-finished', kind: 'finished', color: null, finish: null, quantity: 3 }]
  let allMarkets = [market, spareMarket, ...(options.mixedHandoff ? [{ ...market, id: 'market-home', name: 'Home', kind: 'home' as const }] : [])]
  let allDays = [marketDay, ...(options.mixedHandoff ? [{ ...marketDay, id: 'day-vienna', marketId: 'market-home', date: '2026-12-02', isToday: false }] : []), ...spareDays]
  let paintingDays = [{ date: '2026-11-05', open: true, maxPaintings: 2, booked: 0, openHour: 10, closeHour: 20 }, { date: today, open: true, maxPaintings: 2, booked: 1, openHour: 10, closeHour: 20 }, { date: '2026-11-07', open: true, maxPaintings: 2, booked: 3, openHour: 10, closeHour: 20 }, ...spareDays.map(day => ({ date: day.date, open: true, maxPaintings: 2, booked: 0, openHour: 10, closeHour: 20 }))]

  const bundle = (id: string) => {
    const parent = records.get(id)!
    return { order: parent, customer: { id: parent.customerId, name: 'Alex Review', phone: '+43 660 1234567', email: 'alex@example.com' }, items: [items.get(id)!, ...(id === original.id && extraItem ? [extraItem] : [])], blocks: blocks.has(id) ? [blocks.get(id)!] : [] }
  }
  const day = (selectedDay = marketDay): AgendaDay => {
    const slots = [...records.values()].flatMap(parent => {
      const currentItem = items.get(parent.id), block = blocks.get(parent.id)
      return currentItem && block?.marketDayId === selectedDay.id && parent.status !== 'CANCELLED' ? [{ block, order: parent, item: currentItem, customer: bundle(parent.id).customer }] : []
    })
    const held = options.held && selectedDay.id === marketDay.id ? [{ block: { id: 'web-checkout-hold', marketDayId: marketDay.id, orderItemId: null, startHour: 15, endHour: 16, status: 'not_started' as const }, order: null, item: null, customer: null, held: true }] : []
    const deliveries = [...records.values()].flatMap(parent => {
      const list = [items.get(parent.id)!, ...(parent.id === original.id && extraItem ? [extraItem] : [])]
      return list.filter(currentItem => currentItem.delivery.marketDayId === selectedDay.id && parent.status !== 'CANCELLED').map(currentItem => ({ orderId: parent.id, orderCode: parent.code, itemId: currentItem.id, title: currentItem.petName || 'Custom ornament', customerName: 'Alex Review', color: currentItem.color, finish: currentItem.finish, productionStatus: currentItem.productionStatus, handedOver: currentItem.handedOver ?? parent.handedOver, deliveryKind: currentItem.delivery.kind, pickupHour: currentItem.delivery.pickupHour ?? null, methodLabel: currentItem.delivery.kind === 'vienna' ? 'Vienna' : market.name, timeLabel: currentItem.delivery.kind === 'market' && currentItem.delivery.pickupHour != null ? formatHour(currentItem.delivery.pickupHour) : null, phone: '+43 660 1234567', addressLabel: null, remaining: parent.total - (parent.amountPaid ?? 0), paymentState: parent.paymentState }))
    })
    return { marketDay: selectedDay, market: allMarkets.find(row => row.id === selectedDay.marketId) ?? market, slots: [...slots, ...held], deliveries }
  }
  async function json(route: Route, value: unknown, status = 200) { await route.fulfill({ status, json: value }) }
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()
    if (path === '/api/staff/me') {
      if (meStatus === 'offline') return route.abort('failed')
      return json(route, meStatus === 200 ? staffUser : { code: 'UNAUTHORIZED', message: 'Session expired.' }, meStatus)
    }
    if (path === '/api/staff/login') return json(route, { user: staffUser, token })
    if (path === '/api/staff/logout') {
      if (logoutOffline) return route.abort('failed')
      return route.fulfill({ status: 204 })
    }
    if (path === '/api/shop/config') return json(route, config)
    if (path === '/api/inventory') return json(route, inventory)
    if (path === '/api/markets' && method === 'GET') return json(route, allMarkets)
    if (path === '/api/market-days') return json(route, allDays.filter(row => !url.searchParams.has('marketId') || row.marketId === url.searchParams.get('marketId')))
    if (path === '/api/painting-days') return json(route, paintingDays.filter(row => row.date >= (url.searchParams.get('from') ?? '') && row.date <= (url.searchParams.get('to') ?? '9999')))
    if (path.startsWith('/api/painting-days/') && method === 'PATCH') {
      const body = request.postDataJSON() as { open: boolean; maxPaintings: number; openHour?: number; closeHour?: number }
      mutations.push({ path, body })
      const date = decodeURIComponent(path.split('/').pop()!)
      paintingDays = paintingDays.map(row => row.date === date ? { ...row, ...body } : row)
      return json(route, paintingDays.find(row => row.date === date))
    }
    if (path === '/api/agenda/days' || path.startsWith('/api/agenda/days/')) {
      dayReads++
      if (agendaStatus !== 200) return json(route, { code: 'UNAUTHORIZED', message: 'Session expired.' }, agendaStatus)
      return json(route, path === '/api/agenda/days' ? allDays.map(selectedDay => day(selectedDay)) : day())
    }
    if (path === '/api/agenda/capacity') return json(route, { ok: true, slot: { date: today, startHour: 13, endHour: 14 }, remainingHours: 4, message: 'Available' })
    if (path === '/api/agenda/move-suggestion') return json(route, null)
    if (path === '/api/orders/search') { searches.push(url.searchParams.get('q') ?? ''); return json(route, [...records.values()].map(row => summary(row))) }
    if (path === '/api/orders/attention') return json(route, options.attention ? [summary(original, 'review')] : [])
    const bundleMatch = /^\/api\/orders\/([^/]+)\/bundle$/.exec(path)
    if (bundleMatch) return records.has(bundleMatch[1]) ? json(route, bundle(bundleMatch[1])) : json(route, { message: 'Order not found.' }, 404)
    if (path === '/api/orders' && method === 'POST') {
      const key = request.headers()['idempotency-key']
      expect(key).toBeTruthy()
      const input = request.postDataJSON() as CreateSaleInput
      if (mutationError) return json(route, mutationError, 409)
      const previous = createdByKey.get(key)
      const created = previous ?? order(`sale-${createdByKey.size + 1}`, { total: input.items.reduce((sum, row) => sum + (row.kind === 'custom' ? config.customPrice + (row.withName ? config.nameExtra : 0) : config.finishedPrice), 0), paymentState: 'unpaid', paymentMethod: null, amountPaid: 0 })
      if (!previous) {
        records.set(created.id, created)
        const first = input.items[0]
        items.set(created.id, item(created, { kind: first.kind, petName: '', formComplete: false, color: first.color, finish: first.finish, productionStatus: first.kind === 'finished' ? 'finished' : 'not_started', delivery: { kind: first.deliveryKind === 'vienna' ? 'vienna' : 'market', marketDayId: first.marketDayId ?? marketDay.id, marketId: market.id, pickupHour: first.pickupHour } }))
        if (first.kind === 'custom' && first.paintStart != null && first.paintEnd != null) blocks.set(created.id, { id: `block-${created.id}`, marketDayId: allDays.find(day => day.date === first.paintDate)?.id ?? marketDay.id, orderItemId: created.itemIds[0], startHour: first.paintStart, endHour: first.paintEnd, status: 'not_started' })
        createdByKey.set(key, created)
      }
      saleRequests.push({ key, input, id: created.id })
      return json(route, created)
    }
    if (method !== 'GET') {
      const body = request.postData() ? request.postDataJSON() : null
      mutations.push({ path, body })
      if (mutationError) return json(route, mutationError, 409)
      if (method === 'PATCH' && path.startsWith('/api/inventory/')) {
        const row = inventory.find(entry => entry.id === path.split('/').at(-1))!
        if (body.expectedQuantity !== row.quantity) return json(route, { code: 'STOCK_CHANGED', message: 'Stock changed.' }, 409)
        row.quantity = body.quantity
        return json(route, row)
      }
      if (path === '/api/agenda/blocks/block-review') {
        const block = blocks.get(original.id)!
        blocks.set(original.id, { ...block, startHour: body.startHour, endHour: body.startHour + block.endHour - block.startHour })
        return route.fulfill({ status: 204 })
      }
      const payment = /^\/api\/orders\/([^/]+)\/payment-state$/.exec(path)
      if (payment) {
        const parent = records.get(payment[1])!
        Object.assign(parent, { paymentState: body.state, paymentMethod: body.method, amountPaid: body.state === 'paid' ? parent.total : body.state === 'unpaid' ? 0 : body.amountPaid })
        return json(route, parent)
      }
      const handed = /^\/api\/orders\/([^/]+)\/handed-over$/.exec(path)
      if (handed) { const parent = records.get(handed[1])!; const list = [items.get(handed[1])!, ...(handed[1] === original.id && extraItem ? [extraItem] : [])]; for (const row of list) if (!body.itemIds || body.itemIds.includes(row.id)) row.handedOver = body.handedOver; parent.handedOver = list.every(row => row.handedOver); return route.fulfill({ status: 204 }) }
      const cancelled = /^\/api\/orders\/([^/]+)\/cancel$/.exec(path)
      if (cancelled) { Object.assign(records.get(cancelled[1])!, { status: 'CANCELLED', cancelledAt: new Date().toISOString(), cancellationReason: body.reason }); return route.fulfill({ status: 204 }) }
      const status = /^\/api\/orders\/([^/]+)\/items\/[^/]+\/status$/.exec(path)
      if (status) { items.get(status[1])!.productionStatus = body.status; return route.fulfill({ status: 204 }) }
      if (method === 'DELETE' && path.startsWith('/api/markets/')) { allMarkets = allMarkets.filter(row => row.id !== path.split('/').at(-1)); return route.fulfill({ status: 204 }) }
      if (method === 'DELETE' && path.startsWith('/api/market-days/')) { allDays = allDays.filter(row => row.id !== path.split('/').at(-1)); return route.fulfill({ status: 204 }) }
      if (path === '/api/markets' && method === 'POST') {
        const saved = { ...spareMarket, ...body }
        allMarkets = allMarkets.map(row => row.id === saved.id ? saved : row)
        const savedDays = body.days.map((row: { date: string; openHour: number; closeHour: number }, index: number) => ({ ...row, id: `saved-${index}`, marketId: saved.id, isToday: false }))
        allDays = [...allDays.filter(row => row.marketId !== saved.id), ...savedDays]
        return json(route, { market: saved, days: savedDays })
      }
    }
    return json(route, { message: `Unstubbed staff request: ${method} ${path}` }, 501)
  })
  return { original, records, items, mutations, saleRequests, searches, get dayReads() { return dayReads }, setMeStatus(value: typeof meStatus) { meStatus = value }, setLogoutOffline() { logoutOffline = true }, expireAgenda() { agendaStatus = 401 }, rejectMutations(code: string, message: string) { mutationError = { code, message } } }
}

export async function navigation(page: Page, to: string) {
  // Use the router so the HTTP session and draft stay mounted.
  await page.evaluate(path => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')) }, to)
}
export async function signedIn(page: Page, to = '/staff/agenda') {
  await page.goto(to)
  await expect(page.locator('div[data-staff-page]')).toBeVisible()
}
export async function newFinishedSale(page: Page) {
  await page.getByRole('button', { name: /Add finished product/ }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('radio', { name: 'Paid', exact: true }).locator('..').click()
  await page.getByRole('radio', { name: 'Cash', exact: true }).locator('..').click()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Open order', exact: true })).toBeVisible()
}

