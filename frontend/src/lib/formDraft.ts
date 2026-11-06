import type { Address, Photo } from '../domain/types'

export type FormItemDraft = { orderItemId: string; petName: string; backName: string; note: string; photos: Photo[]; photosNeedReload: boolean }
export type FormDraft = { customerName: string; phone: string; email: string; address: Address; items: FormItemDraft[] }
export const formDraftKey = (token: string) => `awg-form-draft:${token}`

/** Persist text and server photo identifiers, never local image bytes or remote URLs. */
export function serializeFormDraft(draft: FormDraft): string {
  return JSON.stringify({ ...draft, items: draft.items.map(item => ({ ...item,
    photosNeedReload: item.photosNeedReload || item.photos.some(photo => photo.dataUrl.startsWith('data:')),
    photos: item.photos.filter(photo => !photo.dataUrl.startsWith('data:')).map(photo => ({ id: photo.id })),
  })) })
}

/** Reconcile stored identifiers with the current token's server view, which remains authoritative. */
export function restoreFormDraft(raw: string, source: FormDraft): FormDraft {
  try {
    const parsed = JSON.parse(raw) as FormDraft
    if (![parsed.customerName, parsed.phone, parsed.email, parsed.address?.line1, parsed.address?.postalCode, parsed.address?.city].every(value => typeof value === 'string')
      || (parsed.address.line2 != null && typeof parsed.address.line2 !== 'string')
      || !Array.isArray(parsed.items) || parsed.items.length !== source.items.length
      || parsed.items.some((item, index) => !item || item.orderItemId !== source.items[index].orderItemId || ![item.petName, item.backName, item.note].every(value => typeof value === 'string') || !Array.isArray(item.photos))) return source
    return { customerName: parsed.customerName, phone: parsed.phone, email: parsed.email, address: parsed.address,
      items: parsed.items.map((item, index) => ({ orderItemId: item.orderItemId, petName: item.petName, backName: item.backName, note: item.note,
        photos: source.items[index].photos.filter(photo => !photo.dataUrl.startsWith('data:') && item.photos.some(saved => saved?.id === photo.id)),
        photosNeedReload: !!item.photosNeedReload || item.photos.some(photo => typeof photo?.dataUrl === 'string' && photo.dataUrl.startsWith('data:')),
      })),
    }
  } catch { return source }
}
