export type MarketOrnamentStatus = 'unpainted' | 'painted' | 'sold'

export type MarketOrnament = {
  id: string
  status: MarketOrnamentStatus
  soldAt: string | null
  revision: number
  hasUploadedPhoto: boolean
}

export const marketColors = [
  { code: 'R', label: 'Red', swatch: 'var(--ornament-red)', shiny: 12, matte: 9 },
  { code: 'W', label: 'Wine', swatch: 'var(--ornament-wine)', shiny: 12, matte: 6 },
  { code: 'G', label: 'Green', swatch: 'var(--ornament-green)', shiny: 16, matte: 8 },
  { code: 'C', label: 'Champagne', swatch: 'var(--ornament-beige)', shiny: 16, matte: 8 },
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
