import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import type { CreateSaleInput, Market, MarketDay, PaintingDay } from '../src/domain/types'
import { staffUser, token, config, chooseSizes } from './staff-fixture'

const shotPath = path.resolve(process.cwd(), '../tasks/audit-results/staff-round2-shots/two-markets-sale.png')

test('staff remembers a stall, changes it from More and sees its own pickups', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-28T14:10:00Z'))
  await page.goto('/staff/agenda')
  await page.getByLabel('Email', { exact: true }).fill('gaby@artwithgab.com')
  await page.getByLabel('Password', { exact: true }).fill('gaby')
  await page.getByRole('button', { name: /Enter|Sign in/ }).click()
  const picker = page.getByRole('dialog', { name: 'I’m at' })
  await picker.getByRole('button', { name: 'Christkindlmarkt Spittelberg' }).click()
  const active = page.getByRole('button', { name: 'Change market, currently at Christkindlmarkt Spittelberg' })
  await expect(active).toBeVisible()
  await page.reload()
  await expect(active).toBeVisible()
  await expect(picker).toHaveCount(0)

  const code = await page.evaluate(async () => {
    const entry = '/src/api/client.ts'
    const { api } = await import(entry)
    const order = await api.orders.createSale({
      soldOnMarketDayId: 'md-spittelberg-28',
      customerName: 'Cross-stall pickup',
      items: [{ kind: 'finished', marketOrnamentId: 'RM01', withName: false, deliveryKind: 'market', marketDayId: 'md-28', pickupHour: 17 }],
    }, 'e2e-overlap')
    return order.code
  })

  const agenda = page.locator('#agenda-pickups')
  await expect(agenda.getByLabel('Pickup market')).toHaveValue('mkt-spittelberg')
  await expect(agenda.getByRole('button', { name: new RegExp(code) })).toHaveCount(0)
  await agenda.getByLabel('Pickup market').selectOption('mkt-rathaus')
  await expect(agenda.getByRole('button', { name: new RegExp(code) })).toContainText('Rathausplatz')

  await page.getByRole('button', { name: /Painting hours for/ }).click()
  const painting = page.getByRole('dialog', { name: /Painting hours/ })
  const paintMarket = painting.getByLabel('Gaby paints at')
  await expect(paintMarket.locator('option:checked')).toHaveText('Automatic · Rathausplatz')
  await paintMarket.selectOption('mkt-rathaus')
  await expect(paintMarket).toHaveValue('mkt-rathaus')
  await paintMarket.selectOption('')
  await expect(paintMarket.locator('option:checked')).toHaveText('Automatic · Rathausplatz')
  await expect(painting.getByText('3 booked · room for 6', { exact: true })).toBeVisible()
  await painting.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByText('Gaby is painting at Rathausplatz this day.', { exact: true })).toBeVisible()
  await expect(page.locator('[data-gaby-away]').getByText('3 booked · room for 6', { exact: true })).toBeVisible()

  const more = page.getByRole('button', { name: /^More/ })
  await more.click()
  await page.getByRole('link', { name: 'Deliveries', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Deliveries', exact: true })).toBeVisible()
  const card = page.getByRole('article', { name: `Order ${code}`, exact: true })
  await expect(card).toHaveCount(0)
  const filter = page.getByLabel('Pickup market')
  if (!await filter.isVisible()) await page.getByRole('button', { name: /^Filters/ }).click()
  await expect(filter).toHaveValue('mkt-spittelberg')
  await filter.selectOption('mkt-rathaus')
  await expect(card).toContainText('Rathausplatz')

  await more.click()
  await page.getByRole('button', { name: 'Change market', exact: true }).click()
  await picker.getByRole('button', { name: 'Rathausplatz' }).click()
  await expect(page.getByRole('button', { name: 'Change market, currently at Rathausplatz' })).toBeVisible()
})

