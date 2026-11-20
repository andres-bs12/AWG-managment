export type MarketOrnamentStatus = 'unpainted' | 'painted' | 'sold'
export type MarketPaintStatus = Exclude<MarketOrnamentStatus, 'sold'>

export type MarketOrnament = {
  id: string
  status: MarketOrnamentStatus
  soldAt: string | null
  revision: number
  hasUploadedPhoto: boolean
  /** Set only while the ornament is sold through an order. */
  orderId: string | null
  orderCode: string | null
}

export type MarketFinishKey = 'shiny' | 'matte'

// IDs keep Gaby's prefixes (physical labels may already exist): C is beige.
export const marketColors = [
  { code: 'R', key: 'red', label: 'Red', swatch: 'var(--ornament-red)', shiny: 12, matte: 9 },
  { code: 'W', key: 'wine', label: 'Wine', swatch: 'var(--ornament-wine)', shiny: 12, matte: 6 },
  { code: 'G', key: 'green', label: 'Green', swatch: 'var(--ornament-green)', shiny: 16, matte: 8 },
  { code: 'C', key: 'beige', label: 'Beige', swatch: 'var(--ornament-beige)', shiny: 16, matte: 8 },
] as const

export const marketFinishes = [
  { code: 'S', key: 'shiny', label: 'Shiny' },
  { code: 'M', key: 'matte', label: 'Matte' },
] as const

export const marketStatusLabels: Record<MarketOrnamentStatus, string> = {
  unpainted: 'To paint',
  painted: 'Ready',
  sold: 'Sold',
}

/** Colour and finish encoded in an ornament ID such as "RM01", or null for an unknown prefix. */
export function marketOrnamentParts(id: string) {
  const color = marketColors.find(entry => entry.code === id[0])
  const finish = marketFinishes.find(entry => entry.code === id[1])
  return color && finish ? { color, finish } : null
}

/** "RM01 · Red · Matte" */
export function marketOrnamentLabel(id: string): string {
  const parts = marketOrnamentParts(id)
  return parts ? `${id} · ${parts.color.label} · ${parts.finish.label}` : id
}

/** Finds ornaments by a typed ID: "RM01", "rm-o1" or a prefix such as "RM". */
export function searchIds<T extends { id: string }>(query: string, ornaments: T[]): T[] {
  const clean = query.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const shortCode = /^([A-Z][SM])O?(\d+)$/.exec(clean)
  const canonical = shortCode ? shortCode[1] + String(Number(shortCode[2])).padStart(2, '0') : clean
  return ornaments.filter(item => item.id.startsWith(clean) || item.id === canonical)
}
