import type { Dispatch, SetStateAction } from 'react'
import type { ShopConfig, ShopDeliveryDate, ShopPickupDay, OrnamentColor } from '../../../domain/types'
import type { BuyDraft, BuyItem } from '../../../lib/buyDraft'
import { useLocale } from '../../../i18n/LocaleContext'

export { MAX_PHOTOS } from '../../../components/public/PhotoTiles'
export const colorKeys: Record<OrnamentColor, string> = { red: 'colorRed', grey: 'colorGrey', green: 'colorGreen', white: 'colorWhite', beige: 'colorBeige' }

export type BuyStepProps = {
  t: ReturnType<typeof useLocale>['t']
  draft: BuyDraft
  config: ShopConfig
  itemPrice: (item: BuyItem) => number
  patch: (partial: Partial<BuyDraft>) => void
  patchItem: (uid: string, partial: Partial<BuyItem>) => void
  err: (key: string) => string | undefined
  described: (key: string, hint?: boolean) => string | undefined
  photoErrors: Record<string, string>
  addFiles: (uid: string, files: File[] | null) => Promise<void>
  dates: ShopDeliveryDate[]
  datesState: 'idle' | 'loading' | 'ready' | 'error'
  setDatesRetry: Dispatch<SetStateAction<number>>
  pickupDays: ShopPickupDay[]
  pickupState: 'idle' | 'loading' | 'ready' | 'error'
  formatDate: (date: string) => string
  serverError: string
}

/** Legacy date-only drafts and responses can only resolve a unique market on that date. */
export function selectedPickupDay(days: ShopPickupDay[], draft: BuyDraft): ShopPickupDay | undefined {
  const onDate = days.filter(day => day.date === draft.deliveryDate)
  if (draft.pickupMarketDayId) return onDate.find(day => day.marketDayId === draft.pickupMarketDayId)
  return onDate.length === 1 ? onDate[0] : undefined
}

export { pickupTimes } from '../../../lib/pickupTimes'
