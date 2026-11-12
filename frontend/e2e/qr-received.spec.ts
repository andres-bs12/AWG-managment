import { test, expect, type Page } from '@playwright/test'
import { photo } from './helpers'

async function staff(page: Page, clockInstalled = false) {
  if (!clockInstalled) await page.clock.setFixedTime(new Date('2026-11-28T10:00:00Z'))
  await page.addInitScript(() => {
    localStorage.setItem('awg-staff-token', 'mock.staff-gaby.qr-test')
    localStorage.setItem('awg-locale', 'en')
  })
  await page.goto('/staff/agenda')
  await expect(page.getByRole('heading', { name: 'Agenda', exact: true })).toBeVisible()
}
async function resumeWaitingSale(page: Page, clockInstalled = false) {
  await staff(page, clockInstalled)
  await page.evaluate(async () => {
    const path = '/src/api/client.ts'
    const { api } = await import(path)
    const bundle = await api.orders.getOrderBundle('ord-wait')
    const draftPath = '/src/pages/staff/saleDraft.ts'
    const { makeCustom } = await import(draftPath)
    sessionStorage.setItem('awg-sale-draft', JSON.stringify({ items: [makeCustom()], differentPickups: false, phase: 'qr', order: bundle.order }))
  })
  await page.goto('/staff/sales/new')
  await expect(page.getByRole('status').filter({ hasText: 'Waiting for customer form' })).toBeVisible()
}

for (const viewport of [{ width: 360, height: 640 }, { width: 440, height: 741 }]) {
  test(`QR save is clear on the customer device and reaches the waiting staff (${viewport.width}x${viewport.height})`, async ({ page, context }) => {
    await page.setViewportSize(viewport)
    await resumeWaitingSale(page)
    const customer = await context.newPage()
    await customer.setViewportSize(viewport)
    await customer.goto('/form/frm-wait')
    await expect(customer.locator('input[id^="pet-"]')).toHaveCount(0)
    await customer.locator('input[id^="back-"]').fill('Luna')
    await customer.locator('input[type=file]').setInputFiles(photo)
    await customer.locator('#form-name').fill('Alex QR')
    await customer.locator('#form-email').fill('alex@example.com')
    await customer.locator('#form-phone').fill('+43 660 1234567')
    await customer.locator('form button[type=submit]').click()
    await expect(customer.locator('#form-heading')).toHaveText('Review & send')
    await customer.locator('form button[type=submit]').click()
    await expect(customer).toHaveURL(/\/track\/AWG0000$/)
    const saved = customer.getByRole('status').filter({ hasText: 'Thank you! Your details are saved.' })
    await expect(saved).toBeVisible()
    await expect(saved).toBeFocused()
    await expect(customer.getByText('Off to the workshop…', { exact: true })).toHaveCount(0)
    await page.bringToFront()
    await expect(page.getByRole('status').filter({ hasText: 'Form received · Alex QR' })).toBeVisible({ timeout: 6500 })
    await expect(page.getByRole('link', { name: 'View details', exact: true })).toHaveAttribute('href', '/staff/orders/ord-wait')
    await page.getByRole('button', { name: 'Continue to payment', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Form received · Alex QR' })).toBeVisible()
  })
}

test('waiting QR polling retries failures with backoff and never overlaps requests', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-28T10:00:00Z') })
  await resumeWaitingSale(page, true)
  // Inject failure only after the mounted QR effect has completed its initial read.
  await page.evaluate(async () => {
    const path = '/src/api/client.ts'
    const { api } = await import(path)
    const original = api.orders.getOrderBundle
    const bundle = await original('ord-wait')
    const fixture = { reads: 0, inFlight: 0, maxInFlight: 0, received: false }
    Object.assign(window, { qrPollFixture: fixture })
    api.orders.getOrderBundle = async () => {
      const read = ++fixture.reads
      fixture.inFlight++; fixture.maxInFlight = Math.max(fixture.maxInFlight, fixture.inFlight)
      try {
        await new Promise(resolve => setTimeout(resolve, 100))
        if (read === 1) throw new Error('Offline')
        return { ...bundle, items: bundle.items.map((item: { formComplete: boolean }) => ({ ...item, formComplete: fixture.received })) }
      } finally { fixture.inFlight-- }
    }
  })
  // Freeze only after setup; focus starts a read on the settled effect, avoiding
  // StrictMode's mount replay and a runFor racing the route's lazy import.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  const reads = () => page.evaluate(() => (window as unknown as { qrPollFixture: { reads: number; maxInFlight: number } }).qrPollFixture)
  await expect.poll(async () => (await reads()).reads).toBe(1)
  await page.clock.runFor(100)
  await expect(page.getByRole('alert')).toContainText('Could not check the customer form')
  expect((await reads()).reads).toBe(1)
  await page.clock.runFor(9999)
  expect((await reads()).reads).toBe(1)
  await page.clock.runFor(101)
  expect((await reads()).reads).toBe(2)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.evaluate(() => { (window as unknown as { qrPollFixture: { received: boolean } }).qrPollFixture.received = true })
  await page.clock.runFor(5100)
  await expect(page.getByRole('status').filter({ hasText: 'Form received' })).toBeVisible()
  const finalReads = (await reads()).reads
  await page.clock.runFor(20_000)
  expect((await reads()).reads).toBe(finalReads)
  expect((await reads()).maxInFlight).toBe(1)
})
