export function formatEur(n: number, locale: 'de' | 'en' = 'de'): string {
  return new Intl.NumberFormat(locale === 'de' ? 'de-AT' : 'en-IE', {
    style: 'currency',
    currency: 'EUR',
  }).format(n)
}

/** customPrice is the big (10 cm) personalised ornament, customMediumPrice the medium (8 cm) one. */
export type Pricing = { customPrice: number; customMediumPrice: number; finishedPrice: number; nameExtra: number; shippingFee?: number }

/** Base price of a personalised ornament of this size; no size yet (or an order from before sizes) reads as big. */
export function customBasePrice(size: 'big' | 'medium' | '' | null | undefined, prices: Pricing): number {
  return size === 'medium' ? prices.customMediumPrice : prices.customPrice
}

export function itemCost(kind: 'custom' | 'finished', withName: boolean, prices: Pricing, size?: 'big' | 'medium' | '' | null): number {
  return Math.round((kind === 'finished' ? prices.finishedPrice : customBasePrice(size, prices) + (withName ? prices.nameExtra : 0)) * 100) / 100
}
