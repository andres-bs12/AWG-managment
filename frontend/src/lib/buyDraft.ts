import type { OrnamentColor, CustomFinish, DeliveryKind, Photo } from '../domain/types'
import { uid } from './uid.ts'

export const BUY_DRAFT_KEY = 'awg-buy-draft'

export type BuyItem = {
  uid: string
  color: OrnamentColor | ''
  finish: CustomFinish | ''
  withName: boolean
  backName: string
  petName: string
  note: string
  photos: Photo[]
  photosNeedReload: boolean
}

export type BuyDraft = {
  items: BuyItem[]
  customerName: string
  email: string
  phone: string
  line1: string
  line2: string
  postalCode: string
  deliveryKind: DeliveryKind
  deliveryDate: string
  /** Arrival time at the stall ('HH:mm'), market pickup only. */
  pickupTime: string
  acceptTerms: boolean
}

export function newItem(): BuyItem {
  return { uid: uid(), color: '', finish: '', withName: false, backName: '', petName: '', note: '', photos: [], photosNeedReload: false }
}

const emptyDraft = (): BuyDraft => ({
  items: [newItem()], customerName: '', email: '', phone: '', line1: '', line2: '', postalCode: '', deliveryKind: 'vienna', deliveryDate: '', pickupTime: '', acceptTerms: false,
})

export function loadBuyDraft(): BuyDraft {
  try {
    const raw = sessionStorage.getItem(BUY_DRAFT_KEY)
    if (!raw) return emptyDraft()
    const parsed = JSON.parse(raw) as Partial<BuyDraft>
    const items = Array.isArray(parsed.items) ? parsed.items.filter((item) => item && typeof item.uid === 'string' && (!('kind' in item) || item.kind === 'custom')).map((item) => ({
        ...newItem(), ...item, color: ['red', 'green', 'beige'].includes(item.color) && item.finish ? item.color : '', finish: ['red', 'green', 'beige'].includes(item.color) && (item.finish === 'shiny' || item.finish === 'matte') ? item.finish : '' as const, photos: [], photosNeedReload: !!item.photosNeedReload || (Array.isArray(item.photos) && item.photos.length > 0),
      })) : []
    return {
      ...emptyDraft(), ...parsed,
      items: items.length ? items : [newItem()],
      deliveryKind: parsed.deliveryKind === 'market' ? 'market' : 'vienna',
      pickupTime: typeof parsed.pickupTime === 'string' && /^\d{2}:\d{2}$/.test(parsed.pickupTime) ? parsed.pickupTime : '',
      acceptTerms: false,
    }
  } catch {
    return emptyDraft()
  }
}

export function saveBuyDraft(draft: BuyDraft): boolean {
  try {
    sessionStorage.setItem(BUY_DRAFT_KEY, JSON.stringify({
      ...draft, acceptTerms: false,
      items: draft.items.map((item) => ({ ...item, photos: [], photosNeedReload: item.photosNeedReload || item.photos.length > 0 })),
    }))
    return true
  } catch {
    return false
  }
}

export function clearBuyDraft(): void {
  try { sessionStorage.removeItem(BUY_DRAFT_KEY) } catch { /* Storage is optional. */ }
}
