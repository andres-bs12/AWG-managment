import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import type { AgendaDay, CreateSaleInput, Market, MarketDay, PaintingDay, ShippingQuote } from '../src/domain/types'
import { shippingWindowAfter } from '../src/lib/postShipping'
import { axe } from './helpers'
import { config, staffUser } from './staff-fixture'

const postShotsDir = path.resolve(process.cwd(), '../tasks/audit-results/post-shipping-staff-shots')
const PET_SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="12" fill="#e9d8c3"/><circle cx="48" cy="52" r="24" fill="#8b5a3c"/><circle cx="38" cy="48" r="4" fill="#152033"/><circle cx="58" cy="48" r="4" fill="#152033"/><ellipse cx="48" cy="57" rx="5" ry="3.5" fill="#152033"/></svg>')

async function setupCalendarWorld(page: Page, initialIso = '2026-11-28T13:00:00Z', options?: {
  activeMarketId?: string
  sundayFull?: boolean
  saturdayFull?: boolean
  finishedWithCustom?: boolean
  postWindowOverride?: (readyOn: string) => ShippingQuote
  makeRoomHandler?: (body: { date: string; minutes: number; marketDayId?: string }, key: string) => { status: number; json: unknown }
  saturdaySlots?: AgendaDay['slots']
}) {
  await page.clock.install({ time: new Date(initialIso) })
  await page.addInitScript((marketId) => {
    localStorage.setItem('awg-staff-token', 'staff-review-session')
    localStorage.setItem('awg-active-market-id', marketId)
  }, options?.activeMarketId ?? 'mkt-rathaus')
  await page.route('**/src/api/mock/entry.ts', route => route.fulfill({ contentType: 'application/javascript', body: "export { httpApi as selectedApi } from '/src/api/http/services.ts'" }))
  await page.route('**/src/api/mock/demo.ts', route => route.fulfill({ contentType: 'application/javascript', body: "export * from '/src/api/http/demo.ts'" }))

  const markets: Market[] = [
    { id: 'mkt-rathaus', name: 'Rathausplatz', kind: 'market', totalCost: 2400, startDate: '2026-11-28', finishDate: '2026-12-06', stall: 12 },
    { id: 'mkt-spittelberg', name: 'Christkindlmarkt Spittelberg', kind: 'market', totalCost: 900, startDate: '2026-11-28', finishDate: '2026-11-29', stall: 4 },
    { id: 'mkt-casa', name: 'Casa', kind: 'home', totalCost: 0, startDate: null, finishDate: null, stall: null },
  ]
  const marketDays: MarketDay[] = [
    { id: 'md-sat-r', marketId: 'mkt-rathaus', date: '2026-11-28', openHour: 12, closeHour: 19, isToday: true },
    { id: 'md-sat-s', marketId: 'mkt-spittelberg', date: '2026-11-28', openHour: 13, closeHour: 20, isToday: true },
    { id: 'md-sun-r', marketId: 'mkt-rathaus', date: '2026-11-29', openHour: 12, closeHour: 19, isToday: false },
    { id: 'md-sun-s', marketId: 'mkt-spittelberg', date: '2026-11-29', openHour: 13, closeHour: 20, isToday: false },
    { id: 'md-mon', marketId: 'mkt-casa', date: '2026-11-30', openHour: 10, closeHour: 13, isToday: false },
    { id: 'md-wed', marketId: 'mkt-casa', date: '2026-12-02', openHour: 10, closeHour: 12, isToday: false },
    { id: 'md-fri-r', marketId: 'mkt-rathaus', date: '2026-12-04', openHour: 12, closeHour: 19, isToday: false },
  ]
  const paintingDays: PaintingDay[] = [
    { date: '2026-11-28', open: true, maxPaintings: 6, booked: options?.saturdayFull ? 6 : 0, openHour: 12, closeHour: 19, paintingMarketId: 'mkt-rathaus', paintingMarketName: 'Rathausplatz' },
    { date: '2026-11-29', open: true, maxPaintings: 6, booked: options?.sundayFull ? 6 : 0, openHour: 12, closeHour: 19, paintingMarketId: 'mkt-rathaus', paintingMarketName: 'Rathausplatz' },
    { date: '2026-11-30', open: true, maxPaintings: 3, booked: 0, openHour: 10, closeHour: 13, paintingMarketId: null, paintingMarketName: null },
    { date: '2026-12-02', open: true, maxPaintings: 2, booked: 0, openHour: 10, closeHour: 12, paintingMarketId: null, paintingMarketName: null },
    { date: '2026-12-04', open: true, maxPaintings: 6, booked: 0, openHour: 12, closeHour: 19, paintingMarketId: 'mkt-rathaus', paintingMarketName: 'Rathausplatz' },
  ]
  const inventory = config.colors.map((row, index) => ({ id: `stock-${index}`, kind: 'custom', color: row.color, finish: row.finish, quantity: 5 }))
  const marketPieces = [{ id: 'RM01', status: 'painted', soldAt: null, revision: 0, hasUploadedPhoto: false, orderId: null, orderCode: null }]
  const sales: CreateSaleInput[] = []
  const capacityCalls: Array<{ date: string; durationHours: number; beforeHour?: number; handoffMarketDayId?: string }> = []
  const handedOverCalls: Array<{ id: string; body: unknown }> = []

  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request()
    const url = new URL(req.url())
    const pathName = url.pathname
    if (pathName === '/api/staff/me') return route.fulfill({ json: staffUser })
    if (pathName === '/api/orders/attention') return route.fulfill({ json: [] })
    if (pathName === '/api/shop/config') return route.fulfill({ json: { ...config, deliveryFee: 5 } })
    if (pathName === '/api/prices') {
      return route.fulfill({
        json: {
          customPrice: config.customPrice,
          finishedPrice: config.finishedPrice,
          nameExtra: config.nameExtra,
          shippingFee: 5,
          postCollectionDays: ['tuesday', 'friday'],
          finishedWithCustom: options?.finishedWithCustom ?? true,
          revision: 0,
        },
      })
    }
    if (pathName === '/api/shipping/window' && req.method() === 'POST') {
      const body = req.postDataJSON() as { readyOn: string }
      const quote = options?.postWindowOverride ? options.postWindowOverride(body.readyOn) : shippingWindowAfter(body.readyOn)
      return route.fulfill({ json: quote })
    }
    if (pathName === '/api/agenda/make-room' && req.method() === 'POST') {
      const body = req.postDataJSON() as { date: string; minutes: number; marketDayId?: string }
      const key = req.headers()['idempotency-key'] ?? ''
      if (options?.makeRoomHandler) {
        const res = options.makeRoomHandler(body, key)
        return route.fulfill({ status: res.status, json: res.json })
      }
      return route.fulfill({ status: 409, json: { code: 'NO_MOVABLE_SESSION', reason: 'SAME_DAY_ONLY', message: "All of today's sessions are for pickups today, so none can be moved." } })
    }
    if (pathName === '/api/photos/pet-post') return route.fulfill({ contentType: 'image/svg+xml', body: PET_SVG })
    if (pathName === '/api/market-stock') return route.fulfill({ json: marketPieces })
    if (pathName === '/api/inventory') return route.fulfill({ json: inventory })
    if (pathName === '/api/markets') return route.fulfill({ json: markets })
    if (pathName === '/api/market-days') {
      return route.fulfill({ json: marketDays })
    }
    if (pathName === '/api/painting-days') return route.fulfill({ json: paintingDays })
    if (pathName === '/api/agenda/days') {
      const agenda: AgendaDay[] = ['2026-11-28', '2026-11-29', '2026-11-30', '2026-12-02', '2026-12-04'].map(date => {
        const onDate = marketDays.filter(d => d.date === date)
        const rule = paintingDays.find(p => p.date === date)!
        const primary = onDate.find(d => d.marketId === rule.paintingMarketId) ?? onDate[0]
        return {
          marketDay: primary,
          market: markets.find(m => m.id === primary.marketId)!,
          markets: onDate.map(d => markets.find(m => m.id === d.marketId)!),
          marketDays: onDate,
          paintingMarketId: rule.paintingMarketId ?? null,
          paintingMarketName: rule.paintingMarketName ?? null,
          slots: date === '2026-11-28' ? (options?.saturdaySlots ?? []) : [],
          deliveries: [],
        }
      })
      return route.fulfill({ json: agenda })
    }
    if (pathName === '/api/agenda/capacity') {
      const body = req.postDataJSON() as { date: string; durationHours: number; beforeHour?: number; handoffMarketDayId?: string }
      capacityCalls.push(body)
      const rule = paintingDays.find(p => p.date === body.date)
      if (!rule || !rule.open || rule.booked >= rule.maxPaintings) {
        return route.fulfill({ json: { ok: false, slot: null, remainingHours: 0, message: 'Painting day is closed or full.' } })
      }
      const start = body.date === '2026-11-28' ? 15 : rule.openHour
      const end = start + body.durationHours
      if (body.beforeHour != null && end > body.beforeHour + 0.001) {
        return route.fulfill({ json: { ok: false, slot: null, remainingHours: 0, message: 'No free paint slot before this handoff.' } })
      }
      return route.fulfill({ json: { ok: true, slot: { date: body.date, startHour: start, endHour: end }, remainingHours: 4, message: 'Suggested' } })
    }
    if (pathName === '/api/agenda/move-suggestion') return route.fulfill({ status: 204 })
    if (pathName === '/api/orders' && req.method() === 'POST') {
      const input = req.postDataJSON() as CreateSaleInput
      sales.push(input)
      return route.fulfill({
        status: 201,
        json: {
          id: `sale-${sales.length}`,
          customerId: 'cus-1',
          code: `AWGNEW${sales.length}`,
          trackToken: 'trk-1',
          formToken: `frm-${sales.length}`,
          paymentState: 'unpaid',
          paymentMethod: null,
          total: input.items.reduce((sum, r) => sum + (r.kind === 'finished' ? config.finishedPrice : config.customPrice), 0),
          amountPaid: 0,
          createdAt: '2026-11-28T14:00:00Z',
          itemIds: input.items.map((_, idx) => `item-${idx + 1}`),
          handedOver: false,
        },
      })
    }
    if (/^\/api\/orders\/[^/]+\/bundle$/.test(pathName)) {
      const last = sales.at(-1)
      return route.fulfill({
        json: {
          order: { id: `sale-${sales.length}`, customerId: 'cus-1', code: `AWGNEW${sales.length}`, trackToken: 'trk-1', formToken: `frm-${sales.length}`, paymentState: 'paid', paymentMethod: 'cash', total: 98, createdAt: '2026-11-28T14:00:00Z', itemIds: (last?.items ?? []).map((_, idx) => `item-${idx + 1}`), handedOver: false },
          customer: { id: 'cus-1', name: 'Walk-in', phone: '', email: '' },
          items: (last?.items ?? []).map((row, idx) => ({
            id: `item-${idx + 1}`,
            orderId: `sale-${sales.length}`,
            kind: row.kind,
            marketOrnamentId: row.marketOrnamentId ?? null,
            petName: '',
            withName: row.withName,
            backName: '',
            note: '',
            cost: row.kind === 'finished' ? config.finishedPrice : config.customPrice,
            productionStatus: row.kind === 'finished' ? 'finished' : 'not_started',
            handedOver: false,
            photos: [],
            formComplete: false,
            delivery: { kind: row.deliveryKind, marketDayId: row.marketDayId, marketId: row.marketId, pickupHour: row.pickupHour },
          })),
          blocks: [],
        },
      })
    }
    if (/^\/api\/orders\/[^/]+\/payment-state$/.test(pathName)) {
      return route.fulfill({ json: { id: 'sale-1', paymentState: 'paid' } })
    }
    if (/^\/api\/orders\/[^/]+\/handed-over$/.test(pathName)) {
      handedOverCalls.push({ id: pathName, body: req.postDataJSON() })
      return route.fulfill({ status: 204 })
    }
    return route.fulfill({ status: 501, json: { message: `Unstubbed ${req.method()} ${pathName}` } })
  })

  return { sales, capacityCalls, handedOverCalls }
}

