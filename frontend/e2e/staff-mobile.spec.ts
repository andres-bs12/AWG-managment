import { test, expect, type Locator, type Page } from '@playwright/test'
import { axe } from './helpers'
import { httpFixture, signedIn, navigation, today, spareMarket } from './staff-fixture'

async function openFilters(page: Page) {
  const button = page.getByRole('button', { name: /^Filters \(/ })
  if (await button.isVisible() && await button.getAttribute('aria-expanded') === 'false') await button.click()
}

async function noOrphanSeparators(page: Page) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  // Check actual line geometry, including separators split across React text nodes.
  expect(await page.locator('#staff-main').evaluate(main => {
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
    const orphans: string[] = []
    let previous: DOMRect | null = null
    while (walker.nextNode()) {
      const node = walker.currentNode
      for (let index = 0; index < (node.textContent?.length ?? 0); index++) {
        const char = node.textContent![index]
        if (/\s/u.test(char)) continue
        const range = document.createRange()
        range.setStart(node, index); range.setEnd(node, index + 1)
        const box = range.getBoundingClientRect()
        if (!box.width || !box.height) continue
        if (char === '·' && (!previous || Math.abs(box.top - previous.top) > 2)) orphans.push(node.textContent!)
        previous = box
      }
    }
    return orphans
  })).toEqual([])
}

async function firstCardAboveFold(page: Page, card: Locator) {
  await expect(card).toBeVisible()
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  expect(await page.locator('#staff-main').evaluate(node => node.scrollTop)).toBe(0)
  const box = (await card.boundingBox())!
  const main = (await page.locator('#staff-main').boundingBox())!
  const tabs = (await page.getByRole('navigation', { name: 'Staff tabs' }).boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(main.y)
  expect(box.y + box.height).toBeLessThanOrEqual(Math.min(main.y + main.height, tabs.y))
}

async function mobileLayout(page: Page) {
  expect(await page.evaluate(() => {
    const main = document.querySelector('#staff-main')
    return document.documentElement.scrollWidth <= innerWidth && (!main || main.scrollWidth <= main.clientWidth)
  })).toBe(true)
  const undersized = await page.locator('[data-staff-page] button, [data-staff-page] select, [data-staff-page] textarea, [data-staff-page] input:not([type=checkbox]):not([type=radio]):not([type=file])').evaluateAll(nodes => nodes.filter(node => {
    const box = node.getBoundingClientRect(), css = getComputedStyle(node)
    return box.width > 0 && box.height > 0 && css.visibility !== 'hidden' && (box.width < 43.5 || box.height < 43.5)
  }).map(node => ({ label: node.getAttribute('aria-label') || node.textContent?.trim() || node.id, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })))
  expect(undersized).toEqual([])
}
async function clearAction(action: Locator) {
  await action.scrollIntoViewIfNeeded()
  await expect(action).toBeInViewport({ ratio: 1 })
  expect(await action.evaluate(node => {
    const rect = node.getBoundingClientRect()
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    return !!hit && (node === hit || node.contains(hit))
  })).toBe(true)
}

const pages = [
  { path: `/staff/agenda?date=${today}&view=list`, heading: 'Agenda' },
  { path: `/staff/agenda?date=${today}&view=calendar`, heading: 'Agenda' },
  { path: `/staff/deliveries?day=${today}`, heading: 'Deliveries' },
  { path: '/staff/sales/new?fresh=1', heading: 'New sale' },
  { path: '/staff/orders/order-review', heading: 'AWGREVIEW' },
  { path: '/staff/search?q=Alex', heading: 'Search orders' },
  { path: '/staff/inventory', heading: 'Stock' },
  { path: '/staff/markets', heading: 'Markets' },
  { path: `/staff/markets/${spareMarket.id}`, heading: spareMarket.name },
  { path: '/staff/painting-days', heading: 'Painting days' },
  { path: '/staff/attention', heading: 'Needs attention' },
]

for (const entry of pages) test(`phone hierarchy, controls and accessibility: ${entry.path}`, async ({ page }, testInfo) => {
  await httpFixture(page)
  await signedIn(page, entry.path)
  await expect(page.getByRole('heading', { name: entry.heading, exact: true, level: 1 })).toBeVisible()
  await mobileLayout(page)
  await noOrphanSeparators(page)
  await axe(page)
  await testInfo.attach(`staff-${testInfo.project.name}-${entry.heading}`, { body: await page.screenshot(), contentType: 'image/png' })
})

test('five equal navigation targets keep labels inside their borders at 320–440px', async ({ page }) => {
  await httpFixture(page)
  await signedIn(page)
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  for (const width of [320, 360, 390, 440]) {
    await page.setViewportSize({ width, height: 740 })
    for (const path of ['/staff/agenda', '/staff/deliveries', '/staff/sales/new?fresh=1', '/staff/search', '/staff/inventory']) {
      await navigation(page, path)
      const tabs = page.getByRole('navigation', { name: 'Staff tabs' })
      await expect(tabs.locator('[data-selected="true"]')).toHaveCount(1)
      const sizes = await tabs.locator(':scope > *').evaluateAll(nodes => nodes.map(node => {
        const box = node.getBoundingClientRect(), range = document.createRange()
        range.selectNodeContents(node)
        const text = range.getBoundingClientRect()
        return { width: box.width, height: box.height, left: text.left - box.left, right: box.right - text.right }
      }))
      expect(sizes).toHaveLength(5)
      expect(Math.max(...sizes.map(row => row.width)) - Math.min(...sizes.map(row => row.width))).toBeLessThan(1)
      for (const row of sizes) {
        expect(row.width).toBeGreaterThanOrEqual(44)
        expect(row.height).toBeGreaterThanOrEqual(44)
        expect(row.left).toBeGreaterThanOrEqual(4)
        expect(row.right).toBeGreaterThanOrEqual(4)
      }
    }
  }
})

test('phone deliveries show the first cart at 360×640 and disclose counted filters', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 })
  await httpFixture(page, { finished: true })
  await signedIn(page, '/staff/deliveries')
  const cart = page.getByRole('article', { name: 'Order AWGREVIEW', exact: true })
  await firstCardAboveFold(page, cart)
  const filters = page.getByRole('button', { name: 'Filters (0)', exact: true })
  await expect(filters).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('group', { name: 'Production', exact: true })).not.toBeVisible()
  await filters.click()
  await page.getByRole('radio', { name: 'Finished', exact: true }).locator('..').click()
  await expect(page.getByRole('button', { name: 'Filters (1)', exact: true })).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('button', { name: 'Filters (1)', exact: true }).click()
  await page.getByLabel('Delivery day', { exact: true }).selectOption(today)
  await expect(page).toHaveURL(new RegExp(`day=${today}`))
  await expect(page.getByRole('button', { name: 'Filters (2)', exact: true })).toBeVisible()
  await noOrphanSeparators(page)
  await mobileLayout(page)
})

