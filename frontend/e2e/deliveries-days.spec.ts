import { test, expect } from '@playwright/test'
import { httpFixture, signedIn, spareDays, spareMarket } from './staff-fixture'
import type { AgendaDay } from '../src/domain/types'

// Deliveries day picker (owner, 2026-11-27): a chip only for days that have deliveries, each with its order count.
test('deliveries day chips list only days with deliveries and follow the other filters', async ({ page }, testInfo) => {
  await httpFixture(page, { mixedHandoff: true })
  await signedIn(page, '/staff/deliveries')
  await expect(page.getByRole('heading', { name: 'Deliveries', exact: true, level: 1 })).toBeVisible()
  const button = page.getByRole('button', { name: /^Filters \(/ })
  if (await button.isVisible()) await button.click()
  const mobile = (page.viewportSize()?.width ?? 1280) < 768
  // Chromium versions differ on the weekday comma ("Fri 6 Nov" vs "Fri, 6 Nov"), so compare without it.
  const labels = async () => (await (mobile
    ? page.getByLabel('Delivery day', { exact: true }).locator('option')
    : page.getByRole('group', { name: 'Day' }).locator('label')).allTextContents()).map(text => text.replace(',', ''))
  // Spare market days (4–6 Dec) have no deliveries, so they get no chip.
  await expect.poll(labels).toEqual(['Upcoming · 1', 'Fri 6 Nov · 1', 'Wed 2 Dec · 1'])
  await testInfo.attach('deliveries-days', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  // Narrowing Production to Finished keeps only the day whose ornament is finished.
  await page.getByRole('group', { name: 'Production' }).getByText('Finished', { exact: true }).click()
  await expect.poll(labels).toEqual(['Upcoming · 1', 'Wed 2 Dec · 1'])
})

// A ready-made ornament sold at the stall is handed over at the till: it is a sale, not a pickup (owner, 2026-11-27).
test('ready-made stall sales stay out of Agenda pickups and the Deliveries days', async ({ page }) => {
  const stallSaleDay: AgendaDay = {
    marketDay: spareDays[1], market: spareMarket, slots: [],
    deliveries: [{
      orderId: 'order-walk-in', orderCode: 'AWGWALKIN', itemId: 'item-walk-in', title: 'Walk-in', customerName: 'Walk-in',
      productionStatus: 'finished', handedOver: true, deliveryKind: 'market', pickupHour: null, methodLabel: spareMarket.name,
      marketId: spareMarket.id, marketDayId: spareDays[1].id, timeLabel: null, phone: '', addressLabel: null,
      remaining: 0, paymentState: 'paid', source: 'stall', kind: 'finished',
    }],
  }
  await httpFixture(page, { mixedHandoff: true, extraAgendaDays: [stallSaleDay] })
  await signedIn(page, '/staff/deliveries')
  const button = page.getByRole('button', { name: /^Filters \(/ })
  if (await button.isVisible()) await button.click()
  const mobile = (page.viewportSize()?.width ?? 1280) < 768
  // Chromium versions differ on the weekday comma ("Fri 6 Nov" vs "Fri, 6 Nov"), so compare without it.
  const labels = async () => (await (mobile
    ? page.getByLabel('Delivery day', { exact: true }).locator('option')
    : page.getByRole('group', { name: 'Day' }).locator('label')).allTextContents()).map(text => text.replace(',', ''))
  await expect.poll(labels).toEqual(['Upcoming · 1', 'Fri 6 Nov · 1', 'Wed 2 Dec · 1'])
  await expect(page.getByText('AWGWALKIN')).toHaveCount(0)
  await page.goto(`/staff/agenda?date=${spareDays[1].date}`)
  const pickups = page.locator('#agenda-pickups')
  await expect(pickups.getByText('No deliveries for this day.')).toBeVisible()
  await expect(pickups.getByText('Walk-in')).toHaveCount(0)
})