test('Rule 1: calendar hold Sunday 15:00 skips Today, offers Sunday >= 16:15 or later days at painting stall', async ({ page }) => {
  // Saturday 2026-11-28 14:00 Vienna; holding Sunday 15:00-16:00 on Agenda (even while staff is at Spittelberg).
  const { sales } = await setupCalendarWorld(page, '2026-11-28T13:00:00Z', { activeMarketId: 'mkt-spittelberg' })
  await page.goto('/staff/sales/new?date=2026-11-29&start=15&end=16')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  // Do not ask "Today?" when paint date is Sunday.
  await expect(page.getByRole('radio', { name: /^Today/ })).toHaveCount(0)

  // Selected pickup defaults to Rathausplatz · Sun 29 Nov (where Gaby paints) and hours >= 16:15 (17:00, 18:00).
  const sunBtn = page.getByRole('button', { name: /Rathausplatz · Sun,? 29 Nov/ })
  await expect(sunBtn).toBeVisible()
  for (const early of ['12:00', '13:00', '14:00', '15:00', '16:00']) {
    await expect(page.getByRole('button', { name: early, exact: true })).toHaveCount(0)
  }
  await expect(page.getByRole('button', { name: '17:00', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: '18:00', exact: true })).toBeEnabled()

  // Earlier days (Sat 28 Nov) and non-painting Sunday stall (Spittelberg) never appear in market day choices.
  await sunBtn.click()
  await expect(page.locator('input[name^="day-"][value="md-sat-r"]')).toHaveCount(0)
  await expect(page.locator('input[name^="day-"][value="md-sat-s"]')).toHaveCount(0)
  await expect(page.locator('input[name^="day-"][value="md-sun-s"]')).toHaveCount(0)
  await expect(page.locator('input[name^="day-"][value="md-sun-r"]')).toBeChecked()
  await expect(page.locator('input[name^="day-"][value="md-fri-r"]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Close market day picker' }).click()

  // Rule 5: Post (+€5) shows the server collection & arrival range for the locked Sunday paint day,
  // and switching back to Market day preserves the locked Sunday 15:00-16:00 paint slot.
  await page.getByRole('radio', { name: 'Post (+€5)', exact: true }).locator('..').click()
  await expect(page.getByText('Post collection Tue 1 Dec · Arrives Thu 3 – Fri 4 Dec')).toBeVisible()
  // Switching back to Market day preserves the locked Sunday 15:00-16:00 paint slot.
  await page.getByRole('radio', { name: 'Market day', exact: true }).locator('..').click()
  await page.getByRole('radio', { name: /Rathausplatz · Sun,? 29 Nov/ }).locator('..').click()
  await expect(page.getByText(/Sun,? 29 Nov · 15:00–16:00/).first()).toBeVisible()
  await page.getByRole('button', { name: '17:00', exact: true }).click()

  await page.getByRole('button', { name: 'Create order & show QR', exact: true }).click()
  await expect.poll(() => sales.length).toBe(1)
  expect(sales[0].items[0]).toMatchObject({
    paintDate: '2026-11-29', paintStart: 15, paintEnd: 16, marketDayId: 'md-sun-r', pickupHour: 17,
  })
})

