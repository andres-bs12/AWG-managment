export function formatEur(n: number, locale: 'de' | 'en' = 'de'): string {
  return new Intl.NumberFormat(locale === 'de' ? 'de-AT' : 'en-IE', {
    style: 'currency',
    currency: 'EUR',
  }).format(n)
}

export type Pricing = { customPrice: number; finishedPrice: number; nameExtra: number }

export function itemCost(kind: 'custom' | 'finished', withName: boolean, prices: Pricing): number {
  return Math.round((kind === 'finished' ? prices.finishedPrice : prices.customPrice + (withName ? prices.nameExtra : 0)) * 100) / 100
}
