import { test, expect, type Page } from '@playwright/test'

async function openSearch(page: Page) {
  await page.addInitScript(() => localStorage.setItem('awg-staff-token', 'mock.staff-gaby.search-test'))
  await page.goto('/staff/search')
  await expect(page.getByRole('heading', { name: 'Search orders', exact: true })).toBeVisible()
}

test('mock search finds customer names, order codes and phone digits, then shows an empty state', async ({ page }) => {
  await openSearch(page)
  const search = page.getByRole('searchbox', { name: 'Code, customer name or phone', exact: true })
  await search.fill('sArAh')
  await expect(page.getByRole('link', { name: /AWG0100 · Sarah Müller/ })).toBeVisible()
  // An exact order code with a single match opens that order directly.
  await search.fill('awg0103')
  await expect(page).toHaveURL(/\/staff\/orders\/ord-103$/)
  await expect(page.getByRole('heading', { name: 'AWG0103', exact: true })).toBeVisible()
  await page.goto('/staff/search')
  await search.fill('8821100')
  await expect(page.getByRole('link', { name: /AWG0101 · Thomas Weber/ })).toBeVisible()
  await search.fill('customer that does not exist')
  await expect(page.getByRole('status')).toHaveText('No matching orders.')
  await expect(page.locator('ul[aria-busy] a')).toHaveCount(0)
  await search.fill('')
  await expect(page.getByText('No matching orders.', { exact: true })).toHaveCount(0)
})

test('search clears stale results during errors, retries the query and clears its error on reset', async ({ page }) => {
  await openSearch(page)
  const search = page.getByRole('searchbox', { name: 'Code, customer name or phone', exact: true })
  await search.fill('Sarah')
  await expect(page.getByRole('link', { name: /AWG0100 · Sarah Müller/ })).toBeVisible()
  await page.evaluate(async () => {
    const path = '/src/api/client.ts'
    const { api } = await import(path)
    const original = api.orders.search
    let fail = true
    api.orders.search = (query: string) => {
      if (fail) { fail = false; return Promise.reject(new Error('Connection lost.')) }
      return original(query)
    }
  })
  await search.fill('Thomas')
  await expect(page.getByRole('alert')).toContainText('Connection lost.')
  await expect(page.locator('ul[aria-busy] a')).toHaveCount(0)
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('link', { name: /AWG0101 · Thomas Weber/ })).toBeVisible()
  await page.evaluate(async () => {
    const path = '/src/api/client.ts'; const { api } = await import(path)
    api.orders.search = () => Promise.reject(new Error('Still offline.'))
  })
  await search.fill('Sarah')
  await expect(page.getByRole('alert')).toContainText('Still offline.')
  await search.fill('')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.locator('ul[aria-busy] a')).toHaveCount(0)
})
