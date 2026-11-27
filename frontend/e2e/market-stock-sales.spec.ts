import { chooseSizes } from './staff-fixture'
import { expect, test, type Page } from '@playwright/test'
import { axe } from './helpers'

const viewports = [
  { name: 'ipad-portrait', shotPicker: 'ipad-picker-portrait.png', shotSale: 'ipad-sale-portrait.png', width: 820, height: 1180, isMobile: false, hasTouch: true, minTilePhoto: 180, minSaleThumb: 95 },
  { name: 'ipad-landscape', shotPicker: 'ipad-picker-landscape.png', shotSale: 'ipad-sale-landscape.png', width: 1180, height: 820, isMobile: false, hasTouch: true, minTilePhoto: 170, minSaleThumb: 95 },
  { name: 'phone-360x800', shotPicker: 'phone-picker-360x800.png', shotSale: 'phone-sale-360x800.png', width: 360, height: 800, isMobile: true, hasTouch: true, minTilePhoto: 110, minSaleThumb: 79 },
] as const

async function signIn(page: Page, path: string) {
  await page.clock.setFixedTime(new Date('2026-11-28T15:00:00+01:00'))
  await page.addInitScript(() => localStorage.setItem('awg-active-market-id', 'mkt-rathaus'))
  await page.goto(path)
  await page.getByLabel('Email', { exact: true }).fill('gaby@artwithgab.com')
  await page.getByLabel('Password', { exact: true }).fill('gaby')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

for (const vp of viewports) {
  test.describe(`Numbered sales on ${vp.name} (${vp.width}×${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch })

    test('sells ready pieces with photo-first picker, sale cards, summary and order detail', async ({ page }) => {
      const saveShot = async (filename: string, round2Name?: string) => {
        if (process.env.PW_MARKET_STOCK_SHOTS === '1') {
          await page.screenshot({ path: `../tasks/audit-results/market-stock-shots/${filename}`, animations: 'disabled' })
        }
        if (process.env.PW_ROUND2_SHOTS === '1' && round2Name) {
          await page.screenshot({ path: `../tasks/audit-results/staff-round2-shots/${round2Name}`, animations: 'disabled' })
        }
      }

      await signIn(page, '/staff/sales/new')

      const add = page.getByRole('button', { name: /Add finished/ })
      await add.click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Choose piece', exact: true })).toHaveCount(0)

      const picker = page.getByRole('heading', { name: /^Finished 1/ }).locator('xpath=ancestor::article[1]')
      const item = (id: string) => picker.getByRole('button', { name: new RegExp(`^${id} ·`) })

      // All 10 seeded Ready pieces show large photos first with code + "Colour · S/M" inline in the sale.
      const rm01Tile = item('RM01')
      await expect(rm01Tile).toBeVisible()
      await expect(rm01Tile).toContainText('RM01')
      await expect(rm01Tile).toContainText('Red · M')
      await expect(item('WS01')).toContainText('Wine · S')
      await expect.poll(() => rm01Tile.locator('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
      const tilePhotoBox = (await rm01Tile.locator('img').boundingBox())!
      expect(tilePhotoBox.width).toBeGreaterThanOrEqual(vp.minTilePhoto)
      expect(Math.abs(tilePhotoBox.width - tilePhotoBox.height)).toBeLessThan(2)
      await saveShot(vp.shotPicker, vp.name.startsWith('ipad-') ? `inline-grid-${vp.name}.png` : undefined)
      await axe(page)

      await picker.getByLabel('Colour', { exact: true }).selectOption('R')
      await picker.getByLabel('Finish', { exact: true }).selectOption('M')
      await expect(picker.getByRole('list', { name: 'Ready ornaments' }).getByRole('button')).toHaveCount(5)
      await expect(item('RM09')).toHaveCount(0)

      const search = picker.getByRole('searchbox', { name: 'Search inventory ID' })
      await search.fill('rm-o1')
      await expect(rm01Tile).toBeVisible()
      await search.press('Enter')

      // Selected piece in the sale card and Order summary keeps showing its photo, code and "Colour · S/M".
      const rm01Heading = page.getByRole('heading', { name: /^RM01 · Red · Matte/ })
      await expect(rm01Heading).toContainText('RM01')
      await expect(rm01Heading).toContainText('€')
      const saleCard = rm01Heading.locator('xpath=ancestor::article[1]')
      await expect(saleCard).toContainText('Red · M')
      const salePhoto = saleCard.getByRole('img', { name: 'Ornament RM01' })
      await expect(salePhoto).toBeVisible()
      await expect.poll(() => salePhoto.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
      expect((await salePhoto.boundingBox())!.width).toBeGreaterThanOrEqual(vp.minSaleThumb)

      const summary = page.getByRole('complementary').filter({ has: page.getByRole('heading', { name: 'Order summary' }) })
      await expect(summary).toContainText('RM01')
      await expect(summary).toContainText('Red · M')
      const summaryPhoto = summary.getByRole('img', { name: 'Ornament RM01' })
      await expect(summaryPhoto).toBeVisible()
      await expect.poll(() => summaryPhoto.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
      expect((await summaryPhoto.boundingBox())!.width).toBeGreaterThanOrEqual(vp.minSaleThumb)

      await saveShot(vp.shotSale, vp.name.startsWith('ipad-') ? `inline-selected-${vp.name}.png` : undefined)
      await axe(page)

      // Tapping Change piece re-shows the inline grid without a dialog and lets staff re-select.
      await saleCard.getByRole('button', { name: 'Change piece', exact: true }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      const reopenedPicker = page.getByRole('heading', { name: /^Finished 1/ }).locator('xpath=ancestor::article[1]')
      await reopenedPicker.getByRole('button', { name: /^RM01 ·/ }).click()
      await expect(page.getByRole('heading', { name: /^RM01 · Red · Matte/ })).toBeVisible()

      await add.click()
      const secondPicker = page.getByRole('heading', { name: /^Finished 2/ }).locator('xpath=ancestor::article[1]')
      const secondSearch = secondPicker.getByRole('searchbox', { name: 'Search inventory ID' })
      await secondSearch.fill('RM01')
      await expect(secondPicker.getByText('No ready ornaments match.')).toBeVisible()
      await expect(secondPicker.getByRole('button', { name: /^RM01 ·/ })).toHaveCount(0)
      await secondSearch.fill('RM02')
      await secondPicker.getByRole('button', { name: /^RM02 ·/ }).click()
      await add.click()
      const thirdPicker = page.getByRole('heading', { name: /^Finished 3/ }).locator('xpath=ancestor::article[1]')
      await thirdPicker.getByLabel('Colour', { exact: true }).selectOption('W')
      await thirdPicker.getByLabel('Finish', { exact: true }).selectOption('S')
      await thirdPicker.getByRole('button', { name: /^WS01 ·/ }).click()

      await chooseSizes(page)

      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await expect(page.getByRole('img', { name: 'Ornament RM01' }).first()).toBeVisible()
      await page.getByRole('radio', { name: 'Unpaid', exact: true }).locator('..').click()
      await page.getByRole('button', { name: 'Done', exact: true }).click()
      await page.getByRole('dialog', { name: 'Balance due' }).getByRole('button', { name: 'Save without handover' }).click()
      const created = page.getByRole('link', { name: 'Open order', exact: true })
      await expect(created).toBeVisible()
      const orderUrl = await created.getAttribute('href')
      await expect(summary).toContainText('RM01')

      const statsUrl = '/staff/stats?range=today'
      const breakdown = page.getByRole('region', { name: 'Non-personalised sold' })
      await page.goto(statsUrl)
      await expect(breakdown.locator('dt')).toHaveText(['Red · Matte', 'Wine · Shiny'])
      await expect(breakdown.locator('dd')).toHaveText(['2', '1'])

      await page.goto('/staff/inventory')
      const stockSearch = page.getByRole('searchbox', { name: 'Search inventory ID' })
      await stockSearch.fill('RM01')
      await page.getByRole('button', { name: 'RM01 Sold' }).click()
      const sold = page.getByRole('dialog', { name: 'RM01' })
      await expect(sold.getByText(/^Sold \d/)).toBeVisible()
      const saleLink = sold.getByRole('link', { name: /^Order AWG[A-Z0-9]+$/ })
      await expect(saleLink).toHaveAttribute('href', orderUrl!)
      await expect(sold.getByRole('button', { name: /Mark|Undo sale/ })).toHaveCount(0)
      await expect.poll(() => sold.getByRole('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
      await axe(page)
      const code = (await saleLink.innerText()).replace('Order ', '')
      await saleLink.click()
      await expect(page.getByRole('heading', { name: code, exact: true })).toBeVisible()

      // Order detail (OrderItemCard) shows the piece photo + code + "Colour · S/M".
      const detailHeading = page.getByRole('heading', { name: 'RM01 · Red · Matte' })
      await expect(detailHeading).toBeVisible()
      await expect(detailHeading).toHaveText('RM01')
      const detailCard = detailHeading.locator('xpath=ancestor::article[1]')
      await expect(detailCard).toContainText('Red · M')
      const detailPhoto = detailCard.getByRole('img', { name: 'Ornament RM01' })
      await expect(detailPhoto).toBeVisible()
      await expect.poll(() => detailPhoto.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
      await axe(page)

      // The photo opens that piece on Stock; Stock's back link returns to this sale.
      await detailCard.getByRole('link', { name: 'Open RM01 in stock' }).click()
      await expect(page).toHaveURL(/\/staff\/inventory\?ornament=RM01$/)
      const opened = page.getByRole('dialog', { name: 'RM01' })
      await expect(opened.getByText(/^Sold \d/)).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(opened).toHaveCount(0)
      await page.getByRole('link', { name: '← Sale' }).click()
      await expect(page.getByRole('heading', { name: code, exact: true })).toBeVisible()

      await page.getByRole('button', { name: 'Cancel order', exact: true }).click()
      await page.getByRole('dialog', { name: 'Cancel order?' }).getByRole('button', { name: 'Cancel order', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Cancelled order' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'RM01 · Red · Matte' })).toBeVisible()

      await page.goto('/staff/inventory')
      await stockSearch.fill('RM0')
      await expect(page.getByRole('button', { name: 'RM01 Ready' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'RM02 Ready' })).toBeVisible()
      await stockSearch.fill('WS01')
      await expect(page.getByRole('button', { name: 'WS01 Ready' })).toBeVisible()
      await page.goto(statsUrl)
      await expect(breakdown.getByText('No numbered ornaments sold in this range.')).toBeVisible()
    })
  })
}

test('pieces without a photo show a same-size placeholder with the code in the picker and sale', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 })
  await signIn(page, '/staff/inventory')
  const stockSearch = page.getByRole('searchbox', { name: 'Search inventory ID' })
  await stockSearch.fill('RM06')
  await page.getByRole('button', { name: 'RM06 To paint' }).click()
  await page.getByRole('dialog', { name: 'RM06' }).getByRole('button', { name: 'Mark painted', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'RM06' }).getByRole('status')).toContainText('Marked as painted')

  await page.goto('/staff/sales/new')
  await page.getByRole('button', { name: /Add finished/ }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const picker = page.getByRole('heading', { name: /^Finished 1/ }).locator('xpath=ancestor::article[1]')
  const withPhoto = picker.getByRole('button', { name: /^RM01 ·/ })
  const withoutPhoto = picker.getByRole('button', { name: /^RM06 ·/ })
  await expect(withPhoto).toBeVisible()
  await expect(withoutPhoto).toBeVisible()
  await expect(withoutPhoto.locator('img')).toHaveCount(0)
  await expect(withoutPhoto).toContainText('RM06')
  await expect(withoutPhoto).toContainText('Red · M')
  const withBox = (await withPhoto.boundingBox())!
  const withoutBox = (await withoutPhoto.boundingBox())!
  expect(Math.abs(withBox.height - withoutBox.height)).toBeLessThan(2)
  await axe(page)

  await withoutPhoto.click()
  const saleHeading = page.getByRole('heading', { name: /^RM06 · Red · Matte/ })
  await expect(saleHeading).toBeVisible()
  await expect(saleHeading.locator('xpath=ancestor::article[1]')).toContainText('Red · M')
  await axe(page)
})

test('picker deduplicates rapid double-tap, blocks duplicate drafts on Continue, and serves downscaled thumbnails', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 })
  await signIn(page, '/staff/inventory')
  await page.getByLabel('Search inventory ID').fill('RM06')
  await page.getByRole('button', { name: 'RM06 To paint' }).click()
  const detail = page.getByRole('dialog', { name: 'RM06' })
  const largePng = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1600
    canvas.height = 1600
    const context = canvas.getContext('2d')!
    context.fillStyle = '#b03a2e'
    context.fillRect(0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await detail.getByLabel('Add photo').setInputFiles({ name: 'rm06.png', mimeType: 'image/png', buffer: Buffer.from(largePng, 'base64') })
  await expect(detail.getByText('Photo saved.')).toBeVisible()
  await detail.getByRole('button', { name: 'Mark painted', exact: true }).click()
  await expect(detail.getByText('Marked as painted.')).toBeVisible()

  await page.goto('/staff/sales/new?fresh=1')
  await page.getByRole('button', { name: /Add finished/ }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const picker = page.getByRole('heading', { name: /^Finished 1/ }).locator('xpath=ancestor::article[1]')
  const rm06 = picker.getByRole('button', { name: /^RM06 ·/ })
  await expect(rm06).toBeVisible()
  const thumb = rm06.locator('img')
  // Tiles below the fold load lazily: bring RM06 into view before reading its decoded size.
  await rm06.scrollIntoViewIfNeeded()
  await expect.poll(() => thumb.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  expect(await thumb.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeLessThanOrEqual(480)
  await expect.poll(() => thumb.evaluate(img => (img as HTMLImageElement).src.startsWith('blob:'))).toBe(true)

  // Rapid double-tap on the same tile adds RM06 only once.
  await rm06.evaluate(button => {
    (button as HTMLButtonElement).click()
    ;(button as HTMLButtonElement).click()
  })
  await expect(page.getByRole('heading', { name: /^RM06 · Red · Matte/ })).toHaveCount(1)

  // A corrupted/restored draft containing duplicate finished pieces is caught at Continue.
  await page.evaluate(() => {
    const raw = sessionStorage.getItem('awg-sale-draft')!
    const parsed = JSON.parse(raw)
    parsed.items.push({ ...parsed.items[0], id: 'dup-rm06' })
    sessionStorage.setItem('awg-sale-draft', JSON.stringify(parsed))
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: /^RM06 · Red · Matte/ })).toHaveCount(2)
  await expect(page.getByRole('heading', { name: /^RM06 · Red · Matte/ }).first()).toContainText('€')
  await chooseSizes(page)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('already in this sale')
})
