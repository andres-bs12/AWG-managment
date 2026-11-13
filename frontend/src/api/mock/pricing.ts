/** Demo configuration, equivalent to awg.pricing.* on the server. Starting point for the mock prices (revision 0). */
export const mockPricing = { customPrice: 49.99, finishedPrice: 39.99, nameExtra: 12.99 }

/** Same rules as the server: custom and finished at least 0.50, the name extra at least 0, all at most 999.99 with two decimals. */
export function validatePriceInput(input: { customPrice: number; finishedPrice: number; nameExtra: number }): string | null {
  const values = [input.customPrice, input.finishedPrice, input.nameExtra]
  if (values.some(value => !Number.isFinite(value) || value > 999.99 || Math.abs(value * 100 - Math.round(value * 100)) > 1e-6)) return 'Prices must be up to 999.99 with at most two decimals.'
  if (input.customPrice < 0.5 || input.finishedPrice < 0.5) return 'Ornament prices must be at least 0.50.'
  if (input.nameExtra < 0) return 'The name extra cannot be negative.'
  return null
}
