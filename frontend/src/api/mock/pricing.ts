import type { PostCollectionWeekday } from '../../domain/types'
import { BACK_NAME_MAX_LIMIT, DEFAULT_BACK_NAME_MAX } from '../../lib/paintedName.ts'

export const DEFAULT_COLLECTION_DAYS: PostCollectionWeekday[] = ['tuesday', 'friday']

/** Demo configuration, equivalent to awg.pricing.* and awg.post.* on the server. Starting point for the mock prices (revision 0). */
export const mockPricing = {
  /** Big (10 cm) and medium (8 cm) personalised ornaments; awg.pricing.custom / custom-medium. */
  customPrice: 50,
  customMediumPrice: 45,
  finishedPrice: 35,
  nameExtra: 12.99,
  shippingFee: 5.0,
  /** Letters allowed on the back (PricingService.DEFAULT_BACK_NAME_MAX). */
  backNameMax: DEFAULT_BACK_NAME_MAX,
  postCollectionDays: DEFAULT_COLLECTION_DAYS,
  /** awg.post.finished-with-custom: finished pieces ship by Post only beside a custom Post piece. */
  finishedWithCustom: true,
}

const WEEKDAYS = new Set<PostCollectionWeekday>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])

/** Same rules as the server: both custom sizes and finished at least 0.50, name extra at least 0 (up to 999.99), shipping fee 0.00–99.99, 1–5 distinct weekdays, back-name limit 1–20 letters. */
export function validatePriceInput(input: {
  customPrice: number
  customMediumPrice?: number
  finishedPrice: number
  nameExtra: number
  shippingFee?: number
  backNameMax?: number
  postCollectionDays?: PostCollectionWeekday[]
}): string | null {
  const shippingFee = input.shippingFee ?? mockPricing.shippingFee
  const customMediumPrice = input.customMediumPrice ?? mockPricing.customMediumPrice
  const values = [input.customPrice, customMediumPrice, input.finishedPrice, input.nameExtra, shippingFee]
  if (values.some(value => !Number.isFinite(value) || value > 999.99 || Math.abs(value * 100 - Math.round(value * 100)) > 1e-6)) {
    return 'Prices must be up to 999.99 with at most two decimals.'
  }
  if (input.customPrice < 0.5 || customMediumPrice < 0.5 || input.finishedPrice < 0.5) return 'Ornament prices must be at least 0.50.'
  if (input.nameExtra < 0) return 'The name extra cannot be negative.'
  if (shippingFee < 0 || shippingFee > 99.99) return 'The shipping fee must be between 0.00 and 99.99.'
  if (input.backNameMax !== undefined && (!Number.isInteger(input.backNameMax) || input.backNameMax < 1 || input.backNameMax > BACK_NAME_MAX_LIMIT)) {
    return `The name limit must be 1–${BACK_NAME_MAX_LIMIT} letters.`
  }
  const days = input.postCollectionDays ?? mockPricing.postCollectionDays
  if (!Array.isArray(days) || days.length < 1 || days.length > 5 || days.some(day => !WEEKDAYS.has(day)) || new Set(days).size !== days.length) {
    return 'Choose distinct Post collection weekdays.'
  }
  return null
}
