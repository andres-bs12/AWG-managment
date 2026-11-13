/** Accept both plain decimal input and Austrian grouping/decimal separators. */
export function parseEuroAmount(text: string): number {
  const compact = text.trim().replace(/[\s\u00a0]/g, '')
  if (!compact) return Number.NaN
  const normalized = compact.includes(',') ? compact.replace(/\./g, '').replace(',', '.') : compact
  return /^\d+(?:\.\d{1,2})?$/.test(normalized) ? Number(normalized) : Number.NaN
}
