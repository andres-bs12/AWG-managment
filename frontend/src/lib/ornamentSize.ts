import type { OrnamentSize } from '../domain/types'

/** Personalised ornament sizes, biggest first (owner, 2026-11-26). Prices come from the server. */
export const ORNAMENT_SIZES: readonly OrnamentSize[] = ['big', 'medium'] as const

export const SIZE_CM: Record<OrnamentSize, number> = { big: 10, medium: 8 }

/** Staff label: "Big 10 cm" / "Medium 8 cm". */
export function sizeLabel(size: OrnamentSize): string {
  return `${size === 'big' ? 'Big' : 'Medium'} ${SIZE_CM[size]} cm`
}

/** Short tag for tight staff cards: "10 cm" / "8 cm". */
export function sizeShort(size: OrnamentSize): string {
  return `${SIZE_CM[size]} cm`
}

/** i18n key for public pages ("Groß 10 cm" / "Big 10 cm"). */
export function sizeKey(size: OrnamentSize): 'sizeBig' | 'sizeMedium' {
  return size === 'big' ? 'sizeBig' : 'sizeMedium'
}

type StockOption = { color: string; finish: string; size?: OrnamentSize | null; inStock: boolean }

/**
 * Whether the shop still has a base for this choice. Bases are counted per size, colour and finish;
 * a part left empty (not chosen yet) matches any value. Options without a size are big ones.
 */
export function inStockFor(options: readonly StockOption[], choice: { size?: string | null; color?: string | null; finish?: string | null }): boolean {
  return options.some(option => option.inStock
    && (!choice.size || (option.size ?? 'big') === choice.size)
    && (!choice.color || option.color === choice.color)
    && (!choice.finish || option.finish === choice.finish))
}