async function setupOverlapHttp(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-28T10:00:00Z'))
  await page.addInitScript(value => {
    localStorage.setItem('awg-staff-token', value)
  }, token)
  await page.route('**/src/api/mock/entry.ts', route => route.fulfill({ contentType: 'application/javascript', body: "export { httpApi as selectedApi } from '/src/api/http/services.ts'" }))
  await page.route('**/src/api/mock/demo.ts', route => route.fulfill({ contentType: 'application/javascript', body: "export * from '/src/api/http/demo.ts'" }))

  const markets: Market[] = [
    { id: 'mkt-rathaus', name: 'Rathausplatz', kind: 'market', totalCost: 2400, startDate: '2026-11-28', finishDate: '2026-12-04', stall: 12 },
    { id: 'mkt-spittelberg', name: 'Christkindlmarkt Spittelberg', kind: 'market', totalCost: 900, startDate: '2026-11-28', finishDate: '2026-11-29', stall: 4 },
  ]
  const marketDays: MarketDay[] = [
    { id: 'md-spit-28', marketId: 'mkt-spittelberg', date: '2026-11-28', openHour: 13, closeHour: 20, isToday: true },
    { id: 'md-spit-29', marketId: 'mkt-spittelberg', date: '2026-11-29', openHour: 13, closeHour: 20, isToday: false },
    { id: 'md-28', marketId: 'mkt-rathaus', date: '2026-11-28', openHour: 12, closeHour: 19, isToday: true },
    { id: 'md-29', marketId: 'mkt-rathaus', date: '2026-11-29', openHour: 12, closeHour: 19, isToday: false },
    { id: 'md-04', marketId: 'mkt-rathaus', date: '2026-12-04', openHour: 12, closeHour: 19, isToday: false },
  ]
  const paintingDays: PaintingDay[] = [
    { date: '2026-11-28', open: true, maxPaintings: 6, booked: 1, openHour: 12, closeHour: 18, paintingMarketId: 'mkt-rathaus', paintingMarketName: 'Rathausplatz' },
    { date: '2026-11-29', open: true, maxPaintings: 6, booked: 0, openHour: 12, closeHour: 18, paintingMarketId: 'mkt-rathaus', paintingMarketName: 'Rathausplatz' },
    { date: '2026-12-04', open: true, maxPaintings: 6, booked: 0, openHour: 12, closeHour: 18, paintingMarketId: 'mkt-rathaus', paintingMarketName: 'Rathausplatz' },
  ]
  const inventory = config.colors.map((row, index) => ({ id: `stock-${index}`, kind: 'custom', color: row.color, finish: row.finish, quantity: 5 }))
  const sales: CreateSaleInput[] = []

  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request()
    const url = new URL(req.url())
    const pathName = url.pathname
    if (pathName === '/api/staff/me') return route.fulfill({ json: staffUser })
    if (pathName === '/api/orders/attention') return route.fulfill({ json: [] })
    if (pathName === '/api/shop/config') return route.fulfill({ json: config })
    if (pathName === '/api/market-stock') return route.fulfill({ json: [] })
    if (pathName === '/api/inventory') return route.fulfill({ json: inventory })
    if (pathName === '/api/markets') return route.fulfill({ json: markets })
    if (pathName === '/api/market-days') return route.fulfill({ json: marketDays })
    if (pathName === '/api/painting-days') return route.fulfill({ json: paintingDays })
    if (pathName === '/api/agenda/days') {
      return route.fulfill({
        json: ['2026-11-28', '2026-11-29', '2026-12-04'].map(date => {
          const daysForDate = marketDays.filter(d => d.date === date)
          const p = paintingDays.find(r => r.date === date)!
          return {
            marketDay: daysForDate.find(day => day.marketId === p.paintingMarketId)!,
            market: markets.find(m => m.id === p.paintingMarketId)!,
            markets: daysForDate.map(d => markets.find(m => m.id === d.marketId)!),
            marketDays: daysForDate,
            paintingMarketId: p.paintingMarketId,
            paintingMarketName: p.paintingMarketName,
            slots: [],
            deliveries: [],
          }
        }),
      })
    }
    if (pathName === '/api/agenda/capacity') {
      const body = req.postDataJSON() as { date: string; durationHours: number; beforeHour?: number }
      const end = 12 + body.durationHours
      if (body.beforeHour != null && end > body.beforeHour) {
        return route.fulfill({ json: { ok: false, slot: null, remainingHours: 0, message: 'No free paint slot before this handoff.' } })
      }
      return route.fulfill({ json: { ok: true, slot: { date: body.date, startHour: 12, endHour: end }, remainingHours: 4, message: 'Available' } })
    }
    if (pathName === '/api/orders' && req.method() === 'POST') {
      const input = req.postDataJSON() as CreateSaleInput
      sales.push(input)
      return route.fulfill({
        json: {
          id: `sale-${sales.length}`,
          customerId: 'cus-1',
          code: `AWGNEW0${sales.length}`,
          trackToken: 'trk-1',
          formToken: `frm-${sales.length}`,
          paymentState: 'unpaid',
          paymentMethod: null,
          total: config.customPrice,
          amountPaid: 0,
          createdAt: '2026-11-28T11:00:00Z',
          itemIds: ['item-1'],
          handedOver: false,
        },
      })
    }
    if (pathName.endsWith('/bundle')) {
      return route.fulfill({
        json: {
          order: { id: 'sale-1', customerId: 'cus-1', code: 'AWGNEW01', trackToken: 'trk-1', formToken: 'frm-1', paymentState: 'unpaid', paymentMethod: null, total: config.customPrice, createdAt: '2026-11-28T11:00:00Z', itemIds: ['item-1'], handedOver: false },
          customer: { id: 'cus-1', name: 'Walk-in', phone: '', email: '' },
          items: [],
          blocks: [],
        },
      })
    }
    return route.fulfill({ status: 501, json: { message: `Unstubbed ${req.method()} ${pathName}` } })
  })

  return { sales }
}

