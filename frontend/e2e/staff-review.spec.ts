import { test, expect, type Page, type Route } from '@playwright/test'
import type { AgendaDay, CreateSaleInput, Market, Order, OrderItem, TimeBlock } from '../src/domain/types'
import { axe } from './helpers'

const staffUser = { id: 'staff-gaby', name: 'Gaby', email: 'gaby@artwithgab.com' }
const today = '2026-11-06'
const token = 'staff-review-session'
const market: Market = { id: 'market-review', name: 'Review Christmas Market', kind: 'market', totalCost: 1250, startDate: today, finishDate: '2026-11-08', stall: 4 }
const marketDay = { id: 'day-review', marketId: market.id, date: today, openHour: 10, closeHour: 20, isToday: true }
const spareMarket: Market = { ...market, id: 'market-spare', name: 'Unused market', startDate: '2026-12-04', finishDate: '2026-12-06' }
const spareDays = ['2026-12-04', '2026-12-05', '2026-12-06'].map((date, index) => ({ ...marketDay, id: `spare-${index}`, marketId: spareMarket.id, date, isToday: false }))
const config = { enabled: true, seasonOver: false, seasonEnd: '2026-12-24', deliveriesFrom: '2026-11-30', customPrice: 57, finishedPrice: 41, nameExtra: 14, deliveryFee: 0, maxItems: 8, colors: ['red', 'green', 'beige'].flatMap(color => ['shiny', 'matte'].map(finish => ({ color, finish, inStock: true }))) }

function order(id = 'order-review', overrides: Partial<Order> = {}): Order {
  return { id, customerId: `customer-${id}`, code: id === 'order-review' ? 'AWGREVIEW' : `AWG${id.toUpperCase()}`, trackToken: `track-${id}`, formToken: `form-${id}`, paymentState: 'deposit', paymentMethod: 'cash', total: 57, amountPaid: 20, createdAt: `${today}T08:00:00`, itemIds: [`item-${id}`], handedOver: false, ...overrides }
}
function item(parent: Order, overrides: Partial<OrderItem> = {}): OrderItem {
  return { id: parent.itemIds[0], orderId: parent.id, kind: 'custom', petName: 'Luna', withName: false, color: 'red', finish: 'matte', backName: '', note: '', cost: parent.total, productionStatus: 'not_started', photos: [], formComplete: true, delivery: { kind: 'market', marketId: market.id, marketDayId: marketDay.id, pickupHour: 17 }, ...overrides }
}
function summary(parent: Order, checkoutStatus: string | null = null) {
  return { id: parent.id, code: parent.code, customerName: 'Alex Review', phone: '+43 660 1234567', createdAt: parent.createdAt, paymentState: parent.paymentState, checkoutStatus, total: parent.total, items: parent.itemIds.length, nextHandoffDate: today, handedOver: parent.handedOver }
}

type FixtureOptions = { finished?: boolean; handedOver?: boolean; held?: boolean; attention?: boolean; missingForm?: boolean; controlledClock?: boolean; checkoutStatus?: 'pending' | 'review' }

/**
 * Serve the actual HTTP entry in the existing Vite test server. Only the selected
 * API module and backend responses are substituted: components, HTTP error/auth
 * handling and request serialisation are the production implementations. The
 * HTTP demo entry keeps its store version constant, so mock notifications cannot
 * accidentally hide a missing HTTP re-fetch.
 */
