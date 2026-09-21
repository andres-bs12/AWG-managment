export const CUSTOM_PRICE = 49.99
export const FINISHED_PRICE = 39.99
export const NAME_EXTRA = 12.99

export function formatEur(n: number): string {
  return new Intl.NumberFormat('de-AT', {
    style: 'currency',
    currency: 'EUR',
  }).format(n)
}

export function itemCost(kind: 'custom' | 'finished', withName: boolean): number {
  if (kind === 'finished') return FINISHED_PRICE
  return withName ? CUSTOM_PRICE + NAME_EXTRA : CUSTOM_PRICE
}
