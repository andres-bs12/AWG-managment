import { test, expect } from '@playwright/test'
import { axe } from './helpers'

// AWG0103: Vienna delivery, in the workshop (seed.ts).
const copy = {
  de: { instagram: 'Fragen? Schreib uns auf Instagram', email: 'Oder schreib an artwithgab@gmail.com', change: 'Lieferadresse ändern' },
  en: { instagram: 'Questions? Message us on Instagram', email: 'Or write to artwithgab@gmail.com', change: 'Change delivery address' },
} as const

for (const locale of ['de', 'en'] as const) {
  test(`Track offers Instagram and e-mail contact and no address change (${locale})`, async ({ page }) => {
    await page.addInitScript(lang => localStorage.setItem('awg-locale', lang), locale)
    await page.goto('/track/AWG0103')
    const card = page.locator('section[aria-live]')
    await expect(card.getByRole('heading', { level: 1 })).toBeVisible()
    await card.evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished)))

    const link = card.getByRole('link', { name: copy[locale].instagram, exact: true })
    await expect(link).toHaveAttribute('href', 'https://www.instagram.com/art_withgab_')
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    // The row stays inside the card's content and its label does not overflow.
    expect(await link.evaluate(node => {
      const own = node.getBoundingClientRect(), parent = node.parentElement!.getBoundingClientRect()
      return own.left >= parent.left && own.right <= parent.right && node.scrollWidth <= node.clientWidth
    })).toBe(true)
    const mail = card.getByRole('link', { name: copy[locale].email, exact: true })
    await expect(mail).toHaveAttribute('href', 'mailto:artwithgab@gmail.com?subject=AWG0103')
    expect((await mail.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect(await mail.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    // The contact rows follow the receipt and come before the page actions.
    expect(await link.evaluate(node => {
      const content = node.parentElement!.parentElement!
      const receipt = content.querySelector('section')
      const back = content.querySelector('a[href="/"]')
      return !!receipt && !!back
        && !!(receipt.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)
        && !!(node.compareDocumentPosition(back) & Node.DOCUMENT_POSITION_FOLLOWING)
    })).toBe(true)

    await expect(page.getByRole('button', { name: copy[locale].change, exact: true })).toHaveCount(0)
    await expect(page.locator('#line1, #postal, #city')).toHaveCount(0)
    await axe(page)
  })

  test(`Post order on Track shows arrival range, Versendet/Shipped chip when handed over, and tracking link only with trackingUrl (${locale})`, async ({ page }) => {
    await page.addInitScript(lang => localStorage.setItem('awg-locale', lang), locale)
    await page.goto('/track')
    const order = await page.evaluate(async () => {
      const path = '/src/api/client.ts'; const { api } = await import(path)
      const quote = await api.shop.shippingQuote([{ kind: 'custom', withName: false }])
      const created = await api.shop.checkout({
        customerName: 'Clara Post', email: 'clara@example.at', phone: '+43 660 1234567',
        deliveryKind: 'post',
        address: { line1: 'Getreidegasse 9', postalCode: '5020', city: 'Salzburg' },
        expectedArrivalTo: quote.arrivalTo,
        acceptTerms: true,
        items: [{ kind: 'custom', size: 'big', color: 'red', finish: 'shiny', withName: false, petName: '', photos: [{ id: 'p1', name: 'pet.png', dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' }] }],
      })
      const found = await api.orders.getOrderByCode(created.orderCode)
      const bundle = await api.orders.getOrderBundle(found!.id)
      return { id: found!.id, itemId: bundle.items[0].id, code: created.orderCode }
    })

    await page.goto(`/track/${order.code}`)
    const card = page.locator('section[aria-live]')
    await expect(card.getByRole('heading', { level: 1 })).toBeVisible()
    await card.evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished)))
    await expect(card).toContainText(locale === 'de' ? 'Versand per Post' : 'Shipping by post')
    await expect(card).toContainText(locale === 'de' ? 'Zustellung voraussichtlich 1.–2. Dezember' : 'Estimated delivery 1–2 December')
    await expect(card.getByRole('link', { name: locale === 'de' ? 'Sendung verfolgen' : 'Track parcel' })).toHaveCount(0)
    await axe(page)

    // Hand over to Post with a parcel tracking number -> chip becomes Versendet / Shipped and tracking link appears.
    await page.evaluate(async ({ id, itemId }) => {
      const path = '/src/api/client.ts'; const { api } = await import(path)
      await api.orders.setItemStatus(id, itemId, 'finished')
      await api.orders.setHandedOver(id, true, [itemId], '10123456789012345678')
    }, order)
    await page.reload()
    await expect(card.getByRole('heading', { level: 1 })).toBeVisible()
    await card.evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished)))
    await expect(card.locator('[class*="chipDone"]')).toHaveText(locale === 'de' ? 'Versendet' : 'Shipped')
    // No repeated text on one screen: Versendet/Shipped appears once (chip only), progress step uses Versand/Shipping.
    await expect(card.getByText(locale === 'de' ? 'Versendet' : 'Shipped', { exact: true })).toHaveCount(1)
    await expect(card.getByRole('navigation').getByText(locale === 'de' ? 'Versand' : 'Shipping', { exact: true })).toBeVisible()
    const parcelLink = card.getByRole('link', { name: locale === 'de' ? 'Sendung verfolgen' : 'Track parcel', exact: true })
    await expect(parcelLink).toHaveAttribute('href', 'https://www.post.at/s/sendungsdetails?snr=10123456789012345678')
    await axe(page)
  })

  test(`market pickup on Track links the market to Google Maps (${locale})`, async ({ page }) => {
    await page.addInitScript(lang => localStorage.setItem('awg-locale', lang), locale)
    await page.goto('/track')
    const code = await page.evaluate(async () => {
      const path = '/src/api/client.ts'; const { api } = await import(path)
      const items = [{ kind: 'custom' as const, withName: false }]
      const [day] = await api.shop.listPickupDays(items)
      const created = await api.shop.checkout({
        customerName: 'Mia Markt', email: 'mia@example.at', phone: '+43 660 1234567', deliveryKind: 'market',
        marketDayId: day.marketDayId, deliveryDate: day.date, pickupTime: day.openTime, acceptTerms: true,
        items: [{ kind: 'custom', size: 'big', color: 'red', finish: 'shiny', withName: false, petName: '', photos: [{ id: 'p1', name: 'pet.png', dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' }] }],
      })
      return created.orderCode
    })
    await page.goto(`/track/${code}`)
    const card = page.locator('section[aria-live]')
    await expect(card.getByRole('heading', { level: 1 })).toBeVisible()
    await card.evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished)))
    const link = card.getByRole('link', { name: locale === 'de' ? /^Rathausplatz.* auf Google Maps öffnen$/ : /^Open Rathausplatz.* in Google Maps$/ })
    await expect(link).toHaveAttribute('href', `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Rathausplatz, Wien')}`)
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    // Inside a sentence the link keeps the line height, but its hit area is still 44px tall.
    // The link may wrap on narrow screens: probe the first line box, 20px above and below its centre.
    await link.scrollIntoViewIfNeeded()
    const hits = await link.evaluate(node => {
      const rect = node.getClientRects()[0]
      const at = (dy: number) => document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2 + dy)?.closest('a') === node
      return [at(0), at(-20), at(20)]
    })
    expect(hits).toEqual([true, true, true])
    await axe(page)
  })
}
