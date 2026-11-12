import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import type { BuyMetric } from '../src/api/contracts'
import type { TrackView } from '../src/domain/types'
import { choose, delivery, mobile, next, open, pet, photo } from './helpers'

const code = 'AWGABC123'
const deliveryDate = '2026-12-02'
const metricsEndpoint = /\/api\/metrics\/buy(?:\?.*)?$/
const trackEndpoint = `**/api/track/${code}`
type MetricsWindow = Window & { __awgMetrics?: BuyMetric[]; captureMockBuyMetric?: (metric: BuyMetric) => Promise<void> }

async function useHttpMetrics(page: Page) {
  await page.evaluate(async () => {
    const clientPath = '/src/api/client.ts'
    const httpPath = '/src/api/http/services.ts'
    const { api } = await import(clientPath)
    const { httpApi } = await import(httpPath)
    api.metrics.track = httpApi.metrics.track
  })
}

function trackView(paymentState: 'unpaid' | 'paid'): TrackView {
  return {
    code, paymentState, total: 49.99, status: 'preparing', customerName: 'Alex Example',
    items: [{ kind: 'custom', color: 'red', finish: 'shiny', petName: 'Luna', withName: false, backName: '', productionStatus: 'not_started' }],
    delivery: { kind: 'vienna', deliveryDate, address: { line1: 'Hauptstraße 1', postalCode: '1010', city: 'Wien' } },
    when: { kind: 'vienna', date: deliveryDate, fromHour: null, untilHour: null, marketName: null },
  }
}

