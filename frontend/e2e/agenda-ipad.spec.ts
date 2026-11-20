import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from '@playwright/test'
import { axe } from './helpers'
import { httpFixture, signedIn, today, marketDay } from './staff-fixture'

const PET_SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="12" fill="#e9d8c3"/><circle cx="48" cy="52" r="24" fill="#8b5a3c"/><circle cx="38" cy="48" r="4" fill="#152033"/><circle cx="58" cy="48" r="4" fill="#152033"/><ellipse cx="48" cy="57" rx="5" ry="3.5" fill="#152033"/></svg>')
const PET_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
const shotsDir = path.resolve(process.cwd(), '../tasks/audit-results/agenda-gaby-away-shots')
const postShotsDir = path.resolve(process.cwd(), '../tasks/audit-results/post-shipping-staff-shots')

test.describe('Agenda iPad', () => {
  test('clean header, matching paint and pickup cards, and hours-derived capacity', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 })
    const fixture = await httpFixture(page, { mixedHandoff: true })
    const item = fixture.items.get(fixture.original.id)!
    item.photos = [{ id: 'pet-1', name: 'pet.gif', dataUrl: '/api/photos/pet-1' }]
    await page.route('**/api/photos/pet-1', route => route.fulfill({ contentType: 'image/gif', body: PET_GIF }))
    await signedIn(page, `/staff/agenda?date=${today}`)

    const heading = page.getByRole('heading', { name: 'Agenda', exact: true })
    const gear = page.getByRole('button', { name: /^Painting hours for Fri,? 6 Nov$/, exact: true })
    await expect(heading.locator('..').getByRole('button')).toHaveCount(1)
    await expect(heading.locator('..')).toHaveText('Agenda')
    await expect(page.locator('#staff-main').getByRole('button', { name: 'Today', exact: true })).toHaveCount(0)

    const paintHeading = page.getByRole('heading', { name: 'Paint sessions', exact: true, level: 2 })
    const pickupsHeading = page.getByRole('heading', { name: 'Pickups and deliveries', exact: true, level: 2 })
    await expect(paintHeading).toBeVisible()
    await expect(pickupsHeading).toBeVisible()
    const [paintBox, pickupsBox] = await Promise.all([paintHeading.boundingBox(), pickupsHeading.boundingBox()])
    expect(paintBox!.x).toBeLessThan(pickupsBox!.x)

    const pickups = page.locator('#agenda-pickups')
    await expect(pickups.getByText('All deliveries', { exact: true })).toHaveCount(0)
    const pickupCard = pickups.getByRole('button', { name: /AWGREVIEW/ })
    await expect(pickupCard).toContainText('AWGREVIEW')
    await expect(pickupCard).toContainText('17:00')
    await expect(pickupCard).toContainText('Pickup at Review Christmas Market')
    await expect(pickupCard.locator('[data-status="not_started"]')).toHaveText('To paint')
    await expect(pickupCard).not.toContainText('Luna')
    await expect(pickupCard).toContainText('Alex Review')
    await expect(pickupCard).not.toContainText('red matte')

    // Feedback 2 & Gear dialog grid: two equal columns with 16px gap inside card padding.
    await expect(page.getByText('1 booked · room for 10', { exact: true })).toBeVisible()
    await gear.click()
    const gearDialog = page.getByRole('dialog', { name: /^Painting hours · Fri,? 6 Nov$/, exact: true })
    await expect(gearDialog.getByRole('spinbutton')).toHaveCount(0)
    await expect(gearDialog.getByText('1 booked · room for 10', { exact: true })).toBeVisible()
    const startInput = gearDialog.getByLabel(/^Painting starts Fri,? 6 Nov$/, { exact: true })
    const endInput = gearDialog.getByLabel(/^Painting ends Fri,? 6 Nov$/, { exact: true })
    const dayCard = gearDialog.locator('article').first()
    const [startBox, endBox, cardBox] = await Promise.all([
      startInput.boundingBox(),
      endInput.boundingBox(),
      dayCard.boundingBox(),
    ])
    expect(Math.abs(startBox!.width - endBox!.width)).toBeLessThanOrEqual(1)
    expect(Math.round(endBox!.x - (startBox!.x + startBox!.width))).toBe(16)
    // 1px border + 16px card padding on both left and right edges.
    expect(Math.round(startBox!.x - cardBox!.x)).toBe(17)
    expect(Math.round((cardBox!.x + cardBox!.width) - (endBox!.x + endBox!.width))).toBe(17)
    await endInput.fill('13:00')
    await expect(gearDialog.getByText('1 booked · room for 3', { exact: true })).toBeVisible()
    await expect.poll(() => fixture.mutations.filter(m => m.path === `/api/painting-days/${today}`).at(-1)?.body)
      .toEqual({ open: true, openHour: 10, closeHour: 13 })
    await gearDialog.getByRole('button', { name: 'Close', exact: true }).click()

    const block = page.locator('[data-slot-id="block-review"]')
    await expect(block).toContainText('AWGREVIEW')
    await expect(block).toContainText('Alex Review')
    await expect(block).toContainText('Pickup Fri 17:00')
    await expect(block.locator('[data-status="not_started"]')).toHaveText('To paint')
    await expect(block).toHaveCSS('background-color', await pickupCard.evaluate(node => getComputedStyle(node).backgroundColor))
    await expect(block).not.toContainText('Luna')
    await expect(block).not.toContainText('12:00–13:00')

    // Feedback 6: larger pet photo using block height.
    const photo = block.getByAltText('Pet photo', { exact: true })
    await expect(photo).toBeVisible()
    const photoBox = (await photo.boundingBox())!
    expect(photoBox.width).toBeGreaterThanOrEqual(60)
    expect(photoBox.height).toBeGreaterThanOrEqual(60)

    // Audit 2: movable slot keeps touch-action: none so Safari does not hijack hold-to-move into scroll.
    expect(await block.evaluate(node => getComputedStyle(node).touchAction)).toBe('none')

    await axe(page)
  })

  test('short 15-minute move drag opens Confirm schedule change without navigating away (Audit 1)', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 })
    const fixture = await httpFixture(page)
    await signedIn(page, `/staff/agenda?date=${today}`)

    const block = page.locator('[data-slot-id="block-review"]')
    const bounds = (await block.boundingBox())!
    const gridBounds = (await block.locator('..').boundingBox())!
    const hourHeight = gridBounds.height / (marketDay.closeHour - marketDay.openHour)

    // Drag down by 15 minutes (pointer release stays inside the original 1h block!).
    const startX = bounds.x + bounds.width / 2
    const startY = bounds.y + bounds.height / 2
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX, startY + 0.25 * hourHeight, { steps: 6 })
    await page.mouse.up()

    // Must stay on Agenda and show Confirm schedule change for 12:15–13:15.
    await expect(page).toHaveURL(/\/staff\/agenda/)
    const dialog = page.getByRole('dialog', { name: 'Confirm schedule change', exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Move AWGREVIEW?')
    await expect(dialog).toContainText('12:15–13:15')
    await dialog.getByRole('button', { name: 'Save move', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(fixture.mutations.filter(m => m.path === '/api/agenda/blocks/block-review')).toEqual([
      { path: '/api/agenda/blocks/block-review', body: { date: today, startHour: 12.25 } },
    ])

    // Subsequent normal click still opens the order.
    await block.click()
    await expect(page).toHaveURL(/\/staff\/orders\/order-review$/)
  })

  test('keyboard and VoiceOver users can move a block and activate the calendar target (Audit 3)', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 })
    const fixture = await httpFixture(page)
    await signedIn(page, `/staff/agenda?date=${today}`)

    // VoiceOver double-tap can dispatch detail=1 on .calendarTarget: must still propose a free time.
    await page.getByRole('button', { name: 'Choose a painting time', exact: true }).evaluate(node => {
      node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
    })
    const newDialog = page.getByRole('dialog', { name: 'New paint session', exact: true })
    await expect(newDialog).toBeVisible()
    await newDialog.getByRole('button', { name: 'Close', exact: true }).click()

    // Keyboard-focusable Move control right after the movable slot opens the time picker.
    const moveButton = page.getByRole('button', { name: 'Move AWGREVIEW', exact: true })
    await moveButton.focus()
    await expect(moveButton).toBeFocused()
    await page.keyboard.press('Enter')

    const dialog = page.getByRole('dialog', { name: 'Confirm schedule change', exact: true })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('New start time', { exact: true }).fill('14:00')
    await expect(dialog).toContainText('14:00–15:00')
    await dialog.getByRole('button', { name: 'Save move', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(fixture.mutations.filter(m => m.path === '/api/agenda/blocks/block-review')).toEqual([
      { path: '/api/agenda/blocks/block-review', body: { date: today, startHour: 14 } },
    ])
    await axe(page)
  })

  test('Vienna delivery block displays Vienna weekday 18–20 in the calendar (Feedback 7)', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 })
    const fixture = await httpFixture(page, { mixedHandoff: true })
    const ornament = fixture.items.get(fixture.original.id)!
    ornament.delivery = {
      kind: 'vienna',
      marketId: 'market-home',
      marketDayId: 'day-vienna',
      deliveryDate: '2026-12-02',
      pickupHour: null,
      address: { line1: 'Examplegasse 2', postalCode: '1010', city: 'Vienna' },
    }
    await signedIn(page, `/staff/agenda?date=${today}`)
    const block = page.locator('[data-slot-id="block-review"]')
    await expect(block).toContainText('AWGREVIEW')
    await expect(block).toContainText('Vienna Wed 18–20')
    await expect(block).not.toContainText('12:00–13:00')
  })

  test('a future Ready session leaves the time interactive and links to its order above the grid', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 })
    await httpFixture(page, { finished: true })
    await signedIn(page, `/staff/agenda?date=${today}`)
    const calendar = page.locator('[data-calendar]')
    await expect(calendar.locator('[data-slot-id="block-review"]')).toHaveCount(0)
    const trace = page.getByRole('button', { name: 'AWGREVIEW painted, recorded at 12:00', exact: true })
    await expect(trace).toBeVisible()
    const grid = (await calendar.boundingBox())!
    const hourHeight = grid.height / (marketDay.closeHour - marketDay.openHour)
    await page.mouse.click(grid.x + grid.width / 2, grid.y + 2 * hourHeight + 2)
    const proposal = page.getByRole('dialog', { name: 'New paint session' })
    await expect(proposal.getByLabel('Paint start', { exact: true })).toHaveValue('12:00')
    await expect(proposal.getByLabel('Paint end', { exact: true })).toHaveValue('13:00')
    await proposal.getByRole('button', { name: 'Close', exact: true }).click()
    await trace.click()
    await expect(page).toHaveURL(/\/staff\/orders\/order-review$/)
  })

  test('Gaby away card replaces calendar at other stall, expands read-only, and restores normal calendar at Gaby stall', async ({ page }, testInfo) => {
    await page.clock.setFixedTime(new Date('2026-11-28T14:10:00Z'))
    await page.addInitScript(() => localStorage.setItem('awg-active-market-id', 'mkt-spittelberg'))
    await page.goto('/staff/agenda')
    await page.getByLabel('Email', { exact: true }).fill('gaby@artwithgab.com')
    await page.getByLabel('Password', { exact: true }).fill('gaby')
    await page.getByRole('button', { name: /Enter|Sign in/ }).click()

    await expect(page.getByRole('heading', { name: 'Agenda', exact: true })).toBeVisible()
    const day = page.getByRole('group', { name: 'Agenda day' }).getByRole('button', { name: /Sat 28 Nov.*(Rathausplatz|Spittelberg)/ })
    await expect(day).toHaveAccessibleName(/Sat 28 Nov.*(?:Rathausplatz.*Spittelberg|Spittelberg.*Rathausplatz)/)
    await expect(day).toHaveAttribute('title', /Rathausplatz.*Spittelberg|Spittelberg.*Rathausplatz/)
    await expect(day.locator('svg')).toBeVisible()

    // Hold reveals the names while leaving the selected day alone.
    const nextDay = page.getByRole('group', { name: 'Agenda day' }).getByRole('button', { name: /Sun 29 Nov/ })
    const marketNames = (await nextDay.getAttribute('title'))!
    await nextDay.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 2, isPrimary: true })
    await expect(page.getByText(marketNames, { exact: true })).toBeVisible()
    await nextDay.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 2, isPrimary: true })
    await nextDay.dispatchEvent('click', { detail: 1 })
    await expect(day).toHaveAttribute('aria-pressed', 'true')

    // Gaby away compact card replaces the calendar by default.
    await expect(page.getByText('Gaby is painting at Rathausplatz this day.', { exact: true })).toBeVisible()
    await expect(page.getByText('3 booked · room for 6', { exact: true })).toBeVisible()
    await expect(page.locator('[data-calendar="true"]')).toHaveCount(0)

    const isIpad = testInfo.project.name === 'ipadPortrait' || testInfo.project.name === 'ipadLandscape'
    if (isIpad) {
      fs.mkdirSync(shotsDir, { recursive: true })
      await page.screenshot({ path: path.join(shotsDir, `agenda-gaby-away-${testInfo.project.name}.png`), fullPage: true })
    }

    // Show sessions expands the calendar read-only (no hold-to-move, no hold-for-new-sale).
    await page.getByRole('button', { name: 'Show sessions', exact: true }).click()
    const calendar = page.locator('[data-calendar="true"]')
    await expect(calendar).toBeVisible()
    await expect(calendar).toHaveAttribute('data-readonly', 'true')
    await expect(page.getByRole('button', { name: 'Choose a painting time' })).toHaveCount(0)
    await expect(page.locator('[data-slot-move]')).toHaveCount(0)
    await expect(page.locator('[data-movable="true"]')).toHaveCount(0)
    const traces = page.getByRole('list', { name: 'Painted sessions' })
    await expect(traces.getByRole('button', { name: /AWG0102 painted/ })).toBeVisible()
    await expect(calendar.locator('[data-slot-id="blk-102"]')).toHaveCount(0)
    await expect(calendar.locator('[data-slot-id="blk-101"] [data-status="finished"]')).toHaveText('Ready')

    // Attempting a drag on a movable-looking slot or free time does not open move or new-sale dialog.
    const slot = page.locator('[data-slot-id="blk-106"]')
    await slot.scrollIntoViewIfNeeded()
    const slotBox = (await slot.boundingBox())!
    await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2 + 40, { steps: 5 })
    await page.mouse.up()
    await expect(page.getByRole('dialog', { name: 'Confirm schedule change' })).toHaveCount(0)
    await expect(page.getByRole('dialog', { name: 'New paint session' })).toHaveCount(0)

    // Gear dialog check & screenshot at both iPad sizes.
    await page.getByRole('button', { name: /^Painting hours for Sat,? 28 Nov$/, exact: true }).click()
    const gearDialog = page.getByRole('dialog', { name: /^Painting hours · Sat,? 28 Nov$/, exact: true })
    await expect(gearDialog).toBeVisible()
    const market = gearDialog.getByLabel('Gaby paints at')
    await expect(market).toHaveValue('')
    await expect(market.locator('option:checked')).toHaveText('Automatic · Rathausplatz')
    await expect(gearDialog.getByText('3 booked · room for 6', { exact: true })).toBeVisible()
    if (isIpad) {
      await page.screenshot({ path: path.join(shotsDir, `agenda-gear-${testInfo.project.name}.png`) })
    }
    await gearDialog.getByRole('button', { name: 'Close', exact: true }).click()

    // Switch active stall to Rathausplatz (where Gaby is painting): normal interactive calendar returns.
    const changeBtn = page.getByRole('button', { name: 'Change market, currently at Christkindlmarkt Spittelberg' })
    await changeBtn.click()
    const picker = page.getByRole('dialog', { name: 'I’m at' })
    await picker.getByRole('button', { name: 'Rathausplatz', exact: true }).click()
    await expect(page.getByText('Gaby is painting at Rathausplatz this day.')).toHaveCount(0)
    await expect(page.locator('[data-calendar="true"]')).toBeVisible()
    await expect(page.getByText('3 booked · room for 6', { exact: true })).toBeVisible()
    await expect(page.locator('[data-movable="true"]')).toHaveCount(1)

    if (isIpad) {
      await page.screenshot({ path: path.join(shotsDir, `agenda-gaby-here-${testInfo.project.name}.png`), fullPage: true })
    }

    await axe(page)
  })

  test('Agenda Post card, Deliveries Ship view with tracking, Order detail tracking & Stock Post settings', async ({ page }, testInfo) => {
    const postDay: import('../src/domain/types').AgendaDay = {
      marketDay: { id: 'day-post-01', marketId: 'market-home', date: '2026-12-01', openHour: 10, closeHour: 13, isToday: false },
      market: { id: 'market-home', name: 'Casa', kind: 'home', totalCost: 0, startDate: null, finishDate: null, stall: null },
      slots: [],
      deliveries: [
        {
          orderId: 'order-review', orderCode: 'AWGREVIEW', itemId: 'item-order-review',
          title: 'Luna', customerName: 'Alex Review', color: 'red', finish: 'matte', backName: 'LUNA',
          productionStatus: 'finished', handedOver: false, deliveryKind: 'post',
          pickupHour: null, methodLabel: 'Post · Tue 1 Dec', timeLabel: null, phone: '+43 660 1234567',
          addressLabel: 'Herrengasse 14, Top 3 · 8010 Graz', photoUrl: '/api/photos/pet-1',
          remaining: 37, paymentState: 'deposit', kind: 'custom', postalCode: '8010',
        },
        {
          orderId: 'order-post-2', orderCode: 'AWGPOST2', itemId: 'item-post-2',
          title: 'Milo', customerName: 'Julia Graz', color: 'green', finish: 'shiny', backName: 'MILO',
          productionStatus: 'finished', handedOver: false, deliveryKind: 'post',
          pickupHour: null, methodLabel: 'Post · Tue 1 Dec', timeLabel: null, phone: '+43 660 9999999',
          addressLabel: 'Sackstraße 2 · 8010 Graz', photoUrl: '/api/photos/pet-1',
          remaining: 0, paymentState: 'paid', kind: 'custom', postalCode: '8010',
        },
      ],
    }
    const fixture = await httpFixture(page, { finished: true, extraAgendaDays: [postDay] })
    await page.route('**/api/photos/pet-1', route => route.fulfill({ contentType: 'image/svg+xml', body: PET_SVG }))
    const postItem = fixture.items.get(fixture.original.id)!
    postItem.photos = [{ id: 'pet-1', name: 'pet.gif', dataUrl: '/api/photos/pet-1' }]
    postItem.backName = 'LUNA'
    postItem.delivery = {
      kind: 'post',
      deliveryDate: '2026-12-01',
      arrivalFrom: '2026-12-03',
      arrivalTo: '2026-12-04',
      address: { line1: 'Herrengasse 14', line2: 'Top 3', postalCode: '8010', city: 'Graz' },
    }
    const postOrder2 = {
      ...fixture.original,
      id: 'order-post-2',
      code: 'AWGPOST2',
      paymentState: 'paid' as const,
      paymentMethod: 'card' as const,
      amountPaid: 57,
      itemIds: ['item-post-2'],
    }
    fixture.records.set(postOrder2.id, postOrder2)
    fixture.items.set(postOrder2.id, {
      ...postItem,
      id: 'item-post-2',
      orderId: postOrder2.id,
      petName: 'Milo',
      backName: 'MILO',
      color: 'green',
      finish: 'shiny',
    })

    // Keep postDay delivery handedOver state in sync after Handed to Post mutates fixture.items.
    await page.route('**/api/orders/order-post-2/handed-over', async route => {
      const body = route.request().postDataJSON() as { handedOver: boolean }
      postDay.deliveries[1].handedOver = body.handedOver
      await route.fallback()
    })

    // 1. Agenda Pickups and deliveries card shows "Post · Tue 1 Dec" with parcel count.
    await signedIn(page, '/staff/agenda?date=2026-12-01')
    const postCard = page.locator('#agenda-pickups').getByRole('button', { name: /Post · Tue 1 Dec/ })
    await expect(postCard).toContainText('2 parcels')
    await postCard.click()

    // 2. Deliveries Ship view: filter All · Market · Post (no Vienna when none exist), parcel count shown once.
    await expect(page).toHaveURL(/\/staff\/deliveries\?day=2026-12-01&kind=post/)
    await expect(page.getByRole('heading', { name: 'Ship · Post', exact: true })).toBeVisible()
    await expect(page.getByText('2 of 2 parcels to hand to Post', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Post · Tue 1 Dec', exact: true })).toBeVisible()
    await expect(page.getByText(/\bparcels?\b/i)).toHaveCount(1)
    const filtersBtn = page.getByRole('button', { name: /^Filters/ })
    if (await filtersBtn.isVisible()) await filtersBtn.click()
    await expect(page.getByRole('radio', { name: 'Post', exact: true })).toBeChecked()
    await expect(page.getByRole('radio', { name: 'Vienna', exact: true })).toHaveCount(0)
    if (await filtersBtn.isVisible()) await filtersBtn.click()

    const paidCard = page.getByRole('article', { name: 'Order AWGPOST2', exact: true })
    await expect(paidCard).toContainText('Sackstraße 2 · 8010 Graz')
    await expect(paidCard.getByRole('button', { name: 'Copy address', exact: true })).toBeVisible()
    await expect(paidCard).toContainText('MILO')
    await expect(paidCard).toContainText('green shiny')
    const unpaidCard = page.getByRole('article', { name: 'Order AWGREVIEW', exact: true })
    await expect(unpaidCard).toContainText(/Collect €37\.00 · deposit paid/)

    // Unpaid Post parcel: handover dialog explains balance must be settled first and never offers "collect later".
    await unpaidCard.getByRole('button', { name: 'Handed to Post', exact: true }).click()
    const dueDialog = page.getByRole('dialog', { name: 'Handed to Post', exact: true })
    await expect(dueDialog).toBeVisible()
    await expect(dueDialog).toContainText('Collect the remaining balance before handing the parcel to Post.')
    await expect(dueDialog.getByRole('button', { name: /collect later/i })).toHaveCount(0)
    await expect(dueDialog.getByRole('button', { name: 'Collect €37.00 & hand to Post', exact: true })).toBeEnabled()
    await dueDialog.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(dueDialog).toHaveCount(0)

    if (testInfo.project.name === 'ipadLandscape' || testInfo.project.name === 'staff-phone-360x640') {
      fs.mkdirSync(postShotsDir, { recursive: true })
      const tag = testInfo.project.name === 'ipadLandscape' ? 'ipad-1180' : 'phone-360'
      await page.screenshot({ path: path.join(postShotsDir, `ship-list-${tag}.png`), fullPage: true })
    }

    await paidCard.getByLabel('Tracking number (optional)', { exact: true }).fill('100456789012')
    const handToPost = paidCard.getByRole('button', { name: 'Handed to Post', exact: true })
    expect((await handToPost.boundingBox())!.height).toBeGreaterThanOrEqual(56)
    await handToPost.click()
    await expect(page.getByRole('status').filter({ hasText: 'AWGPOST2 · handed to Post.' })).toBeVisible()
    expect(fixture.mutations.find(m => m.path === '/api/orders/order-post-2/handed-over')?.body).toEqual({
      handedOver: true,
      itemIds: ['item-post-2'],
      trackingNumber: '100456789012',
    })

    // 3. Order detail: arrival range, tracking link, and saving tracking refetches handedOver so a concurrent shipment is never undone.
    await paidCard.getByRole('link', { name: /AWGPOST2/ }).click()
    await expect(page.getByText('Arrives Thu 3 – Fri 4 Dec').first()).toBeVisible()
    const trackLink = page.getByRole('link', { name: /Track parcel \(100456789012\)/ })
    await expect(trackLink).toHaveAttribute('href', 'https://www.post.at/s/sendungsdetails?snr=100456789012')
    await page.getByLabel('Post tracking number', { exact: true }).fill('AT9876543210')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('link', { name: /Track parcel \(AT9876543210\)/ })).toBeVisible()

    // Simulate opening AWGREVIEW while unshipped, then another iPad ships it before Save is clicked.
    await page.goto('/staff/orders/order-review')
    await expect(page.getByLabel('Post tracking number', { exact: true })).toBeVisible()
    await page.getByLabel('Post tracking number', { exact: true }).fill('AT1122334455')
    // Another iPad marks order-review shipped on the server while this screen stays open.
    fixture.records.get('order-review')!.handedOver = true
    fixture.items.get('order-review')!.handedOver = true
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('link', { name: /Track parcel \(AT1122334455\)/ })).toBeVisible()
    await expect(page.getByText('Shipped', { exact: true })).toBeVisible()
    const reviewTrackMutation = fixture.mutations.filter(m => m.path === '/api/orders/order-review/handed-over').at(-1)
    expect(reviewTrackMutation?.body).toEqual({
      handedOver: true,
      itemIds: ['item-order-review'],
      trackingNumber: 'AT1122334455',
    })
    await axe(page)

    // 4. Stock: shipping fee and Post collection weekdays (1–5) autosave with PRICES_CHANGED handling, plus overrides.
    await page.goto('/staff/inventory')
    await expect(page.getByRole('button', { name: 'Save prices' })).toHaveCount(0)
    await expect(page.getByLabel('Post shipping', { exact: true })).toHaveValue('5.00')
    await page.getByLabel('Post shipping', { exact: true }).fill('6.50')
    await page.getByLabel('Post shipping', { exact: true }).blur()
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible()
    await page.getByRole('checkbox', { name: 'Monday', exact: true }).locator('..').click()
    await expect.poll(() => fixture.mutations.filter(m => m.path === '/api/prices').length).toBe(2)
    expect(fixture.mutations.filter(m => m.path === '/api/prices').at(-1)?.body).toMatchObject({
      shippingFee: 6.5,
      postCollectionDays: ['monday', 'tuesday', 'friday'],
    })

    // Simulate PRICES_CHANGED from another device on a subsequent weekday toggle -> reloads fresh values and alerts.
    let conflictOnce = true
    await page.route('**/api/prices', async route => {
      if (route.request().method() === 'PUT' && conflictOnce) {
        conflictOnce = false
        return route.fulfill({ status: 409, json: { code: 'PRICES_CHANGED', message: 'Someone changed the prices meanwhile.' } })
      }
      await route.fallback()
    })
    await page.getByRole('checkbox', { name: 'Wednesday', exact: true }).locator('..').click()
    await expect(page.getByRole('alert')).toContainText('Someone else changed the prices or collection days.')
    await expect(page.getByRole('checkbox', { name: 'Wednesday', exact: true })).not.toBeChecked()

    await page.getByLabel('Date', { exact: true }).fill('2026-12-09')
    await page.getByRole('button', { name: 'Add extra date', exact: true }).click()
    await expect(page.getByRole('list', { name: 'Post collection date overrides' })).toContainText('Wed 9 Dec')
    await expect(page.getByRole('list', { name: 'Post collection date overrides' })).toContainText('Extra collection')

    if (testInfo.project.name === 'ipadLandscape' || testInfo.project.name === 'staff-phone-360x640') {
      fs.mkdirSync(postShotsDir, { recursive: true })
      const tag = testInfo.project.name === 'ipadLandscape' ? 'ipad-1180' : 'phone-360'
      await page.screenshot({ path: path.join(postShotsDir, `stock-prices-${tag}.png`), fullPage: true })
    }

    await page.getByRole('button', { name: 'Remove override for Wed 9 Dec', exact: true }).click()
    await expect(page.getByText('No date overrides set.')).toBeVisible()
    await axe(page)
  })

  test('Deliveries disables Handed to Post until every ornament in a multi-item Post parcel is finished', async ({ page }) => {
    const partialPostDay: import('../src/domain/types').AgendaDay = {
      marketDay: { id: 'day-post-partial', marketId: 'market-home', date: '2026-12-01', openHour: 10, closeHour: 13, isToday: false },
      market: { id: 'market-home', name: 'Casa', kind: 'home', totalCost: 0, startDate: null, finishDate: null, stall: null },
      slots: [],
      deliveries: [
        {
          orderId: 'order-review', orderCode: 'AWGREVIEW', itemId: 'item-order-review',
          title: 'Luna', customerName: 'Alex Review', color: 'red', finish: 'matte', backName: 'LUNA',
          productionStatus: 'not_started', handedOver: false, deliveryKind: 'post',
          pickupHour: null, methodLabel: 'Post · Tue 1 Dec', timeLabel: null, phone: '+43 660 1234567',
          addressLabel: 'Herrengasse 14 · 8010 Graz', remaining: 0, paymentState: 'paid', kind: 'custom', postalCode: '8010',
        },
        {
          orderId: 'order-review', orderCode: 'AWGREVIEW', itemId: 'item-second',
          title: 'Milo', customerName: 'Alex Review', color: 'green', finish: 'shiny', backName: 'MILO',
          productionStatus: 'finished', handedOver: false, deliveryKind: 'post',
          pickupHour: null, methodLabel: 'Post · Tue 1 Dec', timeLabel: null, phone: '+43 660 1234567',
          addressLabel: 'Herrengasse 14 · 8010 Graz', remaining: 0, paymentState: 'paid', kind: 'custom', postalCode: '8010',
        },
      ],
    }
    await httpFixture(page, { multi: true, finished: false, extraAgendaDays: [partialPostDay] })
    await signedIn(page, '/staff/deliveries?day=2026-12-01&kind=post')
    const card = page.getByRole('article', { name: 'Order AWGREVIEW', exact: true })
    await expect(card).toContainText('LUNA')
    await expect(card).toContainText('MILO')
    await expect(card.getByRole('button', { name: 'Handed to Post', exact: true })).toBeDisabled()
    await expect(card.getByLabel('Tracking number (optional)', { exact: true })).toBeDisabled()
  })

  test('Agenda per-block Make room moves movable block with popup and shows plain 409 errors', async ({ page }) => {
    const fixture = await httpFixture(page)
    const item = fixture.items.get(fixture.original.id)!
    item.photos = [{ id: 'pet-1', name: 'pet.gif', dataUrl: '/api/photos/pet-1' }]
    item.delivery = {
      kind: 'post',
      deliveryDate: '2026-12-01',
      arrivalFrom: '2026-12-03',
      arrivalTo: '2026-12-04',
      address: { line1: 'Herrengasse 14', postalCode: '8010', city: 'Graz' },
    }
    await page.route('**/api/photos/pet-1', route => route.fulfill({ contentType: 'image/gif', body: PET_GIF }))

    let mode: 'no_slot' | 'not_movable' | 'ok' = 'no_slot'
    await page.route('**/api/agenda/blocks/*/make-room', route => {
      if (mode === 'no_slot') {
        return route.fulfill({ status: 409, json: { code: 'NO_SLOT_KEEPS_PROMISE', message: 'No free slot before the handoff day. Move the session by hand.' } })
      }
      if (mode === 'not_movable') {
        return route.fulfill({ status: 409, json: { code: 'SESSION_NOT_MOVABLE', message: 'This session cannot be moved: it is handed over the day it is painted.' } })
      }
      return route.fulfill({
        status: 200,
        json: {
          moved: [{
            itemId: item.id,
            orderCode: fixture.original.code,
            from: { date: today, startHour: 12, endHour: 13 },
            to: { date: '2026-11-09', startHour: 10, endHour: 11 },
          }],
        },
      })
    })

    await signedIn(page, `/staff/agenda?date=${today}`)
    const makeRoomBtn = page.getByRole('button', { name: 'Make room · AWGREVIEW', exact: true })
    await expect(makeRoomBtn).toBeVisible()

    // 409 NO_SLOT_KEEPS_PROMISE
    await makeRoomBtn.click()
    await expect(page.getByRole('alert')).toContainText('No free slot before the handoff day')

    // 409 SESSION_NOT_MOVABLE
    mode = 'not_movable'
    await makeRoomBtn.click()
    await expect(page.getByRole('alert')).toContainText('cannot be moved')

    // 200 success popup
    mode = 'ok'
    await makeRoomBtn.click()
    const popup = page.getByRole('dialog', { name: 'Session moved', exact: true })
    await expect(popup).toBeVisible()
    await expect(popup).toContainText('AWGREVIEW')
    await expect(popup).toContainText('Fri 12:00')
    await expect(popup).toContainText('Mon 10:00')
    await popup.getByRole('button', { name: 'OK', exact: true }).click()
    await expect(popup).toHaveCount(0)
    await axe(page)
  })
})
