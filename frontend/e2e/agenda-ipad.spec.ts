import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from '@playwright/test'
import { axe } from './helpers'
import { httpFixture, signedIn, today, marketDay } from './staff-fixture'

const PET_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
const shotsDir = path.resolve(process.cwd(), '../tasks/audit-results/agenda-gaby-away-shots')

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
})
