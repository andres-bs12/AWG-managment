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

export { pickupTimes } from '../../../lib/pickupTimes'