test('Rule 2 & 9: stale past paint slot is dropped with notice on open and never booked in the past', async ({ page }) => {
  // Saturday 2026-11-28 14:00 Vienna, opening a stale link for 13:00-14:00 today (already started/passed? test 12:00-13:00).
  await setupCalendarWorld(page, '2026-11-28T13:00:00Z')
  await page.goto('/staff/sales/new?date=2026-11-28&start=12&end=13')

  await expect(page.getByRole('status').filter({ hasText: /already passed/i })).toBeVisible()
  await expect(page.getByText('(from the board)')).toHaveCount(0)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  // Past hours (12:00, 13:00) do not appear; picking 17:00 plans a fresh future paint slot (15:00-16:00).
  await expect(page.getByRole('button', { name: '12:00', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '13:00', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '17:00', exact: true }).click()
  await expect(page.getByText(/Sat,? 28 Nov · 15:00–16:00/).first()).toBeVisible()

  // Reloading keeps draft cleanly, and Back -> Discard leaves no ghost items.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Pickup and paint', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('dialog', { name: 'Discard this sale?' }).getByRole('button', { name: 'Discard', exact: true }).click()
  await expect(page.getByRole('button', { name: /Add custom ornament/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Order summary' })).toHaveCount(0)
})

test('Rule 3: pickup-first checks capacity at least 15 min before pickup hour', async ({ page }) => {
  const { capacityCalls } = await setupCalendarWorld(page, '2026-11-28T13:00:00Z')
  await page.goto('/staff/sales/new')
  await page.getByRole('button', { name: /Add custom ornament/ }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('button', { name: '16:00', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: '17:00', exact: true }).click()
  await expect.poll(() => capacityCalls.some(c => c.date === '2026-11-28' && c.beforeHour === 16.75)).toBe(true)
})

test('Rule 7: mixed order shows Deliver now for finished while custom waits, and hands over finished on payment', async ({ page }) => {
  const { sales, handedOverCalls } = await setupCalendarWorld(page, '2026-11-28T13:00:00Z')
  await page.goto('/staff/sales/new')
  await page.getByRole('button', { name: /Add custom ornament/ }).click()
  await page.getByRole('button', { name: /Add finished/ }).click()
  await page.getByRole('list', { name: 'Ready ornaments' }).getByRole('button', { name: /^RM01 ·/ }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  const summary = page.getByRole('complementary').filter({ has: page.getByRole('heading', { name: 'Order summary' }) })
  await expect(summary).toContainText('Deliver now')
  await expect(summary).toContainText('Ready-made pieces go home now; custom pieces wait for their date.')

  await page.getByRole('button', { name: '17:00', exact: true }).click()
  await page.getByRole('button', { name: 'Create order & show QR', exact: true }).click()
  await page.getByRole('button', { name: 'Continue to payment', exact: true }).click()
  await page.getByRole('radio', { name: 'Cash', exact: true }).locator('..').click()
  await page.getByRole('button', { name: /^Mark paid/ }).click()

  await expect(page.getByRole('heading', { name: 'Sale recorded', exact: true })).toBeVisible()
  await expect(page.getByText(/Ready-made ornaments handed over now/)).toBeVisible()
  expect(sales).toHaveLength(1)
  expect(handedOverCalls).toHaveLength(1)
  expect(handedOverCalls[0].body).toEqual({ handedOver: true, itemIds: ['item-2'] })
})

test('Rule 10: sale opened at 23:50 and continued at 00:05 Vienna switches Today and drops yesterday', async ({ page }) => {
  // 2026-11-28 23:50 Vienna = 22:50Z
  const { sales } = await setupCalendarWorld(page, '2026-11-28T22:50:00Z')
  await page.goto('/staff/sales/new')
  await page.getByRole('button', { name: /Add custom ornament/ }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  // At 23:50 Saturday, Today has no open hours left -> next market day is Sun 29 Nov.
  await expect(page.getByRole('radio', { name: /^Today/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Sun,? 29 Nov/ })).toBeVisible()

  // Fast-forward 15 minutes across Vienna midnight to 2026-11-29 00:05 (still 23:05 UTC on 2026-11-28!).
  await page.clock.fastForward(15 * 60_000)

  // Now Sun 29 Nov IS Today, selected automatically; yesterday is gone and 14:00 (after 12:00-13:00 paint + 15 min) is enabled.
  const todayRadio = page.getByRole('radio', { name: 'Today', exact: true })
  await expect(todayRadio).toBeVisible()
  await expect(todayRadio).toBeChecked()
  await expect(page.getByRole('button', { name: '12:00', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: '14:00', exact: true })).toBeEnabled()

  await page.getByRole('button', { name: '14:00', exact: true }).click()
  await expect(page.getByText(/Sun,? 29 Nov · 12:00–13:00/).first()).toBeVisible()
  await page.getByRole('button', { name: 'Create order & show QR', exact: true }).click()
  await expect.poll(() => sales.length).toBe(1)
  expect(sales[0].items[0]).toMatchObject({ marketDayId: 'md-sun-r', paintDate: '2026-11-29', pickupHour: 14 })
})

test('Rule 6: finished-only order defaults to Deliver now with no painting step', async ({ page }) => {
  await setupCalendarWorld(page, '2026-11-28T13:00:00Z')
  await page.goto('/staff/sales/new')
  await page.getByRole('button', { name: /Add finished product/ }).click()
  await page.getByRole('list', { name: 'Ready ornaments' }).getByRole('button', { name: /^RM01 ·/ }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Painting plan' })).toHaveCount(0)
  await expect(page.getByRole('radio', { name: 'Deliver now', exact: true })).toBeChecked()
  await expect(page.getByText('Deliver now at the stall.', { exact: true })).toBeVisible()
})

test('Rule 4 & 8: full today explains why and multi-custom shared pickup uses latest locked slot', async ({ page }) => {
  const { sales } = await setupCalendarWorld(page, '2026-11-28T13:00:00Z', { saturdayFull: true })
  await page.goto('/staff/sales/new?date=2026-11-29&start=13&end=14')
  await page.getByRole('button', { name: /Add custom$/ }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  // Locked 13:00-14:00 on Sun 29 Nov forces earliest same-day hour to 15:00 for the whole order.
  await expect(page.getByRole('button', { name: '14:00', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '15:00', exact: true })).toHaveAttribute('aria-pressed', 'true')

  // Unchecking / having shared pickup lets 15:00 plan the second item before 15:00; verify both items save with valid paint slots.
  await page.getByRole('button', { name: '15:00', exact: true }).click()
  await page.getByRole('button', { name: 'Create order & show QR', exact: true }).click()
  await expect.poll(() => sales.length).toBe(1)
  expect(sales[0].items).toHaveLength(2)
  expect(sales[0].items[0]).toMatchObject({ paintDate: '2026-11-29', paintStart: 13, paintEnd: 14, marketDayId: 'md-sun-r', pickupHour: 15 })
  expect(sales[0].items[1].paintDate).toBe('2026-11-29')
})

test('Rule 8: full today explains why and offers next valid market day without dead end', async ({ page }) => {
  await setupCalendarWorld(page, '2026-11-28T13:00:00Z', { saturdayFull: true })
  await page.goto('/staff/sales/new')
  await page.getByRole('button', { name: /Add custom ornament/ }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  await expect(page.getByRole('radio', { name: 'Today · full', exact: true })).toBeDisabled()
  await expect(page.getByRole('status').filter({ hasText: /Today is full \(6\/6 paintings booked\)/ })).toBeVisible()
  await expect(page.locator('input[name^="day-"][value="md-sun-r"]')).toBeVisible()
})

test('Post shipping in New sale: server range, finished-with-custom rule, address validation, single €5 fee and cutoff', async ({ page }, testInfo) => {
  const { sales } = await setupCalendarWorld(page, '2026-11-28T13:00:00Z')
  await page.goto('/staff/sales/new')
  await page.getByRole('button', { name: /Add custom ornament/ }).click()
  await page.getByRole('button', { name: /Add finished/ }).click()
  await page.getByRole('button', { name: /^RM01 ·/ }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  // Before the custom ornament uses Post, the finished ornament's Post radio is disabled.
  const finishedPost = page.getByRole('radio', { name: 'Post', exact: true })
  await expect(finishedPost).toBeDisabled()

  // Choose Post (+€5) on the custom ornament.
  await page.getByRole('radio', { name: 'Post (+€5)', exact: true }).locator('..').click()
  await expect(page.getByText('Post collection Tue 1 Dec · Arrives Thu 3 – Fri 4 Dec')).toBeVisible()
  await expect(finishedPost).toBeEnabled()
  await finishedPost.locator('..').click()

  // Summary includes one €5 shipping fee (57 + 41 + 5 = €103.00).
  await expect(page.getByText('Post shipping', { exact: true })).toBeVisible()
  await expect(page.locator('aside')).toContainText('€5.00')
  await expect(page.locator('aside')).toContainText('€103.00')

  // Validate address form and fill valid Austrian address.
  await page.getByRole('button', { name: 'Create order & show QR', exact: true }).click()
  await expect(page.getByText('Enter the street and house number.')).toBeVisible()
  await page.getByLabel('Street and house number', { exact: true }).fill('Herrengasse 14')
  await page.getByLabel('Staircase / door (optional)', { exact: true }).fill('Top 3')
  await page.getByLabel('Postcode', { exact: true }).fill('8010')
  await page.getByLabel('City', { exact: true }).fill('Graz')

  if (testInfo.project.name === 'ipadLandscape' || testInfo.project.name === 'staff-phone-360x640') {
    fs.mkdirSync(postShotsDir, { recursive: true })
    const tag = testInfo.project.name === 'ipadLandscape' ? 'ipad-1180' : 'phone-360'
    await page.screenshot({ path: path.join(postShotsDir, `new-sale-post-${tag}.png`), fullPage: true })
  }

  await axe(page)
  await page.getByRole('button', { name: 'Create order & show QR', exact: true }).click()
  await expect.poll(() => sales.length).toBe(1)
  expect(sales[0].items).toHaveLength(2)
  expect(sales[0].items.every(item => item.deliveryKind === 'post')).toBe(true)
  expect(sales[0].items[0].address).toEqual({ line1: 'Herrengasse 14', line2: 'Top 3', postalCode: '8010', city: 'Graz' })
})

test('Post shipping disabled after cutoff with clear notice', async ({ page }) => {
  await setupCalendarWorld(page, '2026-11-28T13:00:00Z', {
    postWindowOverride: () => ({ available: false, collectionDate: null, arrivalFrom: null, arrivalTo: null }),
  })
  await page.goto('/staff/sales/new')
  await page.getByRole('button', { name: /Add custom ornament/ }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('radio', { name: 'Post (+€5)', exact: true })).toBeDisabled()
  await expect(page.getByText('Arrives after 23 Dec — choose market pickup')).toBeVisible()
  await axe(page)
})

test('Make room today in New sale: idempotent move, confirmation popup, and SAME_DAY_ONLY / Gaby-away corner cases', async ({ page }, testInfo) => {
  const keys: string[] = []
  let failSameDay = false
  const saturdaySlots: AgendaDay['slots'] = [{
    photoUrl: '/api/photos/pet-post',
    block: { id: 'blk-post-1', marketDayId: 'md-sat-r', orderItemId: 'orn-post-1', startHour: 14, endHour: 15, status: 'not_started' },
    order: { id: 'ord-p1', customerId: 'c1', code: 'AWG0103', trackToken: 't1', formToken: 'f1', paymentState: 'paid', paymentMethod: 'card', total: 55, createdAt: '2026-11-28T09:00:00', itemIds: ['orn-post-1'], handedOver: false },
    item: { id: 'orn-post-1', orderId: 'ord-p1', kind: 'custom', marketOrnamentId: null, petName: 'Anna', withName: false, color: 'red', finish: 'shiny', backName: '', note: '', cost: 50, productionStatus: 'not_started', photos: [], formComplete: true, delivery: { kind: 'post', deliveryDate: '2026-12-01' } },
    customer: { id: 'c1', name: 'Anna Berger', phone: '+43 660 111 2233', email: 'anna@example.at' },
  }]
  await setupCalendarWorld(page, '2026-11-28T13:00:00Z', {
    saturdayFull: true,
    saturdaySlots,
    makeRoomHandler: (_body, key) => {
      keys.push(key)
      if (failSameDay) {
        return {
          status: 409,
          json: { code: 'NO_MOVABLE_SESSION', reason: 'SAME_DAY_ONLY', message: "All of today's sessions are for pickups today, so none can be moved." },
        }
      }
      saturdaySlots.length = 0
      return {
        status: 200,
        json: {
          slot: { date: '2026-11-28', startHour: 14, endHour: 15 },
          moved: [{
            itemId: 'orn-post-1',
            orderCode: 'AWG0103',
            from: { date: '2026-11-28', startHour: 14, endHour: 15 },
            to: { date: '2026-11-30', startHour: 10, endHour: 11 },
          }],
        },
      }
    },
  })

  await page.goto('/staff/sales/new')
  await page.getByRole('button', { name: /Add custom ornament/ }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  // First test SAME_DAY_ONLY error shown plainly.
  failSameDay = true
  const makeRoomBtn = page.getByRole('button', { name: 'Make room today', exact: true })
  await expect(makeRoomBtn).toBeVisible()
  const btnBox = (await makeRoomBtn.boundingBox())!
  expect(btnBox.height).toBeGreaterThanOrEqual(56)
  await makeRoomBtn.click()
  await expect(page.getByRole('alert')).toContainText("All of today's sessions are for pickups today, so none can be moved.")

  // Now succeed and verify the confirmation popup + freed slot selection.
  failSameDay = false
  await makeRoomBtn.click()
  const dialog = page.getByRole('dialog', { name: 'Room made', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('AWG0103')
  await expect(dialog).toContainText('Sat 14:00')
  await expect(dialog).toContainText('Mon 10:00')
  await expect(dialog.locator('svg')).toHaveCount(2) // close X + arrow icon
  const yourSlotRow = dialog.getByText('Your slot: Today 14:00–15:00', { exact: true })
  await expect(yourSlotRow).toBeVisible()
  // "Your slot" uses the neutral staff surface, never the green selection surface (#e9f4ee).
  const yourSlotBg = await yourSlotRow.evaluate(node => getComputedStyle(node).backgroundColor)
  expect(yourSlotBg).not.toBe('rgb(233, 244, 238)')
  expect(keys.every(Boolean)).toBe(true)

  if (testInfo.project.name === 'ipadLandscape' || testInfo.project.name === 'staff-phone-360x640') {
    fs.mkdirSync(postShotsDir, { recursive: true })
    const tag = testInfo.project.name === 'ipadLandscape' ? 'ipad-1180' : 'phone-360'
    await page.screenshot({ path: path.join(postShotsDir, `make-room-popup-${tag}.png`) })
  }

  await axe(page)
  await dialog.getByRole('button', { name: 'OK', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText(/Sat,? 28 Nov · 14:00–15:00/).first()).toBeVisible()
})

test('Make room today requests total minutes for multiple custom ornaments and hides Your slot unless every item fits', async ({ page }) => {
  const requests: { date: string; minutes: number; marketDayId?: string }[] = []
  let shortSlot = true
  await setupCalendarWorld(page, '2026-11-28T13:00:00Z', {
    saturdayFull: true,
    makeRoomHandler: (body) => {
      requests.push(body)
      return {
        status: 200,
        json: {
          slot: shortSlot
            ? { date: '2026-11-28', startHour: 14, endHour: 15 }
            : { date: '2026-11-28', startHour: 14, endHour: 16.25 },
          moved: [{
            itemId: 'orn-post-1',
            orderCode: 'AWG0103',
            from: { date: '2026-11-28', startHour: 14, endHour: 15 },
            to: { date: '2026-11-30', startHour: 10, endHour: 11 },
          }],
        },
      }
    },
  })

  await page.goto('/staff/sales/new')
  await page.getByRole('button', { name: /Add custom ornament/ }).click()
  await page.getByRole('button', { name: '+ Add custom', exact: true }).click()
  // Second ornament gets a back name -> 75 min; first stays 60 min -> total 135 min.
  await page.getByRole('checkbox', { name: /Name on the back/ }).nth(1).check()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  // 1. If the freed span only fits one ornament, "Your slot" must NOT appear.
  await page.getByRole('button', { name: 'Make room today', exact: true }).click()
  expect(requests[0]?.minutes).toBe(135)
  const partialDialog = page.getByRole('dialog', { name: 'Session moved', exact: true })
  await expect(partialDialog).toBeVisible()
  await expect(partialDialog.getByText(/Your slot:/)).toHaveCount(0)
  await partialDialog.getByRole('button', { name: 'OK', exact: true }).click()

  // 2. Fresh 2-ornament sale where the server frees the full 135 min -> both ornaments get slices and "Your slot" appears.
  shortSlot = false
  await page.goto('/staff/sales/new?fresh=1')
  await page.getByRole('button', { name: /Add custom ornament/ }).click()
  await page.getByRole('button', { name: '+ Add custom', exact: true }).click()
  await page.getByRole('checkbox', { name: /Name on the back/ }).nth(1).check()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Make room today', exact: true }).click()
  expect(requests[1]?.minutes).toBe(135)
  const fullDialog = page.getByRole('dialog', { name: 'Room made', exact: true })
  await expect(fullDialog).toBeVisible()
  await expect(fullDialog).toContainText('Your slot: Today 14:00–16:15')
  await fullDialog.getByRole('button', { name: 'OK', exact: true }).click()
  await expect(page.getByText(/Sat,? 28 Nov · 14:00–15:00/).first()).toBeVisible()
  await expect(page.getByText(/Sat,? 28 Nov · 15:00–16:15/).first()).toBeVisible()
})

test('Restored legacy Vienna draft migrates to Post with kept address and submits Post', async ({ page }) => {
  const { sales } = await setupCalendarWorld(page, '2026-11-28T13:00:00Z')
  await page.addInitScript(() => {
    if (sessionStorage.getItem('legacy-vienna-seeded')) return
    sessionStorage.setItem('legacy-vienna-seeded', '1')
    sessionStorage.setItem('awg-sale-draft', JSON.stringify({
      differentPickups: false,
      phase: 'delivery',
      items: [{
        id: 'draft-legacy-1',
        kind: 'custom',
        withName: false,
        color: 'red',
        finish: 'shiny',
        durationMinutes: 60,
        durationPreset: '60',
        paintDate: '2026-11-30',
        paintStart: 10,
        paintEnd: 11,
        fromCalendar: false,
        slotLocked: true,
        delivery: {
          mode: 'vienna',
          pickupDate: '2026-12-02',
          marketDayId: 'md-wed',
          pickupHour: null,
          address: { line1: 'Neubaugasse 12', postalCode: '1070', city: 'Wien' },
        },
      }],
    }))
  })
  await page.goto('/staff/sales/new')
  await expect(page.getByRole('radio', { name: 'Post (+€5)', exact: true })).toBeChecked()
  await expect(page.getByText('Post collection Tue 1 Dec · Arrives Thu 3 – Fri 4 Dec')).toBeVisible()
  await expect(page.getByLabel('Street and house number', { exact: true })).toHaveValue('Neubaugasse 12')
  await expect(page.getByLabel('Postcode', { exact: true })).toHaveValue('1070')
  await expect(page.getByLabel('City', { exact: true })).toHaveValue('Wien')
  await page.getByRole('button', { name: 'Create order & show QR', exact: true }).click()
  await expect.poll(() => sales.length).toBe(1)
  expect(sales[0].items[0].deliveryKind).toBe('post')
  expect(sales[0].items[0].address).toEqual({ line1: 'Neubaugasse 12', postalCode: '1070', city: 'Wien' })
})

test('Make room today is hidden when Gaby is painting at another market', async ({ page }) => {
  await setupCalendarWorld(page, '2026-11-28T13:00:00Z', { activeMarketId: 'mkt-spittelberg', saturdayFull: true })
  await page.goto('/staff/sales/new')
  await page.getByRole('button', { name: /Add custom ornament/ }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByText('Gaby is painting at Rathausplatz today.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Make room today' })).toHaveCount(0)
})