// Use the real HTTP adapter at the API boundary, even with Vite's default mock
// source. SPA navigation preserves this per-test override; no backend is needed.
async function showThanks(page: Page, httpMetrics = false) {
  await page.evaluate(async ({ orderCode, useHttpMetrics }) => {
    const clientPath = '/src/api/client.ts'
    const httpPath = '/src/api/http/services.ts'
    const { api } = await import(clientPath)
    const { httpApi } = await import(httpPath)
    api.tracking.getByCode = httpApi.tracking.getByCode
    if (useHttpMetrics) api.metrics.track = httpApi.metrics.track
    ;(window as MetricsWindow).__awgMetrics = []
    window.history.pushState({}, '', `/buy/thanks?code=${encodeURIComponent(orderCode)}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, { orderCode: code, useHttpMetrics: httpMetrics })
}

async function paidThanks(page: Page, httpMetrics = false) {
  await open(page)
  await page.route(trackEndpoint, route => route.fulfill({ json: trackView('paid') }))
  await showThanks(page, httpMetrics)
  await expect(page.getByRole('heading', { level: 1, name: 'Danke für deine Bestellung!' })).toBeVisible()
}

test('confirms only after Track changes from unpaid to paid, then copies and links the code', async ({ page, context, baseURL }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseURL!).origin })
  await open(page)
  const savedDraft = await page.evaluate(() => sessionStorage.getItem('awg-buy-draft'))
  expect(savedDraft).not.toBeNull()
  let paid = false
  let unpaidResponses = 0
  await page.route(trackEndpoint, async route => {
    const state = paid ? 'paid' : 'unpaid'
    await route.fulfill({ json: trackView(state) })
    if (state === 'unpaid') unpaidResponses++
  })
  await showThanks(page)
  await expect(page.getByRole('heading', { name: 'Deine Zahlung wird geprüft' })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Das dauert meist nur ein paar Sekunden.' })).toBeVisible()
  await expect.poll(() => unpaidResponses).toBeGreaterThan(0)
  await expect(page.getByRole('heading', { name: 'Danke für deine Bestellung!' })).toHaveCount(0)
  await expect(page.getByRole('listitem').filter({ hasText: /^Bezahlt/ })).toHaveCount(0)
  await expect(page.getByText(code, { exact: true })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('awg-buy-draft'))).toBe(savedDraft)

  paid = true
  await expect(page.getByRole('heading', { name: 'Danke für deine Bestellung!' })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('heading', { name: 'Deine Zahlung wird geprüft' })).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('awg-buy-draft'))).toBeNull()
  const timeline = page.getByRole('list').filter({ has: page.getByRole('listitem').filter({ hasText: /^Bezahlt/ }) })
  await expect(timeline.getByRole('listitem')).toHaveText(['Bezahlt ✓', 'Wird gemalt', /Lieferung.*2\.\sDezember\s2026.*18–20\sUhr/])
  await expect(page.getByRole('link', { name: 'Bestellung verfolgen', exact: true })).toHaveAttribute('href', `/track/${code}`)
  await page.getByRole('button', { name: 'Code kopieren', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Code kopiert' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(code)
})

for (const response of ['unpaid', 'stalled'] as const) {
  test(`shows the timeout fallback when Track stays ${response}`, async ({ page }) => {
    await open(page)
    await page.clock.install({ time: new Date('2026-11-05T12:00:00Z') })
    await page.clock.pauseAt(new Date('2026-11-05T12:01:00Z'))
    let requests = 0
    await page.route(trackEndpoint, async route => {
      requests++
      if (response === 'unpaid') await route.fulfill({ json: trackView('unpaid') })
      // The stalled case deliberately leaves the request pending until teardown.
    })
    await showThanks(page)
    await expect(page.getByRole('heading', { name: 'Deine Zahlung wird geprüft' })).toBeVisible()
    await expect.poll(() => requests).toBeGreaterThan(0)
    const fallback = page.getByRole('status').filter({ hasText: 'Die Bestätigung dauert länger als sonst.' })
    await expect(fallback).toHaveCount(0)
    await page.clock.fastForward(60_001)
    await expect(fallback).toHaveText('Die Bestätigung dauert länger als sonst. Heb deinen Code auf und sieh in ein paar Minuten unter „Bestellung verfolgen“ nach.')
    await expect(page.getByRole('listitem').filter({ hasText: /^Bezahlt/ })).toHaveCount(0)
    await expect(page.getByRole('group', { name: 'Wie einfach war die Bestellung?' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Bestellung verfolgen', exact: true })).toHaveAttribute('href', `/track/${code}`)
    await expect(page.getByText(code, { exact: true })).toBeVisible()
  })
}

test('downloads a calendar event for the confirmed delivery date', async ({ page }) => {
  await paidThanks(page)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Lieferung zum Kalender hinzufügen', exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('artwithgab-delivery.ics')
  expect(await download.failure()).toBeNull()
  const path = await download.path()
  expect(path).not.toBeNull()
  const content = await readFile(path!, 'utf8')
  const lines = content.split('\r\n')
  expect(lines[0]).toBe('BEGIN:VCALENDAR')
  expect(lines).toContain('BEGIN:VEVENT')
  // A Vienna delivery is a timed event: 18:00–20:00 Europe/Vienna (no longer all-day).
  expect(lines).toContain(`DTSTART;TZID=Europe/Vienna:${deliveryDate.replaceAll('-', '')}T180000`)
  expect(lines).toContain(`DTEND;TZID=Europe/Vienna:${deliveryDate.replaceAll('-', '')}T200000`)
  expect(lines).toContain(`UID:${code}@artwithgab.com`)
  expect(lines.find(line => line.startsWith('SUMMARY:'))).toMatch(/ArtWithGab/)
  expect(lines).toContain('END:VCALENDAR')
})

for (const transport of ['http', 'mock'] as const) {
  test(`SEQ sends only one score of 3 via ${transport} and thanks the customer`, async ({ page }) => {
    const requests: unknown[] = []
    await page.route(metricsEndpoint, async route => {
      expect(route.request().method()).toBe('POST')
      expect(new URL(route.request().url()).search).toBe('')
      requests.push(route.request().postDataJSON())
      await route.fulfill({ status: 204 })
    })
    await paidThanks(page, transport === 'http')
    const seq = page.getByRole('group', { name: 'Wie einfach war die Bestellung?', exact: true })
    await expect(seq.getByRole('radio')).toHaveCount(5)
    await seq.getByRole('radio', { name: '3', exact: true }).check()
    await expect(seq.getByRole('status')).toHaveText('Danke für dein Feedback.')
    await expect(seq.getByRole('radio', { name: '3', exact: true })).toBeChecked()
    const expected = [{ event: 'buy_seq', value: '3' }]
    if (transport === 'http') {
      await expect.poll(() => requests).toEqual(expected)
    } else {
      await expect.poll(() => page.evaluate(() => (window as MetricsWindow).__awgMetrics)).toEqual(expected)
      expect(requests).toEqual([])
    }
    // The answered state stays visible, keeps the chosen value and offers no second submission.
    await page.getByRole('button', { name: 'Code kopieren', exact: true }).focus()
    await expect(seq.getByRole('radio', { name: '3', exact: true })).toBeChecked()
    // One answer only: the other options lock after the first choice.
    await expect(seq.getByRole('radio', { name: '5', exact: true })).toBeDisabled()
    await expect(seq.getByRole('radio', { name: '3', exact: true })).toBeChecked()
    await expect(seq.getByRole('status')).toHaveText('Danke für dein Feedback.')
    if (transport === 'http') expect(requests).toEqual(expected)
    else expect(await page.evaluate(() => (window as MetricsWindow).__awgMetrics)).toEqual(expected)
  })
}

test('cancelled checkout says nothing was charged and restores the saved design', async ({ page }) => {
  await open(page)
  await choose(page)
  await page.getByRole('radio', { name: /^(Ja|Yes),/ }).check()
  await page.locator('input[id^="back-"]').fill('LUNA')
  await page.locator('input[type=file]').setInputFiles(photo)
  await expect(page.getByRole('img', { name: 'Foto 1 von Luna', exact: true })).toBeVisible()
  await page.locator('summary').filter({ hasText: 'Notiz für Gaby' }).click()
  await page.locator('textarea[id^="note-"]').fill('Keep the white whiskers')
  await delivery(page)
  const selectedDate = await page.locator('input[name="delivery-date"]:checked').getAttribute('aria-label')
  expect(selectedDate).not.toBeNull()
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('awg-buy-draft') ?? '{}'))).toMatchObject({
    customerName: 'Alex Example', email: 'alex@example.com', deliveryDate: expect.stringMatching(/^2026-/),
    items: [{ color: 'red', finish: 'shiny', withName: true, backName: 'LUNA', petName: 'Luna', note: 'Keep the white whiskers' }],
  })

  await page.goto(`/buy?cancelled=${code}`)
  await expect(page.getByRole('status').filter({ hasText: 'nichts abgebucht' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Rot', exact: true })).toBeChecked()
  await expect(page.getByRole('radio', { name: 'Glänzend', exact: true })).toBeChecked()
  await expect(page.getByRole('radio', { name: /^(Ja|Yes),/ })).toBeChecked()
  await expect(page.locator('input[id^="back-"]')).toHaveValue('LUNA')
  await page.locator('summary').filter({ hasText: 'Notiz für Gaby' }).click()
  await expect(page.locator('textarea[id^="note-"]')).toHaveValue('Keep the white whiskers')
  await expect(page.getByRole('status').filter({ hasText: 'Fotos können nach dem Neuladen' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Foto 1 von Luna', exact: true })).toHaveCount(0)
  await page.locator('input[type=file]').setInputFiles(photo)
  await expect(page.getByRole('img', { name: 'Foto 1 von Luna', exact: true })).toBeVisible()
  await next(page).click()
  await expect(page.locator('#buy-name')).toHaveValue('Alex Example')
  await expect(page.locator('#buy-email')).toHaveValue('alex@example.com')
  await expect(page.locator('#buy-line1')).toHaveValue('Hauptstraße 1')
  await expect(page.locator('input[name="delivery-date"]:checked')).toHaveAttribute('aria-label', selectedDate!)
})

for (const transport of ['http', 'mock'] as const) {
  test(`full checkout journey via ${transport} emits only allowed metrics without personal text`, async ({ page }) => {
    const networkMetrics: unknown[] = []
    const mockMetrics: BuyMetric[] = []
    await page.route(metricsEndpoint, async route => {
      expect(route.request().method()).toBe('POST')
      expect(new URL(route.request().url()).search).toBe('')
      networkMetrics.push(route.request().postDataJSON())
      await route.fulfill({ status: 204 })
    })
    // Observe the default mock across the full document navigation at checkout.
    // This listens to the same records as __awgMetrics, without skipping mock mode.
    await page.exposeFunction('captureMockBuyMetric', (metric: BuyMetric) => { mockMetrics.push(metric) })
    await page.addInitScript(() => {
      const records: BuyMetric[] = []
      records.push = (...metrics: BuyMetric[]) => {
        for (const metric of metrics) void (window as MetricsWindow).captureMockBuyMetric!(metric)
        return Array.prototype.push.apply(records, metrics)
      }
      ;(window as MetricsWindow).__awgMetrics = records
    })
    await open(page)
    if (transport === 'http') await useHttpMetrics(page)
    await choose(page)
    await pet(page)
    const personal = {
      name: 'Clara Privatprobe', email: 'clara.privatprobe@example.com', street: 'Privatprobegasse 47',
      pet: 'Sternenpfote', note: 'Please paint the tiny silver spot on the left ear',
    }
    await page.locator('summary').filter({ hasText: 'Notiz für Gaby' }).click()
    await page.locator('textarea[id^="note-"]').fill(personal.note)
    await delivery(page)
    await page.locator('#buy-name').fill(personal.name)
    await page.locator('#buy-email').fill(personal.email)
    await page.locator('#buy-line1').fill(personal.street)
    // Include an actual validation event, then recover without losing the draft.
    await page.locator('#buy-postal').fill('9999')
    await page.locator('#buy-name').focus()
    await expect(page.locator('#buy-postal')).toHaveAttribute('aria-invalid', 'true')
    await page.locator('#buy-postal').fill('1010')
    await next(page).click()
    await expect(page.locator('#buy-terms')).toBeVisible()
    await page.locator('#buy-terms').check()
    await page.locator('form button[type=submit]').click()
    await expect(page).toHaveURL(/\/buy\/thanks\?code=AWG[A-Z0-9]+/)
    await expect(page.getByRole('heading', { name: 'Danke für deine Bestellung!' })).toBeVisible()
    const saved = await page.evaluate(() => {
      const code = new URLSearchParams(location.search).get('code')!
      return JSON.parse(localStorage.getItem(`awg-form-token:${code}`) ?? 'null')
    })
    expect(saved).toEqual({ token: expect.any(String), savedAt: Date.parse('2026-11-05T12:00:00Z') })
    if (transport === 'http') await useHttpMetrics(page)
    await page.getByRole('group', { name: 'Wie einfach war die Bestellung?' }).getByRole('radio', { name: '3', exact: true }).check()
    await expect(page.getByRole('status').filter({ hasText: 'Danke für dein Feedback.' })).toBeVisible()

    const allowed = ['buy_view', 'buy_step', 'buy_choice', 'buy_photo_added', 'buy_validation_error', 'buy_pay_click', 'buy_seq']
    await expect.poll(() => [...new Set([...networkMetrics, ...mockMetrics].map(metric => (metric as BuyMetric).event))].sort()).toEqual([...allowed].sort())
    if (transport === 'http') expect(networkMetrics.length).toBeGreaterThan(0)
    else { expect(networkMetrics).toEqual([]); expect(mockMetrics.length).toBeGreaterThan(0) }
    const metrics = [...networkMetrics, ...mockMetrics]
    expect(metrics.length).toBeGreaterThan(0)
    for (const metric of metrics) {
      expect(metric).toEqual(expect.any(Object))
      const record = metric as Record<string, unknown>
      expect(allowed).toContain(record.event)
      expect(Object.keys(record).every(key => ['event', 'step', 'field', 'code', 'value'].includes(key))).toBe(true)
      // Inspect keys and values recursively, including any accidental nested field.
      const serialized = JSON.stringify(metric).toLowerCase()
      for (const text of [...Object.values(personal), 'Luna', 'Alex Example', 'alex@example.com', 'Hauptstraße 1']) {
        expect(serialized).not.toContain(text.toLowerCase())
      }
      expect(serialized).not.toMatch(/data:image|formtoken|tracktoken|\/form\//)
    }
    expect(metrics.filter(metric => (metric as BuyMetric).event === 'buy_seq')).toEqual([{ event: 'buy_seq', value: '3' }])
  })
}

test('HTTP checkout stores a dated token only on success and restores customer Track access', async ({ page }) => {
  await open(page)
  let checkoutFails = true
  await page.route('**/api/shop/checkout', route => checkoutFails
    ? route.fulfill({ status: 400, json: { code: 'OUT_OF_STOCK', message: 'Out of stock.' } })
    : route.fulfill({ json: { orderCode: code, formToken: 'checkout-customer-token', checkoutUrl: `/buy/thanks?code=${code}` } }))
  const tokenHeaders: (string | undefined)[] = []
  await page.route(trackEndpoint, route => {
    const header = route.request().headers()['x-form-token']
    tokenHeaders.push(header)
    const view = trackView('paid')
    if (header !== 'checkout-customer-token') view.delivery.address = undefined
    return route.fulfill({ json: view })
  })
  const checkout = () => page.evaluate(async () => {
    const path = '/src/api/http/services.ts'; const { httpApi } = await import(path)
    try {
      await httpApi.shop.checkout({ customerName: 'Alex Example', email: 'alex@example.com', phone: '1234567', acceptTerms: true, deliveryDate: '2026-12-02', address: { line1: 'Hauptstraße 1', postalCode: '1010', city: 'Wien' }, items: [{ kind: 'custom', color: 'red', finish: 'shiny', withName: false, petName: 'Luna', photos: [] }] })
      return true
    } catch { return false }
  })
  const stored = () => page.evaluate(orderCode => localStorage.getItem(`awg-form-token:${orderCode}`), code)
  expect(await checkout()).toBe(false)
  expect(await stored()).toBeNull()
  checkoutFails = false
  expect(await checkout()).toBe(true)
  const raw = await stored()
  expect(JSON.parse(raw!)).toEqual({ token: 'checkout-customer-token', savedAt: Date.parse('2026-11-05T12:00:00Z') })
  await showThanks(page)
  await expect(page.getByRole('heading', { name: 'Danke für deine Bestellung!' })).toBeVisible()
  expect(tokenHeaders).toContain('checkout-customer-token')
  await page.getByRole('link', { name: 'Bestellung verfolgen', exact: true }).click()
  // Track shows the order but no longer offers to change the delivery address.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Lieferadresse ändern', exact: true })).toHaveCount(0)
  await expect(page.locator('#line1')).toHaveCount(0)
  // Re-import the adapter after document reload: it must read the same dated record.
  await page.reload()
  const owner = await page.evaluate(async orderCode => {
    const path = '/src/api/http/services.ts'; const { httpApi } = await import(path)
    return httpApi.tracking.getByCode(orderCode)
  }, code)
  expect(owner.delivery.address?.line1).toBe('Hauptstraße 1')
  expect(await stored()).toBe(raw)
  await page.clock.setFixedTime(new Date('2026-12-20T12:00:00Z'))
  await page.evaluate(async orderCode => {
    const path = '/src/api/http/services.ts'; const { httpApi } = await import(path)
    return httpApi.tracking.getByCode(orderCode)
  }, code)
  expect(tokenHeaders.at(-1)).toBeUndefined()
  expect(await stored()).toBeNull()
})

test('shows every ornament of the order after payment, side by side', async ({ page }) => {
  await open(page)
  const view = trackView('paid')
  view.items.push({ kind: 'custom', color: 'green', finish: 'matte', petName: 'Max', withName: false, backName: '', productionStatus: 'not_started' })
  await page.route(trackEndpoint, route => route.fulfill({ json: view }))
  await showThanks(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Danke für deine Bestellung!' })).toBeVisible()
  const previews = page.locator('[class*="thanksPreviews"] > *')
  await expect(previews).toHaveCount(2)
  const [a, b] = await Promise.all([previews.nth(0).boundingBox(), previews.nth(1).boundingBox()])
  expect(Math.abs(a!.y - b!.y)).toBeLessThan(2)
})
