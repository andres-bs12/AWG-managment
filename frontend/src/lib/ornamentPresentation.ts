import type { OrderItem } from '../domain/types'
import type { FormItemDraft } from './formDraft'

export const colorKeys = { red: 'colorRed', green: 'colorGreen', beige: 'colorBeige', grey: 'colorGrey', white: 'colorWhite' } as const
export function previewItem(item: OrderItem, draft?: FormItemDraft) {
  return { color: item.color ?? '' as const, finish: item.finish ?? '' as const, withName: item.withName, backName: draft?.backName ?? item.backName }
}

