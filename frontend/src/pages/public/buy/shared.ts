import type { Dispatch, SetStateAction } from 'react'
import type { ShopConfig, ShopDeliveryDate, OrnamentColor } from '../../../domain/types'
import type { BuyDraft, BuyItem } from '../../../lib/buyDraft'
import { useLocale } from '../../../i18n/LocaleContext'

export const MAX_PHOTOS = 6
export const colorKeys: Record<OrnamentColor, string> = { red: 'colorRed', grey: 'colorGrey', green: 'colorGreen', white: 'colorWhite' }

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
  formatDate: (date: string) => string
  serverError: string
}
