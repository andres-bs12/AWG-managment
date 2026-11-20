import { expect, test, type Page } from '@playwright/test'
import { axe } from './helpers'

async function openStock(page: Page) {
  await page.addInitScript(() => localStorage.setItem('awg-active-market-id', 'mkt-rathaus'))
  await page.goto('/staff/inventory')
  await page.getByLabel('Email', { exact: true }).fill('gaby@artwithgab.com')
  await page.getByLabel('Password', { exact: true }).fill('gaby')
  await page.getByRole('button', { name: /Enter|Sign in/ }).click()
  await expect(page.getByRole('heading', { name: 'Market ornaments' })).toBeVisible()
}

test('market ornaments have the seeded colour counts and open their photo by ID', async ({ page }) => {
  await openStock(page)
  const stock = page.getByRole('region', { name: 'Market ornaments' })
  const totals = stock.getByLabel('Market stock totals')
  await expect(totals.locator('dd')).toHaveText(['87', '77', '10', '0'])
  await expect(stock.locator('summary')).toHaveText(['Red21 ornaments', 'Wine18 ornaments', 'Green24 ornaments', 'Beige24 ornaments'])
  await stock.locator('summary').filter({ hasText: 'Red' }).click()
  await expect(stock.getByRole('region', { name: 'Red Shiny' }).getByRole('button')).toHaveCount(12)
  await expect(stock.getByRole('region', { name: 'Red Matte' }).getByRole('button')).toHaveCount(9)
  await expect(stock.getByRole('img')).toHaveCount(0)
  await stock.getByRole('button', { name: 'RM01 Ready' }).click()
  const detail = page.getByRole('dialog', { name: 'RM01' })
  await expect(detail.getByRole('img', { name: 'Painted design on RM01' })).toBeVisible()
  await expect.poll(() => detail.locator('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await axe(page)
  await page.keyboard.press('Escape')
  await expect(detail).toBeHidden()
  await expect(stock.getByRole('button', { name: 'RM01 Ready' })).toBeFocused()
  await axe(page)
})

test('painting status and the resized photo persist, and Stock rejects a direct sale', async ({ page }) => {
  await openStock(page)
  const search = page.getByLabel('Search inventory ID')
  await search.fill('rs-o1')
  await search.press('Enter')
  const detail = page.getByRole('dialog', { name: 'RS01' })
  await expect(detail.getByRole('button', { name: 'Mark sold' })).toHaveCount(0)
  const input = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 2400
    canvas.height = 1200
    const context = canvas.getContext('2d')!
    context.fillStyle = 'green'
    context.fillRect(0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await detail.getByLabel('Add photo').setInputFiles({ name: 'ornament.png', mimeType: 'image/png', buffer: Buffer.from(input, 'base64') })
  await expect(detail.getByRole('status', { name: '' }).filter({ hasText: 'Photo saved.' })).toBeVisible()
  await expect(detail.getByRole('img')).toBeVisible()
  await detail.getByRole('button', { name: 'Mark painted', exact: true }).click()
  await expect(detail.getByText('Marked as painted.')).toBeVisible()
  await expect(detail.getByRole('button', { name: 'Mark sold' })).toHaveCount(0)
  const rejected = await page.evaluate(async () => {
    const path = '/src/api/client.ts'
    const { api } = await import(path)
    const pieces = await api.marketStock.list()
    const ready = pieces.find((piece: { id: string }) => piece.id === 'RS01')
    try {
      await api.marketStock.changeStatus(ready.id, 'sold', ready.revision)
      return null
    } catch (err) {
      const error = err as { status: number; code: string }
      return { status: error.status, code: error.code }
    }
  })
  expect(rejected).toEqual({ status: 400, code: 'MARKET_STOCK_SELL_IN_SALE' })

  await page.reload()
  const totals = page.getByLabel('Market stock totals')
  await expect(totals.locator('dd')).toHaveText(['87', '76', '11', '0'])
  await page.getByLabel('Status', { exact: true }).selectOption('painted')
  await page.getByRole('button', { name: 'RS01 Ready' }).click()
  await expect(detail.getByRole('img')).toBeVisible()
  await expect.poll(() => detail.getByRole('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(2000)
  await detail.getByRole('button', { name: 'Mark unpainted' }).click()
  await expect(detail.getByText('Moved back to To paint.')).toBeVisible()
  await detail.getByRole('button', { name: 'Close' }).click()
  await expect(totals.locator('dd')).toHaveText(['87', '77', '10', '0'])
  await expect(page.getByRole('button', { name: 'RS01 Ready' })).toHaveCount(0)
})

test('MarketStock refreshes on focus, replaces full state on conflict, and mock checks revision before sold', async ({ page }) => {
  await openStock(page)
  const totals = page.getByLabel('Market stock totals')
  await expect(totals.locator('dd')).toHaveText(['87', '77', '10', '0'])

  // Sell RM01 outside Stock (as if another screen/tab sold it) and verify revision check runs before sold.
  const staleCheck = await page.evaluate(async () => {
    const clientPath = '/src/api/client.ts'
    const { api } = await import(clientPath)
    const before = (await api.marketStock.list()).find((row: { id: string }) => row.id === 'RM01')
    const order = await api.orders.createSale({
      soldOnMarketDayId: 'md-28',
      items: [{ kind: 'finished', marketOrnamentId: 'RM01', withName: false, deliveryKind: 'market' }],
    }, 'idemp-rev-check')
    let staleErr: { status: number; code: string } | null = null
    try {
      await api.marketStock.changeStatus('RM01', 'unpainted', before.revision)
    } catch (err) {
      const error = err as { status: number; code: string }
      staleErr = { status: error.status, code: error.code }
    }
    const after = (await api.marketStock.list()).find((row: { id: string }) => row.id === 'RM01')
    let soldErr: { status: number; code: string } | null = null
    try {
      await api.marketStock.changeStatus('RM01', 'unpainted', after.revision)
    } catch (err) {
      const error = err as { status: number; code: string }
      soldErr = { status: error.status, code: error.code }
    }
    return { staleErr, soldErr, orderId: order.id }
  })
  expect(staleCheck.staleErr).toEqual({ status: 409, code: 'MARKET_STOCK_CHANGED' })
  expect(staleCheck.soldErr).toEqual({ status: 400, code: 'MARKET_STOCK_SELL_IN_SALE' })

  // MarketStock reacts via useStaffRefresh() on store emit / focus.
  await expect(totals.locator('dd')).toHaveText(['87', '77', '9', '1'])

  // Cancelling the order emits only after IndexedDB returns RM01, so Stock sees Ready immediately.
  await page.evaluate(async (orderId) => {
    const clientPath = '/src/api/client.ts'
    const { api } = await import(clientPath)
    await api.orders.cancelOrder(orderId)
  }, staleCheck.orderId)
  await expect(totals.locator('dd')).toHaveText(['87', '77', '10', '0'])

  // Conflict inside OrnamentDialog refetches and replaces the full list (not just the open ornament).
  await page.getByLabel('Search inventory ID').fill('RM02')
  await page.getByRole('button', { name: 'RM02 Ready' }).click()
  const detail = page.getByRole('dialog', { name: 'RM02' })
  await page.evaluate(async () => {
    const clientPath = '/src/api/client.ts'
    const { api } = await import(clientPath)
    const rows = await api.marketStock.list()
    const rm02 = rows.find((row: { id: string }) => row.id === 'RM02')
    const rm06 = rows.find((row: { id: string }) => row.id === 'RM06')
    await api.marketStock.changeStatus('RM02', 'unpainted', rm02.revision)
    await api.marketStock.changeStatus('RM06', 'painted', rm06.revision)
  })
  await detail.getByRole('button', { name: 'Mark unpainted', exact: true }).click()
  await expect(detail.getByRole('alert')).toContainText('Someone else updated this ornament')
  await detail.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByLabel('Search inventory ID').fill('')
  await expect(totals.locator('dd')).toHaveText(['87', '77', '10', '0'])
})
