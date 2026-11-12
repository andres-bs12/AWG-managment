import { test, expect, type Page } from '@playwright/test'
import { axe } from './helpers'
import { staffUser, token, today, marketDay, spareMarket, httpFixture, navigation, signedIn, newFinishedSale } from './staff-fixture'

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
  await expect(page.getByText(/^Fri,? 6 Nov · 13:00–14:00$/, { exact: true }).first()).toBeVisible()
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
  await page.getByRole('checkbox', { name: /Name on ornament/ }).check()
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
  const dialog = page.getByRole('dialog', { name: 'Confirm handover', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText(/37[.,]00/)
  // The recorded payment method is preselected, so the safe action is ready; the risky one is quiet.
  await expect(dialog.getByRole('radio', { name: 'Cash', exact: true })).toBeChecked()
  await expect(dialog.getByRole('button', { name: /Mark paid.*hand over/i })).toBeEnabled()
  const quietBackground = await dialog.getByRole('button', { name: 'Hand over with balance due', exact: true }).evaluate(node => getComputedStyle(node).backgroundColor)
  expect(quietBackground).toBe('rgba(0, 0, 0, 0)')
  expect(fixture.mutations.some(entry => entry.path.endsWith('/handed-over'))).toBe(false)
  await axe(page)
  await dialog.getByRole('button', { name: 'Not yet', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Mark picked up', exact: true })).toBeFocused()
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

test('order handover lets staff choose ornaments and leave the rest pending', async ({ page }) => {
  const fixture = await httpFixture(page, { finished: true, multi: true })
  fixture.original.paymentState = 'paid'; fixture.original.amountPaid = fixture.original.total
  await signedIn(page, `/staff/orders/${fixture.original.id}`)
  await page.getByRole('button', { name: 'Mark picked up', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Confirm handover' })
  await expect(dialog.getByRole('checkbox', { name: 'Luna' })).toBeChecked()
  await expect(dialog.getByRole('checkbox', { name: 'Milo' })).toBeChecked()
  await dialog.getByRole('checkbox', { name: 'Milo' }).uncheck()
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  expect(fixture.original.handedOver).toBe(false)
  await expect(page.getByRole('article', { name: 'Luna' }).getByRole('button', { name: 'Undo handover' })).toBeVisible()
  await expect(page.getByRole('article', { name: 'Milo' }).getByRole('button', { name: 'Mark handed over' })).toBeVisible()
})

test('item handover and undo allow selecting other ornaments', async ({ page }) => {
  const fixture = await httpFixture(page, { finished: true, multi: true })
  fixture.original.paymentState = 'paid'; fixture.original.amountPaid = fixture.original.total
  await signedIn(page, `/staff/orders/${fixture.original.id}`)
  await page.getByRole('article', { name: 'Luna' }).getByRole('button', { name: 'Mark handed over' }).click()
  const dialog = page.getByRole('dialog', { name: 'Confirm handover' })
  await expect(dialog).toContainText('1 more item')
  await expect(dialog.getByRole('checkbox', { name: 'Luna' })).toBeChecked()
  await expect(dialog.getByRole('checkbox', { name: 'Milo' })).not.toBeChecked()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Only this one' }).click()
  await expect(page.getByRole('article', { name: 'Luna' }).getByRole('button', { name: 'Undo handover' })).toBeVisible()
  expect(fixture.original.handedOver).toBe(false)
  await page.getByRole('article', { name: 'Milo' }).getByRole('button', { name: 'Mark handed over' }).click()
  await page.getByRole('dialog', { name: 'Confirm handover' }).getByRole('button', { name: 'Save' }).click()
  expect(fixture.original.handedOver).toBe(true)
  await page.getByRole('button', { name: 'Undo pickup' }).click()
  const undo = page.getByRole('dialog', { name: 'Undo handover' })
  await expect(undo.getByRole('checkbox', { name: 'Luna' })).toBeChecked()
  await expect(undo.getByRole('checkbox', { name: 'Milo' })).toBeChecked()
  await undo.getByRole('checkbox', { name: 'Milo' }).uncheck()
  await undo.getByRole('button', { name: 'Save' }).click()
  expect(fixture.original.handedOver).toBe(false)
})

test('delivery rows show the amount to collect before handover', async ({ page }) => {
  await httpFixture(page, { finished: true })
  await signedIn(page, `/staff/deliveries?day=${today}`)
  await expect(page.getByText(/Collect.*37[.,]00/)).toBeVisible()
  const cart = page.getByRole('article', { name: 'Order AWGREVIEW', exact: true })
  const action = cart.getByRole('button', { name: 'Hand over Luna', exact: true })
  await expect(action.locator('xpath=ancestor::li')).toContainText('Luna')
  await expect(cart).toContainText(/Fri,? 6 Nov · 17:00/)
  await action.click()
  const dialog = page.getByRole('dialog', { name: 'Confirm handover', exact: true })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: /Mark paid.*hand over/i }).click()
  // The handed-over order keeps its place and the change is announced.
  await expect(page.getByRole('status').filter({ hasText: 'AWGREVIEW · 1 ornament handed over.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Undo handover Luna', exact: true })).toBeVisible()
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
  await unpaid.click()
  const confirmDialog = page.getByRole('dialog', { name: 'Correct payment?', exact: true })
  await expect(confirmDialog).toContainText('to unpaid')
  await axe(page)
  await confirmDialog.getByRole('button', { name: 'Correct to unpaid', exact: true }).click()
  await expect(confirmDialog).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveText('Check this payment in Stripe first: checkout is still open.')
  await expect(page.getByRole('alert')).toHaveCount(1)
})

test('pending web payments cannot be manually collected or painted from the order page', async ({ page }) => {
  const fixture = await httpFixture(page, { checkoutStatus: 'pending' })
  await signedIn(page, `/staff/orders/${fixture.original.id}`)
  await expect(page.getByText(/Waiting for online payment/).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /^Mark paid/ })).toHaveCount(0)
  // Not ready for handoff or painting until Stripe confirms; Cancel is quiet, never the biggest action.
  await expect(page.getByText(/^(Ready for pickup|Ready for delivery)$/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mark picked up', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Open delivery run', exact: true })).toHaveCount(0)
  const cancel = page.getByRole('button', { name: 'Cancel order', exact: true })
  expect(await cancel.evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
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
  await dialog.getByRole('button', { name: 'Not yet', exact: true }).click()
  expect(fixture.mutations).toHaveLength(0)
  await page.getByRole('button', { name: 'Cancel order', exact: true }).click()
  await dialog.getByLabel('Reason (optional)').fill('Customer request')
  await dialog.getByRole('button', { name: 'Cancel order', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Cancelled order' })).toBeVisible()
  await expect(page.getByText('Reason: Customer request')).toBeVisible()
  expect(fixture.records.get(fixture.original.id)?.status).toBe('CANCELLED')
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
  await page.getByRole('button', { name: /^Remove / }).first().click()
  const dayDialog = page.getByRole('dialog', { name: 'Remove day?', exact: true })
  await expect(dayDialog).toBeVisible()
  await dayDialog.getByRole('button', { name: /Delete day|Remove day/ }).click()
  await expect(page.getByRole('button', { name: /^Remove / })).toHaveCount(2)
  expect(fixture.mutations).toHaveLength(0)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Market updated', exact: true })).toBeVisible()
  expect(fixture.mutations.find(entry => entry.path === '/api/markets')?.body).toMatchObject({ id: spareMarket.id, days: expect.arrayContaining([expect.objectContaining({ date: '2026-12-05' }), expect.objectContaining({ date: '2026-12-06' })]) })
  await page.getByRole('button', { name: 'Delete market', exact: true }).click()
  const marketDialog = page.getByRole('dialog', { name: 'Delete market?', exact: true })
  await expect(marketDialog).toBeVisible()
  expect(fixture.mutations.some(entry => entry.path === `/api/markets/${spareMarket.id}`)).toBe(false)
  await axe(page)
  await marketDialog.getByRole('button', { name: 'Not yet', exact: true }).click()
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

test('leaving a created sale is explicit, the QR stays reachable from payment, and large actions are 56px', async ({ page }) => {
  const fixture = await httpFixture(page)
  await signedIn(page, `/staff/sales/new?date=${today}&start=13&end=14`)
  const proceed = page.getByRole('button', { name: 'Continue', exact: true })
  expect((await proceed.boundingBox())!.height).toBeGreaterThanOrEqual(56)
  await proceed.click()
  await page.getByRole('button', { name: 'Create order & show QR', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Enlarge customer QR code', exact: true })).toBeVisible()
  await expect.poll(() => fixture.saleRequests.length).toBe(1)
  const code = fixture.records.get(fixture.saleRequests[0].id)!.code
  await expect(page.getByRole('button', { name: 'Start over', exact: true })).toHaveCount(0)
  await page.locator('[class*="head"]').getByRole('button', { name: 'New sale', exact: true }).click()
  const leave = page.getByRole('dialog', { name: 'Leave this sale?', exact: true })
  await expect(leave).toContainText(`${code} stays saved and unpaid`)
  await axe(page)
  await leave.getByRole('button', { name: 'Not yet', exact: true }).click()
  await expect(leave).toHaveCount(0)
  const toPayment = page.getByRole('button', { name: 'Continue to payment', exact: true })
  expect((await toPayment.boundingBox())!.height).toBeGreaterThanOrEqual(56)
  await toPayment.click()
  await page.getByRole('button', { name: 'Show QR again', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Enlarge customer QR code', exact: true })).toBeVisible()
  expect(fixture.saleRequests).toHaveLength(1)
  expect(fixture.mutations.filter(entry => entry.path.endsWith('/payment-state'))).toHaveLength(0)
})

test('after the QR, Change date asks first, cancels the order and offers only pickup hours with paint time', async ({ page }) => {
  const fixture = await httpFixture(page)
  await signedIn(page, `/staff/sales/new?date=${today}&start=13&end=14`)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Create order & show QR', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Enlarge customer QR code', exact: true })).toBeVisible()
  await expect.poll(() => fixture.saleRequests.length).toBe(1)
  const firstId = fixture.saleRequests[0].id

  // Only hours from 17:00 leave time to paint.
  await page.route('**/api/agenda/capacity', async route => {
    const body = route.request().postDataJSON() as { beforeHour?: number }
    return route.fulfill({ json: body.beforeHour != null && body.beforeHour < 17
      ? { ok: false, slot: null, remainingHours: 0, message: 'No free paint slot before this handoff.' }
      : { ok: true, slot: { date: today, startHour: 13, endHour: 14 }, remainingHours: 3, message: 'Available' } })
  })

  await page.getByRole('button', { name: 'Change date', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Change the date?', exact: true })
  await expect(dialog).toContainText('will be cancelled')
  await expect(dialog).toContainText('The customer already sent the form')
  await axe(page)
  await dialog.getByRole('button', { name: 'Not yet', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(fixture.mutations.filter(entry => entry.path.endsWith('/cancel'))).toHaveLength(0)

  await page.getByRole('button', { name: 'Change date', exact: true }).click()
  await dialog.getByRole('button', { name: 'Cancel order & choose new date', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Pickup and paint', exact: true })).toBeVisible()
  expect(fixture.mutations.map(entry => entry.path)).toContain(`/api/orders/${firstId}/cancel`)

  const late = page.getByRole('button', { name: '17:00', exact: true })
  await expect(late).toBeEnabled()
  const hours = page.locator('[class*="hours"] button')
  // The hour chosen before stays pressable and explains why it no longer works; other early hours are disabled.
  await expect(page.getByText('Pickup 14:00 · no painting time left before it.')).toBeVisible()
  for (const button of await hours.all()) {
    const label = (await button.textContent())!.trim()
    if (Number(label.slice(0, 2)) < 17 && await button.getAttribute('aria-pressed') !== 'true') await expect(button).toBeDisabled()
  }
  await late.hover()
  await expect(page.getByText(/Pickup 17:00 · paint 13:00–14:00/)).toBeVisible()
  await late.click()
  const create = page.getByRole('button', { name: 'Create order & show QR', exact: true })
  await expect(create).toBeEnabled()
  await create.click()
  await expect(page.getByRole('button', { name: 'Enlarge customer QR code', exact: true })).toBeVisible()
  await expect.poll(() => fixture.saleRequests.length).toBe(2)
  expect(fixture.saleRequests[1].key).not.toBe(fixture.saleRequests[0].key)
  expect(fixture.saleRequests[1].input.items).toEqual([expect.objectContaining({ pickupHour: 17, paintStart: 13, paintEnd: 14 })])
})

test('Change date refuses to cancel an order that already has a payment', async ({ page }) => {
  const fixture = await httpFixture(page)
  await signedIn(page, `/staff/sales/new?date=${today}&start=13&end=14`)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Create order & show QR', exact: true }).click()
  await expect.poll(() => fixture.saleRequests.length).toBe(1)
  const id = fixture.saleRequests[0].id
  // A payment committed elsewhere (or with a lost response) shows up when the order is re-read.
  Object.assign(fixture.records.get(id)!, { paymentState: 'paid', paymentMethod: 'cash', amountPaid: fixture.records.get(id)!.total })
  await page.getByRole('button', { name: 'Change date', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Change the date?', exact: true })
  await expect(dialog).toContainText('already has a payment recorded')
  await expect(dialog.getByRole('button', { name: 'Cancel order & choose new date', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Open order', exact: true })).toBeVisible()
  expect(fixture.mutations.filter(entry => entry.path.endsWith('/cancel'))).toHaveLength(0)
})

test('mock: one finished ornament, Deliver now, Paid in cash completes the sale', async ({ page }) => {
  await page.goto('/staff/login')
  // The demo email is prefilled, so the password has focus.
  await expect(page.getByLabel('Password', { exact: true })).toBeFocused()
  await page.getByLabel('Password', { exact: true }).fill('gaby')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.locator('div[data-staff-page]')).toBeVisible()
  await navigation(page, '/staff/sales/new')
  await page.getByRole('button', { name: /Add finished product/ }).click()
  // The mock answers with latency: wait for server prices and stock before continuing.
  await expect(page.getByText(/^Finished stock: \d+ left$/)).toBeVisible()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('radio', { name: 'Deliver now', exact: true }).locator('..').click()
  await page.getByRole('radio', { name: 'Paid', exact: true }).locator('..').click()
  await page.getByRole('radio', { name: 'Cash', exact: true }).locator('..').click()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Open order', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Retry checks', exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Open order', exact: true }).click()
  await expect(page.getByText(/^Handed over$/).first()).toBeVisible()
})

test('painting days hide past days, flag over-limit days and save each change without a Save button', async ({ page }) => {
  const fixture = await httpFixture(page)
  await signedIn(page, '/staff/painting-days')
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(2)
  await expect(page.getByText('3/2 booked · Over limit; existing bookings remain')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0)
  const toggle = page.getByRole('switch', { name: /^Open\b/ }).first()
  const box = await toggle.boundingBox()
  expect(box!.width).toBeGreaterThanOrEqual(24)
  await page.getByRole('button', { name: /^Increase Max paintings/ }).first().click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible()
  await expect(page.getByText('1/3 booked', { exact: true })).toBeVisible()
  await toggle.uncheck()
  await expect.poll(() => fixture.mutations.filter(entry => entry.path.startsWith('/api/painting-days/')).map(entry => entry.body)).toEqual([{ open: true, maxPaintings: 3, openHour: 10, closeHour: 20 }, { open: false, maxPaintings: 3, openHour: 10, closeHour: 20 }])
  await axe(page)
})

test('agenda hours and blocks scale together at 200% text without clipped lines', async ({ page }) => {
  await httpFixture(page)
  await page.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '200%' }) })
  await signedIn(page, `/staff/agenda?date=${today}&view=calendar`)
  const slot = page.locator('[data-slot]').first()
  await expect(slot).toBeVisible()
  const geometry = await slot.evaluate(node => {
    const box = node.getBoundingClientRect()
    return { height: box.height, clipped: [...node.children].some(child => { const r = child.getBoundingClientRect(); return r.top < box.top - 1 || r.bottom > box.bottom + 1 }) }
  })
  // A 60-minute block at 32px text: one hour is 5rem (160px) minus the 4px gap.
  expect(geometry.height).toBe(156)
  expect(geometry.clipped).toBe(false)
})

test('a market day conflict is shown next to Save with focus and marks its day row', async ({ page }) => {
  await httpFixture(page)
  await page.route(url => url.pathname === '/api/markets', route => route.request().method() === 'POST'
    ? route.fulfill({ status: 400, json: { status: 400, code: 'DAY_HAS_DELIVERIES', field: 'days', message: 'Sat 5 Dec: Vienna deliveries are booked that day; move them before adding a stall day' } })
    : route.fallback())
  await signedIn(page, `/staff/markets/${spareMarket.id}`)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const alert = page.getByRole('alert').filter({ hasText: 'Vienna deliveries are booked' })
  await expect(alert).toBeFocused()
  await expect(alert).toBeInViewport()
  const row = page.locator('li[data-invalid]')
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('5 Dec')
  await expect(row).toContainText('Has Vienna deliveries')
  await axe(page)
})

test('stock rows save only when changed and a conflict keeps the server value by default', async ({ page }) => {
  const fixture = await httpFixture(page)
  await signedIn(page, '/staff/inventory')
  const row = page.getByRole('group', { name: 'Custom · red · shiny', exact: true })
  const save = row.getByRole('button', { name: 'Save', exact: true })
  await expect(save).toBeDisabled()
  await row.getByRole('button', { name: /^Increase/ }).click()
  await expect(save).toBeEnabled()
  // Another device sells one meanwhile: the server answers STOCK_CHANGED.
  await page.route(url => url.pathname === '/api/inventory', route => route.fulfill({ json: [{ id: 'stock-0', kind: 'custom', color: 'red', finish: 'shiny', quantity: 2 }] }))
  await page.route(url => url.pathname === '/api/inventory/stock-0', route => route.fulfill({ status: 409, json: { code: 'STOCK_CHANGED', message: 'Stock changed.' } }))
  await save.click()
  await expect(row.getByRole('alert')).toContainText('Server now has 2')
  const keep = row.getByRole('button', { name: 'Keep 2', exact: true })
  const overwrite = row.getByRole('button', { name: 'Save 4', exact: true })
  await expect(overwrite).toBeVisible()
  expect(await keep.evaluate(node => getComputedStyle(node).backgroundColor)).not.toBe(await overwrite.evaluate(node => getComputedStyle(node).backgroundColor))
  await keep.click()
  await expect(row.getByRole('spinbutton')).toHaveValue('2')
  expect(fixture.mutations.filter(entry => entry.path.startsWith('/api/inventory/'))).toHaveLength(0)
  await axe(page)
})

async function mockSignIn(page: Page, to: string) {
  await page.goto('/staff/login')
  await page.getByLabel('Password', { exact: true }).fill('gaby')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.locator('div[data-staff-page]')).toBeVisible()
  await navigation(page, to)
}

test('mock: a multi-ornament order is grouped before production filters and rows keep their place', async ({ page }) => {
  await mockSignIn(page, '/staff/deliveries')
  const group = page.getByRole('article', { name: 'Order AWG0107', exact: true })
  await expect(group).toBeVisible()
  await expect(group.locator('li')).toHaveCount(2)
  await expect(group.getByRole('button', { name: 'Hand over Pip', exact: true })).toBeDisabled()
  await expect(group.getByRole('button', { name: 'Hand over Dot', exact: true })).toBeEnabled()
  // Under "Finished" the half-finished order stays one cart: its finished ornament can be handed
  // over, the unfinished one stays visible but disabled.
  const filters = page.getByRole('button', { name: /^Filters/ })
  if (await filters.isVisible()) await filters.click()
  await page.getByRole('radio', { name: 'Finished', exact: true }).locator('..').click()
  await expect(group.locator('li')).toHaveCount(2)
  await expect(group.getByRole('button', { name: 'Hand over Dot', exact: true })).toBeEnabled()
  await expect(group.getByRole('button', { name: 'Hand over Pip', exact: true })).toBeDisabled()
  await page.getByRole('group', { name: 'Production', exact: true }).getByRole('radio', { name: 'All', exact: true }).locator('..').click()
  const carts = page.getByRole('article', { name: /^Order AWG/ })
  const codes = () => carts.evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')))
  const before = await codes()
  const ready = carts.filter({ has: page.locator('li').getByRole('button', { name: /^Hand over /, disabled: false }) }).first()
  const code = (await ready.getAttribute('aria-label'))!.replace('Order ', '')
  await ready.locator('li').getByRole('button', { name: /^Hand over /, disabled: false }).first().click()
  const balance = page.getByRole('dialog', { name: 'Confirm handover', exact: true })
  await expect(balance).toBeVisible()
  if (await balance.getByRole('button', { name: /Mark paid.*hand over/i }).isVisible()) await balance.getByRole('button', { name: /Mark paid.*hand over/i }).click()
  else await balance.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: `${code} · 1 ornament handed over.` })).toBeVisible()
  expect(await codes()).toEqual(before)
  await page.getByRole('article', { name: `Order ${code}`, exact: true }).getByRole('button', { name: /^Undo handover / }).first().click()
  await page.getByRole('dialog', { name: 'Undo handover' }).getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: `${code} · 1 ornament handover undone.` })).toBeVisible()
  expect(await codes()).toEqual(before)
})

test('mock: a full Today cannot be chosen and the market-day choice opens instead', async ({ page }) => {
  await mockSignIn(page, '/staff/sales/new')
  await page.getByRole('button', { name: /Add custom ornament/ }).click()
  await expect(page.getByRole('heading', { name: /Custom 1 · €/ })).toBeVisible()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  const todayOption = page.getByRole('radio', { name: 'Today · full', exact: true })
  await expect(todayOption).toBeDisabled()
  await expect(page.getByRole('status').filter({ hasText: /Today is full/ })).toBeVisible()
  await expect(page.getByText('Choose market day', { exact: true })).toBeVisible()
  await axe(page)
})

test('painting-day edits typed quickly are all sent, even when leaving during the pause', async ({ page }) => {
  const fixture = await httpFixture(page)
  await page.route(url => url.pathname.startsWith('/api/painting-days/'), async route => { await new Promise(resolve => setTimeout(resolve, 300)); await route.fallback() })
  await signedIn(page, '/staff/painting-days')
  const increase = page.getByRole('button', { name: /^Increase Max paintings/ }).first()
  await increase.click()
  await increase.click()
  await increase.click()
  await expect(page.getByRole('spinbutton').first()).toHaveValue('5')
  // Leave before the 400ms pause ends: the last value is still saved.
  await navigation(page, '/staff/agenda')
  await expect.poll(() => fixture.mutations.filter(entry => entry.path.startsWith('/api/painting-days/')).map(entry => entry.body)).toEqual([{ open: true, maxPaintings: 5, openHour: 10, closeHour: 20 }])
})

test('a painting-day save that fails after leaving is shown on return and can be retried', async ({ page }) => {
  const fixture = await httpFixture(page)
  let fail = true
  await page.route(url => url.pathname.startsWith('/api/painting-days/'), route => fail ? route.fulfill({ status: 503, json: { code: 'UNAVAILABLE', message: 'Server is busy, try again.' } }) : route.fallback())
  await signedIn(page, '/staff/painting-days')
  await page.getByRole('button', { name: /^Increase Max paintings/ }).first().click()
  await navigation(page, '/staff/agenda')
  await expect(page.getByRole('heading', { name: 'Agenda', exact: true })).toBeVisible()
  await navigation(page, '/staff/painting-days')
  const lost = page.getByRole('alert').filter({ hasText: /^Not saved:/ })
  await expect(lost).toContainText('max 3')
  await axe(page)
  fail = false
  await lost.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(lost).toHaveCount(0)
  // The visible row shows the value that was finally saved.
  await expect(page.getByRole('spinbutton').first()).toHaveValue('3')
  await expect.poll(() => fixture.mutations.filter(entry => entry.path.startsWith('/api/painting-days/')).map(entry => entry.body)).toEqual([{ open: true, maxPaintings: 3, openHour: 10, closeHour: 20 }])
})


test('agenda painting capacity saves changes and warns without removing bookings', async ({ page }) => {
  const fixture = await httpFixture(page)
  await signedIn(page, '/staff/agenda')
  await page.getByRole('button', { name: /^Painting hours for Fri,? 6 Nov$/, exact: true }).click()
  const row = page.getByRole('dialog', { name: /^Painting hours · Fri,? 6 Nov$/, exact: true }).locator('article').filter({ has: page.getByRole('spinbutton', { name: /Max paintings for/ }) })
  await expect(row.getByText('1/2 booked')).toBeVisible()
  await row.getByRole('button', { name: /^Decrease Max paintings/ }).click()
  await row.getByRole('button', { name: /^Decrease Max paintings/ }).click()
  await expect(row.getByText('1/0 booked · Over limit; existing bookings remain')).toBeVisible()
  await expect.poll(() => fixture.mutations.filter(entry => entry.path === `/api/painting-days/${today}`).at(-1)?.body).toEqual({ open: true, maxPaintings: 0, openHour: 10, closeHour: 20 })
  await row.getByRole('switch').uncheck()
  await expect.poll(() => fixture.mutations.filter(entry => entry.path === `/api/painting-days/${today}`).at(-1)?.body).toEqual({ open: false, maxPaintings: 0, openHour: 10, closeHour: 20 })
})
