import type { OrnamentColor, Photo } from '../domain/types'

export const BUY_DRAFT_KEY = 'awg-buy-draft'

export type BuyItem = {
  uid: string
  color: OrnamentColor | ''
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
  deliveryDate: string
  acceptTerms: boolean
}

export function newItem(): BuyItem {
  return { uid: crypto.randomUUID(), color: '', withName: false, backName: '', petName: '', note: '', photos: [], photosNeedReload: false }
}

const emptyDraft = (): BuyDraft => ({
  items: [newItem()], customerName: '', email: '', phone: '', line1: '', line2: '', postalCode: '', deliveryDate: '', acceptTerms: false,
})

export function loadBuyDraft(): BuyDraft {
  try {
    const raw = sessionStorage.getItem(BUY_DRAFT_KEY)
    if (!raw) return emptyDraft()
    const parsed = JSON.parse(raw) as Partial<BuyDraft>
    const items = Array.isArray(parsed.items) ? parsed.items.filter((item) => item && typeof item.uid === 'string' && (!('kind' in item) || item.kind === 'custom')).map((item) => ({
        ...newItem(), ...item, photos: [], photosNeedReload: !!item.photosNeedReload || (Array.isArray(item.photos) && item.photos.length > 0),
      })) : []
    return {
      ...emptyDraft(), ...parsed,
      items: items.length ? items : [newItem()],
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
