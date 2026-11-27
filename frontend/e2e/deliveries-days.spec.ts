import { test, expect } from '@playwright/test'
import { httpFixture, signedIn } from './staff-fixture'

// Deliveries day picker (owner, 2026-11-27): a chip only for days that have deliveries, each with its order count.
test('deliveries day chips list only days with deliveries and follow the other filters', async ({ page }, testInfo) => {
  await httpFixture(page, { mixedHandoff: true })
  await signedIn(page, '/staff/deliveries')
  await expect(page.getByRole('heading', { name: 'Deliveries', exact: true, level: 1 })).toBeVisible()
  const button = page.getByRole('button', { name: /^Filters \(/ })
  if (await button.isVisible()) await button.click()
  const mobile = (page.viewportSize()?.width ?? 1280) < 768
  const labels = mobile
    ? () => page.getByLabel('Delivery day', { exact: true }).locator('option').allTextContents()
    : () => page.getByRole('group', { name: 'Day' }).locator('label').allTextContents()
  // Spare market days (4–6 Dec) have no deliveries, so they get no chip.
  await expect.poll(labels).toEqual(['Upcoming · 1', 'Fri 6 Nov · 1', 'Wed 2 Dec · 1'])
  await testInfo.attach('deliveries-days', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  // Narrowing Production to Finished keeps only the day whose ornament is finished.
  await page.getByRole('group', { name: 'Production' }).getByText('Finished', { exact: true }).click()
  await expect.poll(labels).toEqual(['Upcoming · 1', 'Wed 2 Dec · 1'])
})
