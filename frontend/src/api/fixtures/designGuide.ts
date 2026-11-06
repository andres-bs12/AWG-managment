import type { ShopConfig } from '../../domain/types'
import type { BuyDraft, BuyItem } from '../../lib/buyDraft'

/** Synthetic guide fixtures. No customer, order or network state is read. */
export const guideConfig: ShopConfig = {
  seasonEnd: '2026-12-24', deliveriesFrom: '2026-11-30', seasonOver: false, enabled: true,
  customPrice: 49.99,
  finishedPrice: 39.99, nameExtra: 12.99, deliveryFee: 0, maxItems: 3,
  colors: (['red', 'green', 'beige'] as const).flatMap(color => (['shiny', 'matte'] as const).map(finish => ({ color, finish, inStock: !(color === 'green' && finish === 'matte') }))),
}
export const guideItem = (uid = 'guide-item'): BuyItem => ({ uid, color: 'red', finish: 'shiny', withName: true, backName: 'LUNA', petName: 'Luna', note: '', photos: [], photosNeedReload: false })
export const guideDraft = (): BuyDraft => ({ items: [guideItem()], customerName: 'Alex Example', email: 'alex@example.invalid', phone: '000000000', line1: 'Example 1', line2: '', postalCode: '1010', deliveryKind: 'vienna', deliveryDate: '2026-12-23', pickupTime: '', acceptTerms: false })
export const guideDates = ['02', '09', '16', '23', '24'].map(day => ({ date: `2026-12-${day}`, weekday: day === '24' ? 'Thursday' : 'Wednesday' }))