test('phone sales show the first result at 360×640 with inline search and counted URL filters', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 })
  await page.clock.setFixedTime(new Date('2026-11-28T12:00:00Z'))
  await page.addInitScript(() => localStorage.setItem('awg-staff-token', 'mock.staff-gaby.phone-polish'))
  await page.goto('/staff/sales')
  const results = page.getByRole('list', { name: 'Sales results' })
  await firstCardAboveFold(page, results.getByRole('link').first())
  await page.getByLabel('Code, customer name or phone', { exact: true }).fill('Sarah')
  await expect(results.getByRole('link')).toHaveCount(1)
  await openFilters(page)
  await page.getByLabel('Source', { exact: true }).selectOption('stall')
  await page.getByRole('button', { name: 'Filters (1)', exact: true }).click()
  await expect(page).toHaveURL(/source=stall/)
  await expect(page.getByLabel('Payment', { exact: true })).not.toBeVisible()
  await noOrphanSeparators(page)
  await mobileLayout(page)
  await axe(page)
})

test('stock groups accessible swatches and independent finish saves on a full-height neutral canvas', async ({ page }) => {
  const fixture = await httpFixture(page)
  await signedIn(page, '/staff/inventory')
  for (const color of ['red', 'green', 'beige']) {
    const card = page.getByRole('article', { name: `${color} bases`, exact: true })
    await expect(card.getByRole('heading', { level: 2 })).toHaveAccessibleName(color)
    await expect(card.getByRole('img', { name: color, exact: true })).toHaveCount(1)
    await expect(card.getByRole('heading', { name: 'Shiny', exact: true })).toHaveCount(1)
    await expect(card.getByRole('heading', { name: 'Matte', exact: true })).toHaveCount(1)
    const shiny = card.getByRole('group', { name: `Custom · ${color} · shiny`, exact: true })
    await shiny.getByRole('button', { name: /^Increase/ }).click()
    await shiny.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(shiny.getByRole('status')).toHaveText('Saved')
    await expect(card.getByRole('spinbutton', { name: `Custom · ${color} · matte quantity`, exact: true })).toHaveValue('3')
  }
  expect(fixture.mutations.filter(row => row.path.startsWith('/api/inventory/'))).toHaveLength(3)
  const finished = page.getByRole('article', { name: 'Finished ornaments', exact: true })
  await finished.scrollIntoViewIfNeeded()
  await expect(finished.getByRole('spinbutton')).toHaveValue('3')
  expect(await page.evaluate(() => {
    const shell = document.querySelector('div[data-staff-page]')!
    const color = getComputedStyle(shell).backgroundColor
    return [document.documentElement, document.body, document.querySelector('#staff-main')!].every(node => {
      const bg = getComputedStyle(node).backgroundColor
      return bg === color || (node.id === 'staff-main' && bg === 'rgba(0, 0, 0, 0)')
    })
  })).toBe(true)
  await mobileLayout(page)
})

