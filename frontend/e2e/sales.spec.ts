import { expect, test, type Page } from '@playwright/test'
import { axe } from './helpers'

for (const [width, height] of [[360, 640], [440, 741]]) {
  test(`mock sales: URL queries, filters and order navigation at ${width}x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height })
    await page.clock.setFixedTime(new Date('2026-11-28T12:00:00Z'))
    await page.addInitScript(() => {
      localStorage.setItem('awg-staff-token', 'mock.staff-gaby.sales-e2e')
      localStorage.setItem('awg-active-market-id', 'mkt-rathaus')
    })
    await page.goto('/staff/sales')
    const results = page.getByRole('list', { name: 'Sales results' })
    await expect(results.getByRole('link')).toHaveCount(9)
    const main = page.locator('#staff-main')
    await expect(main.getByRole('searchbox')).toHaveCount(0)
    await expect(main.getByRole('link', { name: 'New sale', exact: true })).toHaveCount(0)
    for (const text of ['sarah', 'AWG0100', '664123']) {
      await page.goto(`/staff/sales?q=${encodeURIComponent(text)}`)
      await expect(results.getByRole('link')).toHaveCount(1)
      await expect(results).toContainText('Sarah Müller')
      await expect(results).toContainText('AWG0100')
      await expect(results).toContainText('Rathausplatz')
      await expect(results).toContainText('Custom')
      await expect(results.locator('img')).toHaveCount(1)
    }
    await page.goto('/staff/sales?q=missing')
    await expect(page.getByRole('status').filter({ hasText: 'No sales match these filters.' })).toBeVisible()
    await page.goto('/staff/sales')
    if (!await page.getByLabel('Payment', { exact: true }).isVisible()) await page.getByRole('button', { name: /^Filters/ }).click()
    await page.getByLabel('Payment', { exact: true }).selectOption('deposit')
    await expect(results.getByRole('link')).toHaveCount(2)
    await expect(results).toContainText(/Deposit · €\d+\.\d\d due/)
    if (!await page.getByLabel('Payment', { exact: true }).isVisible()) await page.getByRole('button', { name: /^Filters/ }).click()
    await page.getByLabel('Payment', { exact: true }).selectOption('')
    await page.getByLabel('Source', { exact: true }).selectOption('web')
    await expect(page.getByText('No sales match these filters.', { exact: true })).toBeVisible()
    await page.getByLabel('Source', { exact: true }).selectOption('stall')
    // Market filter and the card/cash totals of everything the filters match.
    const received = page.getByRole('definition').locator('xpath=ancestor::dl[1]')
    await expect(received.locator('dt')).toHaveText(['Card', 'Cash', 'Due'])
    await page.getByLabel('Market', { exact: true }).selectOption({ label: 'Rathausplatz' })
    await expect(page).toHaveURL(/market=mkt-rathaus/)
    await expect(results.getByRole('link')).toHaveCount(9)
    await expect(received.locator('dd').first()).toHaveText(/^€\d+\.\d\d$/)
    await page.getByLabel('Market', { exact: true }).selectOption('')
    await page.getByRole('radio', { name: 'Today', exact: true }).locator('..').click()
    await expect(results.getByRole('link')).toHaveCount(9)
    await page.getByRole('radio', { name: '7 days', exact: true }).locator('..').click()
    await expect(results.getByRole('link')).toHaveCount(9)
    await page.goto('/staff/sales?q=Sarah&source=stall&period=week')
    await expect(results.getByRole('link')).toHaveCount(1)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await axe(page)
    await testInfo.attach(`sales-${width}x${height}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
    await results.getByRole('link').click()
    await expect(page).toHaveURL(/\/staff\/orders\/ord-100$/)
    await expect(page.getByRole('heading', { name: /AWG0100/ })).toBeVisible()
    const back = page.getByRole('link', { name: /Sales/ }).first()
    await back.click()
    await expect(page).toHaveURL(/q=Sarah&source=stall&period=week$/)
    await expect(results.getByRole('link')).toHaveCount(1)
    if (!await page.getByLabel('Source', { exact: true }).isVisible()) await page.getByRole('button', { name: /^Filters/ }).click()
    await expect(page.getByLabel('Source', { exact: true })).toHaveValue('stall')
  })

  test(`HTTP sales: paging, explicit failure and retry at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const fixture = await httpSales(page)
    await page.goto('/staff/sales')
    const results = page.getByRole('list', { name: 'Sales results' })
    await expect(results.getByRole('link')).toHaveCount(20)
    await expect(page.getByRole('definition')).toHaveText(['€120.00', '€85.50', '€40.00'])
    await expect(results.getByRole('link').first()).toContainText('Web shop')
    await expect(results.getByRole('link').first().getByRole('img', { name: 'red ornament' })).toBeVisible()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(results.getByRole('link')).toHaveCount(3)
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
    await expect(page.getByRole('navigation', { name: 'Sales pages' })).toContainText('2 / 2')
    expect(fixture.requests.at(-1)?.get('page')).toBe('1')
    if (!await page.getByLabel('Payment', { exact: true }).isVisible()) await page.getByRole('button', { name: /^Filters/ }).click()
    await page.getByLabel('Payment', { exact: true }).selectOption('review')
    await expect(results.getByRole('link')).toHaveCount(1)
    await expect(results).toContainText('Payment review')
    expect(fixture.requests.at(-1)?.get('state')).toBe('review')
    expect(fixture.requests.at(-1)?.get('page')).toBe('0')
    fixture.failNext()
    await page.goto('/staff/sales?state=review&q=Alex')
    await expect(page.getByRole('alert')).toContainText('Please try again.')
    await expect(results).toHaveCount(0)
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(results.getByRole('link')).toHaveCount(1)
    expect(fixture.requests.at(-1)?.get('query')).toBe('Alex')
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
}

test('iPad Sales rows align customer, items, market and totals across the available width', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Both iPad viewport sizes are measured in this test.')
  await page.addInitScript(() => localStorage.setItem('awg-staff-token', 'mock.staff-gaby.sales-ipad'))
  await page.goto('/staff/sales?q=Sarah')
  const row = page.getByRole('list', { name: 'Sales results' }).getByRole('link')
  await expect(row).toBeVisible()
  for (const [width, height] of [[820, 1180], [1180, 820]]) {
    await page.setViewportSize({ width, height })
    const geometry = await row.evaluate(link => {
      const box = link.getBoundingClientRect()
      const main = link.closest('#staff-main')!
      const style = getComputedStyle(main)
      return {
        width: box.width,
        available: main.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
        columns: Array.from(link.children, child => child.getBoundingClientRect().left),
        overflow: main.scrollWidth > main.clientWidth,
      }
    })
    expect(geometry.width).toBe(geometry.available)
    expect(geometry.columns).toHaveLength(4)
    expect(geometry.columns.every((left, index) => index === 0 || left > geometry.columns[index - 1])).toBe(true)
    expect(geometry.overflow).toBe(false)
  }
})

async function httpSales(page: Page) {
  const requests: URLSearchParams[] = []
  let fail = false
  await page.addInitScript(() => localStorage.setItem('awg-staff-token', 'sales-http-session'))
  await page.route('**/src/api/mock/entry.ts', route => route.fulfill({ contentType: 'application/javascript', body: "export { httpApi as selectedApi } from '/src/api/http/services.ts'" }))
  await page.route('**/src/api/mock/demo.ts', route => route.fulfill({ contentType: 'application/javascript', body: "export * from '/src/api/http/demo.ts'" }))
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/staff/me') return route.fulfill({ json: { id: 'gaby', name: 'Gaby', email: 'gaby@example.com' } })
    if (['/api/markets', '/api/market-days', '/api/orders/attention'].includes(url.pathname)) return route.fulfill({ json: [] })
    if (url.pathname === '/api/orders') {
      requests.push(url.searchParams)
      if (fail) { fail = false; return route.fulfill({ status: 503, json: { code: 'UNAVAILABLE', message: 'Please try again.' } }) }
      const pageNumber = Number(url.searchParams.get('page') ?? '0')
      const reviewing = url.searchParams.get('state') === 'review'
      const orders = Array.from({ length: reviewing ? 1 : pageNumber ? 3 : 20 }, (_, index) => ({
        id: `sale-${pageNumber}-${index}`, code: `AWGSALE${index}`, customerName: 'Alex Example', phone: '123456789',
        createdAt: '2026-11-06T10:00:00Z', paymentState: 'unpaid', checkoutStatus: reviewing ? 'review' : null,
        source: 'web', status: 'ACTIVE', total: 49.99, items: 1, nextHandoffDate: '2026-11-13', handedOver: false,
        soldAtMarketName: null, saleItems: [{ id: `item-${index}`, kind: 'custom', color: 'red', photoUrl: null, marketOrnamentId: null }],
      }))
      return route.fulfill({ json: { orders, page: pageNumber, size: 20, totalElements: reviewing ? 1 : 23, totalPages: reviewing ? 1 : 2, received: { card: 120, cash: 85.5, other: 0, due: 40 } } })
    }
    return route.fulfill({ status: 404, json: { message: 'Unexpected test request.' } })
  })
  return { requests, failNext: () => { fail = true } }
}
