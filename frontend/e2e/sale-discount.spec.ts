import { expect, test, type Page } from '@playwright/test'
import { axe } from './helpers'

async function signIn(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-28T15:00:00+01:00'))
  await page.addInitScript(() => localStorage.setItem('awg-active-market-id', 'mkt-rathaus'))
  await page.goto('/staff/sales/new')
  await page.getByLabel('Email', { exact: true }).fill('gaby@artwithgab.com')
  await page.getByLabel('Password', { exact: true }).fill('gaby')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

async function pick(page: Page, n: number, id: string) {
  await page.getByRole('button', { name: /Add finished/ }).click()
  const picker = page.getByRole('heading', { name: new RegExp(`^Finished ${n}`) }).locator('xpath=ancestor::article[1]')
  await picker.getByRole('searchbox', { name: 'Search inventory ID' }).fill(id)
  await picker.getByRole('button', { name: new RegExp(`^${id} ·`) }).click()
}

test('staff sells three ready pieces for a discounted total', async ({ page }) => {
  await signIn(page)
  await pick(page, 1, 'RM01')
  await pick(page, 2, 'RM02')
  await pick(page, 3, 'RM03')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  await expect(page.getByText(/List price/).first()).toBeVisible()
  await page.getByRole('button', { name: 'Give a discount', exact: true }).click()
  const price = page.getByLabel('Sale price for the whole order (€)')
  await expect(price).toBeFocused()
  await price.fill('500')
  await expect(page.getByText(/Enter less than the list price/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeDisabled()
  await price.fill('90')
  await expect(page.getByText(/discount/).first()).toBeVisible()
  await expect(page.locator('[data-staff-actions]')).toContainText('Total · discounted')
  await expect(page.locator('[data-staff-actions]')).toContainText('90')
  if (process.env.PW_DISCOUNT_SHOTS) await page.screenshot({ path: `${process.env.PW_DISCOUNT_SHOTS}/discount-${test.info().project.name}.png`, animations: 'disabled' })
  await axe(page)

  await page.getByRole('radio', { name: 'Cash', exact: true }).locator('..').click()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  const done = page.getByRole('status').filter({ hasText: /AWG/ })
  await expect(done).toContainText('€90.00')
  await expect(done).toContainText('received · cash')
  if (process.env.PW_DISCOUNT_SHOTS) await page.screenshot({ path: `${process.env.PW_DISCOUNT_SHOTS}/discount-done-${test.info().project.name}.png`, animations: 'disabled' })
})

test('a discount never carries over silently when the order changes', async ({ page }) => {
  await signIn(page)
  await pick(page, 1, 'RM01')
  await pick(page, 2, 'RM02')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Give a discount', exact: true }).click()
  const price = page.getByLabel('Sale price for the whole order (€)')
  // A typo keeps Done disabled.
  await price.fill('6O')
  await expect(page.getByText('Enter a price in euros.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeDisabled()
  await price.fill('60')
  await expect(page.locator('[data-staff-actions]')).toContainText('Total · discounted')

  // Adding a piece changes the list price: the old sale price must be entered again.
  await page.getByRole('button', { name: 'Back to items', exact: true }).click()
  await pick(page, 3, 'RM03')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByText(/The order changed: the list price is now/)).toBeVisible()
  await expect(page.locator('[data-staff-actions]')).not.toContainText('discounted')
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeDisabled()
  await page.getByLabel('Sale price for the whole order (€)').fill('90')
  await expect(page.locator('[data-staff-actions]')).toContainText('Total · discounted')
})

test('staff changes the price of a past sale after confirming', async ({ page }) => {
  await signIn(page)
  await pick(page, 1, 'RM01')
  await pick(page, 2, 'RM02')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('radio', { name: 'Cash', exact: true }).locator('..').click()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.getByRole('link', { name: 'Open order', exact: true }).click()

  const payment = page.getByRole('region', { name: 'Payment' })
  await payment.locator('summary', { hasText: 'Change price' }).click()
  await payment.getByLabel('New total (€)').fill('60')
  await payment.getByRole('button', { name: /Change price to/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Change price?' })
  await expect(dialog).toContainText('€70.00')
  await expect(dialog).toContainText('€60.00')
  if (process.env.PW_DISCOUNT_SHOTS) await page.screenshot({ path: `${process.env.PW_DISCOUNT_SHOTS}/change-price-${test.info().project.name}.png`, animations: 'disabled' })
  await dialog.getByRole('button', { name: 'Change price', exact: true }).click()
  await expect(payment).toContainText('List price')
  await expect(payment).toContainText('−€10.00')
  await expect(payment.locator('dl')).toContainText('€60.00')
  if (process.env.PW_DISCOUNT_SHOTS) await page.screenshot({ path: `${process.env.PW_DISCOUNT_SHOTS}/changed-price-${test.info().project.name}.png`, animations: 'disabled', fullPage: true })
})