async function httpFixture(page: Page, options: FixtureOptions = {}) {
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
  const records = new Map([[original.id, original]])
  const items = new Map([[original.id, item(original, { productionStatus: options.finished ? 'finished' : 'not_started', formComplete: !options.missingForm })]])
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
  let allMarkets = [market, spareMarket]
  let allDays = [marketDay, ...spareDays]

  const bundle = (id: string) => {
    const parent = records.get(id)!
    return { order: parent, customer: { id: parent.customerId, name: 'Alex Review', phone: '+43 660 1234567', email: 'alex@example.com' }, items: [items.get(id)!], blocks: blocks.has(id) ? [blocks.get(id)!] : [] }
  }
  const day = (): AgendaDay => {
    const current = records.get(original.id)
    const currentItem = items.get(original.id)
    const slots = current && currentItem ? [{ block: blocks.get(current.id)!, order: current, item: currentItem, customer: bundle(current.id).customer }] : []
    const held = options.held ? [{ block: { id: 'web-checkout-hold', marketDayId: marketDay.id, orderItemId: null, startHour: 15, endHour: 16, status: 'not_started' as const }, order: null, item: null, customer: null, held: true }] : []
    return { marketDay, market, slots: [...slots, ...held], deliveries: current && currentItem ? [{ orderId: current.id, orderCode: current.code, itemId: currentItem.id, title: 'Luna', customerName: 'Alex Review', color: 'red', finish: 'matte', productionStatus: currentItem.productionStatus, handedOver: current.handedOver, deliveryKind: 'market', pickupHour: 17, methodLabel: market.name, timeLabel: '17:00', phone: '+43 660 1234567', addressLabel: null, remaining: current.total - (current.amountPaid ?? 0), paymentState: current.paymentState }] : [] }
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
    if (path === '/api/painting-days') return json(route, [{ date: today, open: true, maxPaintings: 2, booked: 1 }])
    if (path === '/api/agenda/days' || path.startsWith('/api/agenda/days/')) {
      dayReads++
      if (agendaStatus !== 200) return json(route, { code: 'UNAUTHORIZED', message: 'Session expired.' }, agendaStatus)
      return json(route, path === '/api/agenda/days' ? [day()] : day())
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
        items.set(created.id, item(created, { kind: input.items[0].kind, productionStatus: input.items[0].kind === 'finished' ? 'finished' : 'not_started' }))
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
      if (handed) { records.get(handed[1])!.handedOver = body.handedOver; return route.fulfill({ status: 204 }) }
      const cancelled = /^\/api\/orders\/([^/]+)\/cancel$/.exec(path)
      if (cancelled) { records.delete(cancelled[1]); return route.fulfill({ status: 204 }) }
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

async function navigation(page: Page, to: string) {
  // Use the router so the HTTP session and draft stay mounted.
  await page.evaluate(path => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')) }, to)
}
async function signedIn(page: Page, to = '/staff/agenda') {
  await page.goto(to)
  await expect(page.locator('div[data-staff-page]')).toBeVisible()
}
async function newFinishedSale(page: Page) {
  await page.getByRole('button', { name: /Add finished product/ }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('radio', { name: 'Paid', exact: true }).locator('..').click()
  await page.getByRole('radio', { name: 'Cash', exact: true }).locator('..').click()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Open order', exact: true })).toBeVisible()
}

test('login retains the requested route and rejects an incorrect password', async ({ page }) => {
  await httpFixture(page)
  await page.route('**/api/staff/me', route => route.fulfill({ status: 401, json: { message: 'Session expired.' } }))
  let allowed = false
  await page.route('**/api/staff/login', route => route.fulfill(allowed ? { json: { user: staffUser, token } } : { status: 401, json: { code: 'BAD_CREDENTIALS', message: 'Email or password is incorrect.' } }))
  await page.goto('/staff/inventory')
  await expect(page.getByRole('heading', { name: 'Staff sign in' })).toBeVisible()
  await page.getByLabel('Email', { exact: true }).fill(staffUser.email)
  await page.getByLabel('Password', { exact: true }).fill('incorrect')
  await page.getByRole('button', { name: /Enter|Sign in/ }).click()
  await expect(page.getByRole('alert')).toContainText('incorrect')
  await axe(page)
  allowed = true
  await page.getByLabel('Password', { exact: true }).fill('correct-staff-password')
  await page.getByRole('button', { name: /Enter|Sign in/ }).click()
  await expect(page).toHaveURL(/\/staff\/inventory$/)
})

test('offline boot retains the token, retries, and failed logout clears the shared device', async ({ page }) => {
  const fixture = await httpFixture(page)
  fixture.setMeStatus('offline')
  await page.goto('/staff/agenda')
  await expect(page.getByText('Offline — retrying', { exact: false })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('awg-staff-token'))).toBe(token)
  fixture.setMeStatus(200)
  await page.getByRole('button', { name: 'Retry session', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Agenda', exact: true })).toBeVisible()
  fixture.setLogoutOffline()
  await page.evaluate(() => {
    localStorage.setItem('awg-form-token:AWGABC123', JSON.stringify({ token: 'customer-token', savedAt: Date.now() }))
    localStorage.setItem('awg-form-token:AWGOLD12', 'legacy-token')
  })
  const logout = page.getByRole('button', { name: 'Log out', exact: true })
  if (!await logout.isVisible()) await page.getByRole('button', { name: 'More', exact: true }).click()
  await logout.click()
  await expect(page.getByRole('heading', { name: 'Staff sign in' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('awg-staff-token'))).toBeNull()
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('awg-form-token:')))).toEqual([])
  await page.goBack()
  await expect(page.getByRole('navigation', { name: /^Staff(?: tabs)?$/ })).toHaveCount(0)
  await expect(page.getByRole('searchbox', { name: 'Search orders', exact: true })).toHaveCount(0)
  await page.goto('/staff/orders/order-review')
  await expect(page.getByRole('heading', { name: 'Staff sign in' })).toBeVisible()
})

test('401 redirects through the router, keeps the draft, and restores its route after login', async ({ page }) => {
  const fixture = await httpFixture(page)
  await signedIn(page, '/staff/sales/new')
  await page.getByRole('button', { name: /Add finished product/ }).click()
  const stored = await page.evaluate(() => sessionStorage.getItem('awg-sale-draft'))
  await page.evaluate(() => { (window as Window & { staffNavigationProbe?: string }).staffNavigationProbe = 'kept' })
  fixture.expireAgenda()
  await navigation(page, '/staff/agenda?date=2026-11-06')
  await expect(page).toHaveURL(/\/staff\/login\?.*expired=1/)
  await expect(page.getByText(/Session expired, sign in again/)).toBeVisible()
  expect(await page.evaluate(() => (window as Window & { staffNavigationProbe?: string }).staffNavigationProbe)).toBe('kept')
  expect(await page.evaluate(() => sessionStorage.getItem('awg-sale-draft'))).toBe(stored)
  await page.getByLabel('Email', { exact: true }).fill(staffUser.email)
  await page.getByLabel('Password', { exact: true }).fill('correct-staff-password')
  // Do not hit the deliberately expired agenda again after authentication.
  await page.route('**/api/agenda/days', route => route.fulfill({ json: [] }))
  await page.getByRole('button', { name: /Enter|Sign in/ }).click()
  await expect(page).toHaveURL(/\/staff\/agenda\?date=2026-11-06$/)
})

test('a fresh sale consumes the query once, survives reload, and sends a new HTTP idempotency key', async ({ page }) => {
  const fixture = await httpFixture(page)
  await signedIn(page, '/staff/sales/new')
  await newFinishedSale(page)
  await expect.poll(() => fixture.saleRequests.length).toBe(1)
  const first = fixture.saleRequests[0]
  await page.locator('a[href="/staff/sales/new?fresh=1"]:visible').first().click()
  await expect(page).toHaveURL(/\/staff\/sales\/new$/)
  await page.getByRole('button', { name: /Add finished product/ }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('awg-sale-draft')!).items.length)).toBe(1)
  const secondKey = await page.evaluate(() => JSON.parse(sessionStorage.getItem('awg-sale-draft')!).idempotencyKey)
  expect(secondKey).toBeTruthy()
  expect(secondKey).not.toBe(first.key)
  await page.reload()
  await expect(page.getByRole('heading', { name: /Finished 1/ })).toBeVisible()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('radio', { name: 'Paid', exact: true }).locator('..').click()
  await page.getByRole('radio', { name: 'Cash', exact: true }).locator('..').click()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect.poll(() => fixture.saleRequests.length).toBe(2)
  expect(fixture.saleRequests[1].key).toBe(secondKey)
  expect(fixture.saleRequests[1].id).not.toBe(first.id)
  await expect(page.getByRole('link', { name: 'Open order', exact: true })).toHaveAttribute('href', `/staff/orders/${fixture.saleRequests[1].id}`)
  await axe(page)
})

test('custom calendar sale reaches QR, and fresh starts a second custom order with its own payment', async ({ page }) => {
  const fixture = await httpFixture(page)
  await signedIn(page, `/staff/sales/new?date=${today}&start=13&end=14`)
  await expect(page.getByRole('heading', { name: /Custom 1/ })).toBeVisible()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByText(/Paint time selected/)).toBeVisible()
  await page.getByRole('button', { name: 'Create order & show QR', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Enlarge customer QR code', exact: true })).toBeVisible()
  await expect.poll(() => fixture.saleRequests.length).toBe(1)
  const first = fixture.saleRequests[0]
  expect(first.input.items).toEqual([expect.objectContaining({ kind: 'custom', paintDate: today, paintStart: 13, paintEnd: 14, deliveryKind: 'market', pickupHour: 14 })])
  await expect(page.getByRole('complementary').filter({ has: page.getByRole('heading', { name: 'Order summary', exact: true }) })).toContainText(fixture.records.get(first.id)!.code)
  await axe(page)

  // Leave the first order at QR. This was the critical same-mounted-component
  // path that used to send the first order's idempotency key again.
  await page.locator('a[href="/staff/sales/new?fresh=1"]:visible').first().click()
  await expect(page).toHaveURL(/\/staff\/sales\/new$/)
  await page.getByRole('button', { name: /Add custom ornament/ }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.route('**/api/agenda/capacity', route => route.fulfill({ json: { ok: true, slot: { date: today, startHour: 14, endHour: 15 }, remainingHours: 3, message: 'Available' } }))
  await page.getByRole('button', { name: '17:00', exact: true }).click()
  const create = page.getByRole('button', { name: 'Create order & show QR', exact: true })
  await expect(create).toBeEnabled()
  await create.click()
  await expect(page.getByRole('button', { name: 'Enlarge customer QR code', exact: true })).toBeVisible()
  await expect.poll(() => fixture.saleRequests.length).toBe(2)
  const second = fixture.saleRequests[1]
  expect(second.key).not.toBe(first.key)
  expect(second.id).not.toBe(first.id)
  expect(second.input.items).toEqual([expect.objectContaining({ kind: 'custom', paintDate: today, paintStart: 14, paintEnd: 15, deliveryKind: 'market', pickupHour: 17 })])
  await page.getByRole('button', { name: 'Continue to payment', exact: true }).click()
  await page.getByRole('radio', { name: 'Deposit', exact: true }).locator('..').click()
  await page.getByRole('radio', { name: 'Cash', exact: true }).locator('..').click()
  await page.getByLabel('Deposit received (€)', { exact: true }).fill('20')
  const markDeposit = page.getByRole('button', { name: /^Mark deposit/ })
  await expect(markDeposit).toHaveText(/Mark deposit.*20[.,]00/)
  await markDeposit.click()
  await expect(page.getByRole('link', { name: 'Open order', exact: true })).toHaveAttribute('href', `/staff/orders/${second.id}`)
  expect(fixture.records.get(second.id)?.amountPaid).toBe(20)
  expect(fixture.records.get(first.id)?.amountPaid).toBe(0)
  expect(fixture.mutations.filter(entry => entry.path.endsWith('/payment-state')).map(entry => entry.path)).toEqual([`/api/orders/${second.id}/payment-state`])
  await axe(page)
})

test('staff totals use server prices, stock is explicit, and deposit records the displayed amount', async ({ page }) => {
  const fixture = await httpFixture(page)
  await signedIn(page, '/staff/sales/new')
  // Explicitly prepare a sold-out combination through the API, never the seed.
  await page.evaluate(async () => {
    const path = '/src/api/client.ts'
    const { api } = await import(path)
    const rows = await api.inventory.list()
    const matteGreen = rows.find((row: { color?: string; finish?: string }) => row.color === 'green' && row.finish === 'matte')!
    await api.inventory.update(matteGreen.id, 0, matteGreen.quantity)
  })
  await page.getByRole('button', { name: /Add custom ornament/ }).click()
  await expect(page.getByRole('heading', { name: /Custom 1/ })).toContainText('57')
  await expect(page.getByRole('radio', { name: /^Green/ }).locator('..')).toContainText('3 left')
  await page.getByRole('radio', { name: /^Green/ }).locator('..').click()
  const matte = page.getByRole('radio', { name: /^Matte/ })
  await expect(matte).toBeDisabled()
  await expect(matte.locator('..')).toContainText(/Sold out|0 left/)
  await expect(page.getByRole('radio', { name: /^Shiny/ }).locator('..')).toContainText('3 left')
  await page.getByRole('checkbox', { name: /Add name on ornament/ }).check()
  await expect(page.getByRole('heading', { name: /Custom 1/ })).toContainText('71')
  await expect(page.getByRole('radio', { name: '1 h 15', exact: true })).toBeChecked()
  await page.getByRole('button', { name: 'Start over', exact: true }).click()
  await page.getByRole('button', { name: /Add finished product/ }).click()
  await expect(page.getByRole('heading', { name: /Finished 1/ })).toContainText('41')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByLabel(/Deposit received/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeDisabled()
  await page.getByRole('radio', { name: 'Deposit', exact: true }).locator('..').click()
  await page.getByRole('radio', { name: 'Cash', exact: true }).locator('..').click()
  await page.getByLabel(/Deposit received/).fill('17.50')
  await page.getByRole('button', { name: /Done|Mark deposit/ }).filter({ hasText: /Done|17[.,]50/ }).click()
  const balance = page.getByRole('dialog', { name: 'Balance due', exact: true })
  await expect(balance).toBeVisible()
  await expect(balance).toContainText(/23[.,]50/)
  await balance.getByRole('button', { name: 'Save without handover', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Open order', exact: true })).toBeVisible()
  expect(fixture.mutations.some(entry => entry.path.endsWith('/handed-over'))).toBe(false)
  await expect.poll(() => fixture.mutations.some(entry => entry.path.endsWith('/payment-state') && (entry.body as { amountPaid: number }).amountPaid === 17.5)).toBe(true)
})

test.describe('Vienna live clock and HTTP refresh', () => {
  test.use({ timezoneId: 'Pacific/Honolulu' })
  test('ticks each minute in Vienna and refetches on interval and window focus', async ({ page }) => {
    const fixture = await httpFixture(page, { controlledClock: true })
    await signedIn(page, `/staff/agenda?date=${today}&view=calendar`)
    const marker = page.locator('[data-now]')
    await expect(marker).toHaveAttribute('data-now', '10:00')
    await expect(marker).toHaveAccessibleName('Current time 10:00 in Vienna')
    const beforeMinute = fixture.dayReads
    await page.clock.fastForward(60_000)
    await expect(marker).toHaveAttribute('data-now', '10:01')
    await expect.poll(() => fixture.dayReads).toBeGreaterThan(beforeMinute)
    const beforeFocus = fixture.dayReads
    fixture.items.get(fixture.original.id)!.petName = 'Milo'
    await page.evaluate(() => dispatchEvent(new Event('focus')))
    await expect.poll(() => fixture.dayReads).toBeGreaterThan(beforeFocus)
    const block = page.locator('[data-slot-id="block-review"]')
    await expect(block).toHaveAccessibleName(/^Milo,/)
    const grid = await block.locator('..').boundingBox()
    expect(grid).not.toBeNull()
    const hourHeight = grid!.height / (marketDay.closeHour - marketDay.openHour)
    await page.mouse.click(grid!.x + grid!.width / 2, grid!.y + hourHeight + 2)
    const proposal = page.getByRole('dialog', { name: 'New paint session', exact: true })
    await expect(proposal).toBeVisible()
    await expect(proposal.getByLabel('Paint start', { exact: true })).toHaveValue('11:00')
    await expect(page.getByText('That time has already passed.', { exact: true })).toHaveCount(0)
  })
})

test('Save move refetches the HTTP agenda and renders the new position', async ({ page }) => {
  const fixture = await httpFixture(page)
  await signedIn(page, `/staff/agenda?date=${today}&view=calendar`)
  const block = page.locator('[data-slot-id="block-review"]')
  await expect(block).toHaveAccessibleName(/12:00–13:00/)
  await page.getByRole('button', { name: 'Move sessions', exact: true }).click()
  const bounds = await block.boundingBox()
  expect(bounds).not.toBeNull()
  const grid = block.locator('..')
  const gridBounds = await grid.boundingBox()
  expect(gridBounds).not.toBeNull()
  const hourHeight = gridBounds!.height / (marketDay.closeHour - marketDay.openHour)
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2)
  await page.mouse.down()
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2 + 2 * hourHeight, { steps: 8 })
  await page.mouse.up()
  await expect(page.getByRole('button', { name: 'Save move', exact: true })).toBeVisible()
  const reads = fixture.dayReads
  await page.getByRole('button', { name: 'Save move', exact: true }).click()
  await expect.poll(() => fixture.dayReads).toBeGreaterThan(reads)
  await expect(block).toHaveAccessibleName(/14:00–15:00/)
  await expect(page.getByRole('button', { name: 'Save move', exact: true })).toHaveCount(0)
  expect(fixture.mutations.filter(entry => entry.path === '/api/agenda/blocks/block-review')).toEqual([{ path: '/api/agenda/blocks/block-review', body: { date: today, startHour: 14 } }])
  await axe(page)
})

test('search encodes code, customer name and phone and opens the returned order', async ({ page }) => {
  const fixture = await httpFixture(page)
  await signedIn(page)
  await page.getByRole('searchbox', { name: 'Search orders', exact: true }).fill('Alex & +43')
  await page.getByRole('searchbox', { name: 'Search orders', exact: true }).press('Enter')
  await expect(page.getByRole('heading', { name: 'Search orders', exact: true })).toBeVisible()
  await expect.poll(() => fixture.searches).toContain('Alex & +43')
  await page.getByRole('link', { name: /AWGREVIEW/ }).click()
  await expect(page.getByRole('heading', { name: 'AWGREVIEW', exact: true })).toBeVisible()
})

test('attention badge opens REVIEW orders and PENDING holds stay visible without customer data', async ({ page }) => {
  await httpFixture(page, { held: true, attention: true })
  await signedIn(page, `/staff/agenda?date=${today}&view=calendar`)
  const hold = page.locator('[data-held="true"]')
  await expect(hold).toBeVisible()
  await expect(hold).toContainText(/Held.*web checkout/i)
  await expect(hold).not.toContainText('Alex')
  await expect(hold).not.toContainText('Luna')
  await expect.poll(() => hold.evaluate(node => getComputedStyle(node).backgroundImage)).toMatch(/gradient/)
  const attention = page.getByRole('link', { name: /Needs attention/ }).first()
  await expect(attention).toContainText('(1)')
  await attention.click()
  await expect(page.getByRole('heading', { name: 'Needs attention', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /AWGREVIEW/ })).toContainText(/review/i)
  await axe(page)
})

test('handover with balance due requires confirmation and can mark paid before handing over', async ({ page }) => {
  const fixture = await httpFixture(page, { finished: true })
  await signedIn(page, `/staff/orders/${fixture.original.id}`)
  await page.getByRole('button', { name: 'Mark picked up', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Balance due', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText(/37[.,]00/)
  expect(fixture.mutations.some(entry => entry.path.endsWith('/handed-over'))).toBe(false)
  await axe(page)
  await dialog.getByRole('button', { name: /Cancel|Keep order/ }).click()
  expect(fixture.original.handedOver).toBe(false)
  await page.getByRole('button', { name: 'Mark picked up', exact: true }).click()
  await dialog.getByRole('radio', { name: 'Cash', exact: true }).locator('..').click()
  await dialog.getByRole('button', { name: /Mark paid.*hand over/i }).click()
  await expect(page.getByRole('button', { name: 'Undo pickup', exact: true })).toBeVisible()
  const payment = fixture.mutations.findIndex(entry => entry.path.endsWith('/payment-state'))
  const handover = fixture.mutations.findIndex(entry => entry.path.endsWith('/handed-over'))
  expect(payment).toBeGreaterThanOrEqual(0)
  expect(handover).toBeGreaterThan(payment)
  await expect(page.getByRole('button', { name: 'Cancel order', exact: true })).toBeDisabled()
})

test('delivery rows show the amount to collect before handover', async ({ page }) => {
  await httpFixture(page, { finished: true })
  await signedIn(page, `/staff/deliveries?day=${today}`)
  await expect(page.getByText(/Collect.*37[.,]00/)).toBeVisible()
  await page.getByRole('button', { name: /Mark picked up|Picked up/ }).click()
  await expect(page.getByRole('dialog', { name: 'Balance due', exact: true })).toBeVisible()
})

test('payment corrections are disclosed explicitly and retain a precise server error', async ({ page }) => {
  const fixture = await httpFixture(page, { finished: true })
  await signedIn(page, `/staff/orders/${fixture.original.id}`)
  await expect(page.getByRole('button', { name: /^Correct to/ })).toBeHidden()
  await page.locator('summary').filter({ hasText: /^Correct payment/ }).click()
  await page.getByRole('group', { name: 'Corrected payment state', exact: true }).getByRole('radio', { name: 'Unpaid', exact: true }).locator('..').click()
  const unpaid = page.getByRole('button', { name: 'Correct to unpaid', exact: true })
  await expect(unpaid).toBeVisible()
  fixture.rejectMutations('PAYMENT_PENDING', 'Check this payment in Stripe first: checkout is still open.')
  page.once('dialog', dialog => dialog.accept())
  await unpaid.click()
  await expect(page.getByRole('alert')).toHaveText('Check this payment in Stripe first: checkout is still open.')
  await expect(page.getByRole('alert')).toHaveCount(1)
})

test('pending web payments cannot be manually collected or painted from the order page', async ({ page }) => {
  const fixture = await httpFixture(page, { checkoutStatus: 'pending' })
  await signedIn(page, `/staff/orders/${fixture.original.id}`)
  await expect(page.getByText(/Waiting for online payment/).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /^Mark paid/ })).toHaveCount(0)
  const start = page.getByRole('button', { name: 'Start painting', exact: true })
  if (await start.count()) await expect(start).toBeDisabled()
  expect(fixture.mutations).toHaveLength(0)
  await axe(page)
})

test('cancel explains received money and started painting, and changes nothing until confirmed', async ({ page }) => {
  const fixture = await httpFixture(page)
  fixture.items.get(fixture.original.id)!.productionStatus = 'in_progress'
  await signedIn(page, `/staff/orders/${fixture.original.id}`)
  await page.getByRole('button', { name: 'Cancel order', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Cancel order?', exact: true })
  await expect(dialog).toContainText(/20[.,]00/)
  await expect(dialog).toContainText(/painting|in progress/i)
  expect(fixture.records.has(fixture.original.id)).toBe(true)
  await axe(page)
  await dialog.getByRole('button', { name: 'Keep order', exact: true }).click()
  expect(fixture.mutations).toHaveLength(0)
  await page.getByRole('button', { name: 'Cancel order', exact: true }).click()
  await dialog.getByRole('button', { name: 'Cancel order', exact: true }).click()
  await expect(page).toHaveURL(/\/staff\/agenda$/)
  expect(fixture.records.has(fixture.original.id)).toBe(false)
})

test('last ornament completion uses the same confirmation in the paint workspace', async ({ page }) => {
  const fixture = await httpFixture(page, { missingForm: true })
  await signedIn(page, `/staff/orders/${fixture.original.id}/paint/${fixture.original.itemIds[0]}`)
  await expect(page.getByText(/matte/i)).toBeVisible()
  let confirmationMessage = ''
  page.once('dialog', async dialog => { confirmationMessage = dialog.message(); await dialog.accept() })
  await page.getByRole('button', { name: 'Mark finished', exact: true }).click()
  expect(confirmationMessage).toMatch(/missing.*form details or photos/i)
  const dialog = page.getByRole('dialog', { name: /Complete order/ })
  await expect(dialog).toBeVisible()
  expect(fixture.mutations.filter(entry => entry.path.endsWith('/status'))).toHaveLength(0)
  await axe(page)
})

test('customer handoff removes staff access before opening the public form', async ({ page }) => {
  const fixture = await httpFixture(page, { missingForm: true })
  await signedIn(page, `/staff/orders/${fixture.original.id}`)
  await page.getByRole('button', { name: 'Open customer form', exact: true }).click()
  const handoff = page.getByRole('dialog', { name: 'Hand iPad to customer?', exact: true })
  await expect(handoff).toBeVisible()
  await expect(handoff).toContainText(/signs staff out/i)
  await axe(page)
  await handoff.getByRole('button', { name: 'Sign out & open form', exact: true }).click()
  await expect(page).toHaveURL(/\/form\/form-order-review\?staff=1$/)
  expect(await page.evaluate(() => localStorage.getItem('awg-staff-token'))).toBeNull()
  await page.goBack()
  await expect(page.getByRole('navigation', { name: /^Staff(?: tabs)?$/ })).toHaveCount(0)
  await expect(page.getByRole('searchbox', { name: 'Search orders', exact: true })).toHaveCount(0)
  await page.goto(`/staff/orders/${fixture.original.id}`)
  await expect(page.getByRole('heading', { name: 'Staff sign in' })).toBeVisible()
})

test('deleting a market requires confirmation; day deletion is staged until Save', async ({ page }) => {
  const fixture = await httpFixture(page)
  await signedIn(page, `/staff/markets/${spareMarket.id}`)
  await page.getByRole('button', { name: 'Delete day', exact: true }).first().click()
  const dayDialog = page.getByRole('dialog', { name: 'Delete day?', exact: true })
  await expect(dayDialog).toBeVisible()
  await dayDialog.getByRole('button', { name: /Delete day|Remove day/ }).click()
  await expect(page.getByRole('button', { name: 'Delete day', exact: true })).toHaveCount(2)
  expect(fixture.mutations).toHaveLength(0)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Market updated', exact: true })).toBeVisible()
  expect(fixture.mutations.find(entry => entry.path === '/api/markets')?.body).toMatchObject({ id: spareMarket.id, days: expect.arrayContaining([expect.objectContaining({ date: '2026-12-05' }), expect.objectContaining({ date: '2026-12-06' })]) })
  await page.getByRole('button', { name: 'Delete market', exact: true }).click()
  const marketDialog = page.getByRole('dialog', { name: 'Delete market?', exact: true })
  await expect(marketDialog).toBeVisible()
  expect(fixture.mutations.some(entry => entry.path === `/api/markets/${spareMarket.id}`)).toBe(false)
  await axe(page)
  await marketDialog.getByRole('button', { name: /Keep market|Cancel/ }).click()
  await expect(page.getByRole('heading', { name: spareMarket.name, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Delete market', exact: true }).click()
  await marketDialog.getByRole('button', { name: 'Delete market', exact: true }).click()
  await expect(page).toHaveURL(/\/staff\/markets$/)
  expect(fixture.mutations.some(entry => entry.path === `/api/markets/${spareMarket.id}`)).toBe(true)
})

const staffPages = [
  { path: '/staff/login', heading: 'Staff sign in', anonymous: true },
  { path: '/staff/agenda', heading: 'Agenda' },
  { path: '/staff/deliveries', heading: 'Deliveries' },
  { path: '/staff/sales/new', heading: 'New sale' },
  { path: '/staff/orders/order-review', heading: 'AWGREVIEW' },
  { path: '/staff/orders/order-review/paint/item-order-review', heading: 'Luna' },
  { path: '/staff/inventory', heading: /Stock/ },
  { path: '/staff/painting-days', heading: 'Painting days' },
  { path: '/staff/markets', heading: 'Markets' },
  { path: '/staff/markets/new', heading: 'New market' },
  { path: `/staff/markets/${spareMarket.id}`, heading: spareMarket.name },
  { path: '/staff/password', heading: 'Change password' },
  { path: '/staff/search?q=Alex', heading: 'Search orders' },
  { path: '/staff/attention', heading: 'Needs attention' },
]
for (const view of staffPages) {
  test(`zero axe violations and no horizontal overflow: ${view.path}`, async ({ page }) => {
    await httpFixture(page, { attention: true })
    if (view.anonymous) await page.route('**/api/staff/me', route => route.fulfill({ status: 401, json: { message: 'Session expired.' } }))
    await page.goto(view.path)
    await expect(page.getByRole('heading', { name: view.heading, exact: true })).toBeVisible()
    // Wait for data-backed page state before measuring it.
    await expect(page.getByText(/^(Loading|Searching orders)/)).toHaveCount(0)
    await page.evaluate(() => document.fonts.ready)
    await axe(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('portrait navigation exposes five reachable bottom tabs and Painting days in More', async ({ page }) => {
  await httpFixture(page)
  await signedIn(page)
  if (page.viewportSize()!.width >= 1100) {
    await page.getByRole('button', { name: 'More', exact: true }).click()
    await expect(page.getByRole('navigation', { name: 'More staff tools', exact: true }).getByRole('link', { name: 'Painting days', exact: true })).toBeVisible()
    return
  }
  const tabs = page.getByRole('navigation', { name: /Staff tabs|Staff navigation|Quick navigation/ })
  await expect(tabs).toBeVisible()
  for (const name of ['Agenda', 'Deliveries', 'New sale', 'Search']) {
    const link = tabs.getByRole('link', { name, exact: true })
    await expect(link).toBeVisible()
    const box = await link.boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }
  await tabs.getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('navigation', { name: 'More staff tools', exact: true }).getByRole('link', { name: 'Painting days', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Painting days', exact: true })).toBeVisible()
  await axe(page)
})


test.describe('390px phone staff layout', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })
  test('core staff pages reflow without horizontal clipping and keep bottom navigation reachable', async ({ page }) => {
    test.slow()
    await httpFixture(page, { attention: true })
    const views = [
      { path: `/staff/agenda?date=${today}&view=calendar`, heading: 'Agenda' },
      { path: '/staff/sales/new', heading: 'New sale' },
      { path: '/staff/orders/order-review', heading: 'AWGREVIEW' },
      { path: '/staff/inventory', heading: 'Stock' },
      { path: `/staff/markets/${spareMarket.id}`, heading: spareMarket.name },
      { path: '/staff/search?q=Alex', heading: 'Search orders' },
      { path: '/staff/orders/order-review/paint/item-order-review', heading: 'Luna' },
    ]
    for (const view of views) {
      await page.goto(view.path)
      await expect(page.getByRole('heading', { name: view.heading, exact: true })).toBeVisible()
      await expect(page.getByText(/^(Loading|Searching orders)/)).toHaveCount(0)
      await page.evaluate(() => document.fonts.ready)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      if (!view.path.includes('/paint/')) {
        const tabs = page.getByRole('navigation', { name: 'Staff tabs', exact: true })
        await expect(tabs).toBeVisible()
        const bounds = await tabs.boundingBox()
        expect(bounds!.x).toBeGreaterThanOrEqual(0)
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
        await expect(tabs.getByRole('link', { name: 'New sale', exact: true })).toBeInViewport({ ratio: 1 })
      }
      await axe(page)
    }
  })
})