test('order summary, agenda pickups and search keep separators attached when narrow', async ({ page }) => {
  await httpFixture(page)
  await signedIn(page, '/staff/orders/order-review')
  for (const width of [320, 360, 440]) {
    await page.setViewportSize({ width, height: 740 })
    for (const path of ['/staff/orders/order-review', `/staff/agenda?date=${today}&view=list`, '/staff/search?q=Alex']) {
      await navigation(page, path)
      await expect(page.locator('#staff-main [data-staff-joined]').first()).toBeAttached()
      await noOrphanSeparators(page)
    }
  }
})

test('Agenda keeps one date strip and edits the selected day hours from its gear', async ({ page }) => {
  const fixture = await httpFixture(page)
  await signedIn(page, `/staff/agenda?date=${today}&view=list`)
  const main = page.locator('#staff-main')
  await expect(main.getByRole('combobox')).toHaveCount(0)
  await expect(main.getByText('Day', { exact: true })).toHaveCount(0)
  await expect(main.getByRole('link', { name: 'Painting days', exact: true })).toHaveCount(0)
  await expect(main.getByRole('button', { name: 'Painting days', exact: true })).toHaveCount(0)
  const pickup = main.getByRole('button').filter({ has: page.getByText('AWGREVIEW · Luna', { exact: true }) })
  await expect(pickup.getByRole('img', { name: 'red ornament', exact: true })).toBeVisible()
  await expect(pickup).not.toContainText(' · red · ')
  const chips = main.getByRole('group', { name: 'Agenda day', exact: true })
  await expect(chips.getByRole('button', { name: /Fri 6 Nov/ })).toHaveAttribute('aria-pressed', 'true')
  const gear = main.getByRole('button', { name: /^Painting hours for Fri,? 6 Nov$/, exact: true })
  await gear.click()
  const dialog = page.getByRole('dialog', { name: /^Painting hours · Fri,? 6 Nov$/, exact: true })
  await expect(dialog.getByRole('spinbutton', { name: /^Max paintings for Fri,? 6 Nov$/, exact: true })).toHaveValue('2')
  await dialog.getByLabel(/^Painting starts Fri,? 6 Nov$/, { exact: true }).fill('09:30')
  await dialog.getByLabel(/^Painting ends Fri,? 6 Nov$/, { exact: true }).fill('18:30')
  await dialog.getByRole('spinbutton', { name: /^Max paintings for Fri,? 6 Nov$/, exact: true }).fill('4')
  await expect.poll(() => fixture.mutations.filter(row => row.path === `/api/painting-days/${today}`).at(-1)?.body).toEqual({ open: true, maxPaintings: 4, openHour: 9.5, closeHour: 18.5 })
  await dialog.getByRole('button', { name: 'Not yet', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await chips.getByRole('button', { name: /Fri 4 Dec/ }).click()
  await main.getByRole('button', { name: /^Painting hours for Fri,? 4 Dec$/, exact: true }).click()
  const next = page.getByRole('dialog', { name: /^Painting hours · Fri,? 4 Dec$/, exact: true })
  await expect(next.getByRole('spinbutton', { name: /^Max paintings for Fri,? 4 Dec$/, exact: true })).toHaveValue('2')
  await expect(next.getByLabel(/^Painting starts Fri,? 4 Dec$/, { exact: true })).toHaveValue('10:00')
  await mobileLayout(page)
  await next.getByRole('button', { name: 'Not yet', exact: true }).click()
})

test('a calendar sale reserves visible paint cards in List and Calendar and opens its order', async ({ page }) => {
  const fixture = await httpFixture(page)
  await signedIn(page, `/staff/sales/new?date=${today}&start=13&end=14`)
  await expect(page.getByRole('heading', { name: /Custom 1/ })).toBeVisible()
  await mobileLayout(page)
  const continueButton = page.getByRole('button', { name: 'Continue', exact: true })
  await clearAction(continueButton)
  await expect(continueButton).toHaveJSProperty('disabled', false)
  await continueButton.click()
  await expect(page.getByRole('heading', { name: 'Painting plan', exact: true })).toBeVisible()
  await expect(page.getByText(/^Fri,? 6 Nov · 13:00–14:00$/, { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/Time available|Paint to reserve|Paint time selected/)).toHaveCount(0)
  await mobileLayout(page)
  const create = page.getByRole('button', { name: 'Create order & show QR', exact: true })
  await clearAction(create)
  expect((await create.boundingBox())!.height).toBeGreaterThanOrEqual(55.5)
  await create.click()
  await expect(page.getByRole('button', { name: 'Enlarge customer QR code', exact: true })).toBeVisible()
  const sale = fixture.saleRequests[0]
  expect(sale).toBeTruthy()
  const code = fixture.records.get(sale.id)!.code
  await expect(page.getByRole('status').filter({ hasText: 'Waiting for customer form' })).toBeVisible()
  await mobileLayout(page)
  await clearAction(page.getByRole('button', { name: 'Continue to payment', exact: true }))
  await page.getByRole('button', { name: 'Continue to payment', exact: true }).click()
  await page.getByRole('radio', { name: 'Cash', exact: true }).locator('..').click()
  await mobileLayout(page)
  const markPaid = page.getByRole('button', { name: /^Mark paid/ })
  await clearAction(markPaid)
  await markPaid.click()
  await expect(page.getByRole('heading', { name: 'Sale recorded', exact: true })).toBeVisible()
  for (const view of ['list', 'calendar']) {
    await navigation(page, `/staff/agenda?date=${today}&view=${view}`)
    const card = page.getByRole('button', { name: new RegExp(`Custom ornament.*${code}`) })
    await expect(card).toHaveCount(1)
    await expect(card).toContainText(code)
    await expect(card).toContainText('Custom ornament')
    await clearAction(card)
    await card.click()
    await expect(page).toHaveURL(new RegExp(`/staff/orders/${sale.id}$`))
    await expect(page.getByRole('heading', { name: code, exact: true })).toBeVisible()
  }
})

test('a delivery cart owns per-item handover and stays together after a partial handover', async ({ page }) => {
  const fixture = await httpFixture(page, { multi: true, finished: true })
  fixture.records.get(fixture.original.id)!.paymentState = 'paid'
  fixture.records.get(fixture.original.id)!.amountPaid = fixture.original.total
  await signedIn(page, `/staff/deliveries?day=${today}`)
  const cart = page.getByRole('article', { name: 'Order AWGREVIEW', exact: true })
  await expect(cart).toHaveCount(1)
  await expect(cart).toContainText(/Market · Fri,? 6 Nov · 17:00/)
  await expect(cart.locator('li')).toHaveCount(2)
  await expect(page.getByText(/Sorted by pickup time|no exact time|All days ·/i)).toHaveCount(0)
  const handover = cart.getByRole('button', { name: 'Hand over Luna', exact: true })
  await expect(handover.locator('xpath=ancestor::li')).toContainText('Luna')
  await clearAction(handover)
  await handover.click()
  const dialog = page.getByRole('dialog', { name: 'Confirm handover', exact: true })
  await expect(dialog.getByRole('checkbox', { name: 'Luna', exact: true })).toBeChecked()
  await expect(dialog.getByRole('checkbox', { name: 'Milo', exact: true })).not.toBeChecked()
  await dialog.getByRole('button', { name: 'Not yet', exact: true }).click()
  expect(fixture.mutations).toHaveLength(0)
  await handover.click()
  await page.getByRole('dialog', { name: 'Confirm handover', exact: true }).getByRole('button', { name: 'Only this one', exact: true }).click()
  await expect(cart).toHaveCount(1)
  await expect(cart.getByRole('button', { name: 'Undo handover Luna', exact: true })).toBeVisible()
  await expect(cart.getByRole('button', { name: 'Hand over Milo', exact: true })).toBeVisible()
  expect(fixture.records.get(fixture.original.id)!.handedOver).toBe(false)
  await mobileLayout(page)
})

test('More groups secondary tools and AWG always returns home', async ({ page }) => {
  await httpFixture(page)
  await signedIn(page, '/staff/inventory')
  await page.getByRole('button', { name: 'More', exact: true }).click()
  const menu = page.getByRole('dialog', { name: 'More staff tools', exact: true })
  for (const label of ['Sales', 'Stock', 'Markets', 'Painting days', 'Change password']) await expect(menu.getByRole('link', { name: label, exact: true })).toBeVisible()
  await expect(menu.getByRole('button', { name: 'Log out', exact: true })).toBeVisible()
  await mobileLayout(page)
  await menu.getByRole('button', { name: 'Not yet', exact: true }).click()
  const home = page.getByRole('link', { name: 'AWG · Agenda', exact: true })
  await expect(home).toBeVisible()
  await home.click()
  await expect(page).toHaveURL(/\/staff\/agenda$/)
})


test('mixed handoff dates and destinations keep one complete order card through filtering and partial handover', async ({ page }) => {
  const fixture = await httpFixture(page, { mixedHandoff: true, finished: true })
  fixture.records.get(fixture.original.id)!.paymentState = 'paid'
  fixture.records.get(fixture.original.id)!.amountPaid = fixture.original.total
  await signedIn(page, '/staff/deliveries')
  const cart = page.getByRole('article', { name: 'Order AWGREVIEW', exact: true })
  await expect(cart).toHaveCount(1)
  await expect(cart.locator('li')).toHaveCount(2)
  const luna = cart.locator('li').filter({ has: page.getByText('Luna', { exact: true }) })
  const milo = cart.locator('li').filter({ has: page.getByText('Milo', { exact: true }) })
  await expect(luna).toContainText(/Market · Fri,? 6 Nov · 17:00/)
  await expect(milo).toContainText(/Vienna · Wed,? 2 Dec/)
  await expect(milo).not.toContainText('17:00')
  // A filter finds an order, then preserves its whole cart and the other destination.
  await openFilters(page)
  await page.getByRole('radio', { name: 'Market', exact: true }).locator('..').click()
  await expect(cart).toHaveCount(1)
  await expect(cart.locator('li')).toHaveCount(2)
  await expect(milo).toContainText(/Vienna · Wed,? 2 Dec/)
  await luna.getByRole('button', { name: 'Hand over Luna', exact: true }).click()
  await page.getByRole('dialog', { name: 'Confirm handover', exact: true }).getByRole('button', { name: 'Only this one', exact: true }).click()
  await expect(cart).toHaveCount(1)
  await expect(cart.locator('li')).toHaveCount(2)
  await expect(luna.getByRole('button', { name: 'Undo handover Luna', exact: true })).toBeVisible()
  await expect(milo.getByRole('button', { name: 'Hand over Milo', exact: true })).toBeDisabled()
  await page.getByRole('radio', { name: 'Vienna', exact: true }).locator('..').click()
  await expect(milo.getByRole('button', { name: 'Hand over Milo', exact: true })).toBeEnabled()
  expect(fixture.records.get(fixture.original.id)!.handedOver).toBe(false)
  await mobileLayout(page)
})

test('shrinking painting hours keeps an existing later booking visible and tappable in Calendar', async ({ page }) => {
  const fixture = await httpFixture(page)
  await signedIn(page, `/staff/agenda?date=${today}&view=calendar`)
  await page.getByRole('button', { name: /^Painting hours for Fri,? 6 Nov$/, exact: true }).click()
  const dialog = page.getByRole('dialog', { name: /^Painting hours · Fri,? 6 Nov$/, exact: true })
  await dialog.getByLabel(/^Painting ends Fri,? 6 Nov$/, { exact: true }).fill('11:00')
  await expect.poll(() => fixture.mutations.filter(row => row.path === `/api/painting-days/${today}`).at(-1)?.body).toEqual({ open: true, maxPaintings: 2, openHour: 10, closeHour: 11 })
  await dialog.getByRole('button', { name: 'Not yet', exact: true }).click()
  const painting = page.getByRole('button', { name: /Luna, paint 12:00–13:00, AWGREVIEW/ })
  await expect(painting).toHaveCount(1)
  await expect(painting).toContainText('AWGREVIEW')
  await clearAction(painting)
  await painting.click()
  await expect(page).toHaveURL(/\/staff\/orders\/order-review$/)
})


test('a filtered batch handover preselects matching items and reports only those saved', async ({ page }) => {
  const fixture = await httpFixture(page, { mixedHandoff: true, finished: true })
  fixture.records.get(fixture.original.id)!.paymentState = 'paid'
  fixture.records.get(fixture.original.id)!.amountPaid = fixture.original.total
  await signedIn(page, '/staff/deliveries')
  await openFilters(page)
  await page.getByRole('radio', { name: 'Market', exact: true }).locator('..').click()
  const cart = page.getByRole('article', { name: 'Order AWGREVIEW', exact: true })
  const milo = cart.locator('li').filter({ has: page.getByText('Milo', { exact: true }) })
  await expect(milo).toContainText('Outside current filters')
  await expect(milo.getByRole('button', { name: 'Hand over Milo', exact: true })).toBeDisabled()
  await cart.getByRole('button', { name: 'Hand over ready items', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Confirm handover', exact: true })
  await expect(dialog.getByRole('checkbox', { name: 'Luna', exact: true })).toBeChecked()
  await expect(dialog.getByRole('checkbox', { name: 'Milo', exact: true })).not.toBeChecked()
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'AWGREVIEW · 1 ornament handed over.' })).toBeVisible()
  expect(fixture.mutations.filter(row => row.path.endsWith('/handed-over')).at(-1)?.body).toEqual({ handedOver: true, itemIds: [fixture.original.itemIds[0]] })
  expect(fixture.records.get(fixture.original.id)!.handedOver).toBe(false)
  await expect(cart).toHaveCount(1)
  await expect(cart.locator('li')).toHaveCount(2)
  // Switching the filter selects the other destination for the next batch.
  await page.getByRole('radio', { name: 'Vienna', exact: true }).locator('..').click()
  await expect(milo.getByRole('button', { name: 'Hand over Milo', exact: true })).toBeEnabled()
  await cart.getByRole('button', { name: 'Hand over ready items', exact: true }).click()
  const next = page.getByRole('dialog', { name: 'Confirm handover', exact: true })
  await expect(next.getByRole('checkbox', { name: /^Luna/ })).not.toBeChecked()
  await expect(next.getByRole('checkbox', { name: 'Milo', exact: true })).toBeChecked()
  await next.getByRole('button', { name: 'Not yet', exact: true }).click()
})

test('production filters keep the whole cart and scope handover to matching items', async ({ page }) => {
  await httpFixture(page, { multi: true }) // Luna not started; Milo finished.
  await signedIn(page, `/staff/deliveries?day=${today}`)
  await openFilters(page)
  await page.getByRole('radio', { name: 'Finished', exact: true }).locator('..').click()
  const cart = page.getByRole('article', { name: 'Order AWGREVIEW', exact: true })
  await expect(cart).toHaveCount(1)
  await expect(cart.locator('li')).toHaveCount(2)
  const luna = cart.locator('li').filter({ has: page.getByText('Luna', { exact: true }) })
  await expect(luna).toContainText('Outside current filters')
  await expect(luna.getByRole('button', { name: 'Hand over Luna', exact: true })).toBeDisabled()
  await expect(cart.getByRole('button', { name: 'Hand over Milo', exact: true })).toBeEnabled()
  await cart.getByRole('button', { name: 'Hand over ready items', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Confirm handover', exact: true })
  await expect(dialog.getByRole('checkbox', { name: 'Luna · Not ready', exact: true })).not.toBeChecked()
  await expect(dialog.getByRole('checkbox', { name: 'Luna · Not ready', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('checkbox', { name: 'Milo', exact: true })).toBeChecked()
  await dialog.getByRole('button', { name: 'Not yet', exact: true }).click()
})