test('New sale at the other stall skips today and defaults to the next eligible pickup', async ({ page }) => {
  const { sales } = await setupOverlapHttp(page)
  await page.goto('/staff/sales/new')
  const picker = page.getByRole('dialog', { name: 'I’m at' })
  await picker.getByRole('button', { name: 'Christkindlmarkt Spittelberg' }).click()

  await page.getByRole('button', { name: /Add custom ornament/ }).click()
  await expect(page.getByRole('heading', { name: /Custom 1 · (€|Choose size)/ })).toBeVisible()
  await chooseSizes(page)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByText('Gaby is painting at Rathausplatz today.', { exact: true })).toBeVisible()
  await expect(page.getByRole('radio', { name: /^Today/ })).toHaveCount(0)
  const nextDay = page.getByRole('button', { name: /Rathausplatz · Sun,? 29 Nov/ })
  await expect(nextDay).toBeVisible()
  await nextDay.click()
  await expect(page.locator('input[name^="day-"][value="md-29"]')).toBeChecked()
  for (const dayId of ['md-spit-28', 'md-28', 'md-spit-29']) {
    await expect(page.locator(`input[name^="day-"][value="${dayId}"]`)).toHaveCount(0)
  }
  await page.getByRole('button', { name: 'Close market day picker' }).click()
  await page.getByRole('button', { name: '14:00', exact: true }).click()
  await expect(page.getByText('Painted at Rathausplatz', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Create order & show QR', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Enlarge customer QR code', exact: true })).toBeVisible()
  expect(sales).toHaveLength(1)
  expect(sales[0].soldOnMarketDayId).toBe('md-spit-28')
  expect(sales[0].items[0]).toMatchObject({
    marketDayId: 'md-29', marketId: 'mkt-rathaus', paintDate: '2026-11-29',
  })

  await page.getByRole('button', { name: 'Change market, currently at Christkindlmarkt Spittelberg' }).click()
  await picker.getByRole('button', { name: 'Rathausplatz' }).click()
  await page.goto('/staff/sales/new?fresh=1')
  await page.getByRole('button', { name: /Add custom ornament/ }).click()
  await chooseSizes(page)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('radio', { name: 'Today', exact: true })).toBeChecked()
  await page.getByRole('button', { name: '17:00', exact: true }).click()
  await expect(page.getByText(/^Sat,? 28 Nov · 12:00–13:00$/)).toBeVisible()
  await expect(page.getByText(/^Painted at /)).toHaveCount(0)
})

test('mock overlap: New sale offers the next eligible stall and saves cross-stall pickup', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-11-28T14:10:00Z'))
  await page.addInitScript(() => localStorage.setItem('awg-active-market-id', 'mkt-spittelberg'))
  await page.goto('/staff/sales/new')
  await page.getByLabel('Email', { exact: true }).fill('gaby@artwithgab.com')
  await page.getByLabel('Password', { exact: true }).fill('gaby')
  await page.getByRole('button', { name: /Enter|Sign in/ }).click()
  await page.getByRole('button', { name: /Add custom ornament/ }).click()
  await expect(page.getByRole('heading', { name: /Custom 1 · (€|Choose size)/ })).toBeVisible()
  await chooseSizes(page)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByText('Gaby is painting at Rathausplatz today.', { exact: true })).toBeVisible()
  await expect(page.getByRole('radio', { name: /^Today/ })).toHaveCount(0)
  await page.getByRole('button', { name: /Rathausplatz · Sun,? 29 Nov/ }).click()
  await expect(page.getByText('Choose market day', { exact: true })).toBeVisible()
  await expect(page.locator('input[name^="day-"][value="md-spittelberg-29"]')).toHaveCount(0)
  await expect(page.locator('input[name^="day-"][value="md-29"]')).toBeChecked()

  if (testInfo.project.name === 'ipadPortrait') {
    await page.screenshot({ path: shotPath, fullPage: true })
  }

  await page.getByRole('button', { name: 'Close market day picker' }).click()
  await page.getByRole('button', { name: '15:00', exact: true }).click()
  const summary = page.getByRole('complementary').filter({ has: page.getByRole('heading', { name: 'Order summary', exact: true }) })
  await expect(summary).toContainText('Rathausplatz')
  await page.getByRole('button', { name: 'Create order & show QR', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Enlarge customer QR code', exact: true })).toBeVisible()
})
