import { buyMetricForHttp } from '../../lib/buyMetrics'
import { validatePhoto } from '../../lib/photoValidation'
import type { Api } from '../contracts'
import { forgetFormToken, readFormToken, rememberFormToken } from '../formTokens'
import type {
  AgendaDay,
  CustomerFormPayload,
  CustomerFormView,
  Order,
  OrderItem,
  Photo,
  ShopCheckoutInput,
  ShopConfig,
  ShopDeliveryDate,
  ShopPickupDay,
  TrackView,
} from '../../domain/types'

const TOKEN_KEY = 'awg-staff-token'
const NETWORK_ERROR = 'Could not reach the server. Check your connection.'

const baseUrl: string = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

export class HttpError extends Error {
  status: number
  code?: string
  field?: string
  constructor(message: string, status: number, code?: string, field?: string) {
    super(message)
    this.status = status
    this.code = code
    this.field = field
  }
}

type RequestOptions = { auth?: boolean; token?: string; handle401?: boolean }

function storedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function jsonInit(method: string, body?: unknown): RequestInit {
  return body === undefined
    ? { method }
    : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

/**
 * The order code alone is public, so Track only returns or changes the Vienna address with the
 * long form token. The customer's browser keeps it after submitting the form.
 */
function formTokenHeader(code: string): Record<string, string> {
  const token = readFormToken(code)
  return token ? { 'X-Form-Token': token } : {}
}

async function request<T>(path: string, init: RequestInit = {}, opts: RequestOptions = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  const token = opts.token ?? (opts.auth ? storedToken() : null)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, { ...init, headers })
  } catch {
    throw new Error(NETWORK_ERROR)
  }

  if (!response.ok) {
    if (response.status === 401 && opts.auth && opts.handle401 !== false) {
      try {
        localStorage.removeItem(TOKEN_KEY)
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new Event('awg-session-expired'))
    }
    let message = ''
    let code: string | undefined
    let field: string | undefined
    try {
      const body = (await response.json()) as { message?: string; code?: string; field?: string }
      message = body?.message ?? ''
      code = body.code
      field = body.field
    } catch {
      /* body was not JSON */
    }
    throw new HttpError(message || `Request failed (${response.status}).`, response.status, code, field)
  }

  if (opts.auth && init.method && !['GET', 'HEAD'].includes(init.method)) {
    window.dispatchEvent(new Event('awg-staff-data-changed'))
  }
  if (response.status === 204) return undefined as T
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

const staff = { auth: true } as const

// Photo URLs come back relative (/api/photos/{id}); prefix the base URL when set.
function absUrl(url: string | undefined): string | undefined {
  return url && baseUrl && url.startsWith('/') ? `${baseUrl}${url}` : url
}

function fixPhotos(photos: Photo[] | undefined): void {
  for (const photo of photos ?? []) photo.dataUrl = absUrl(photo.dataUrl) ?? photo.dataUrl
}

function fixItems(items: OrderItem[] | undefined): void {
  for (const item of items ?? []) fixPhotos(item.photos)
}

function fixDay(day: AgendaDay): AgendaDay {
  for (const slot of day.slots ?? []) fixPhotos(slot.item?.photos)
  for (const delivery of day.deliveries ?? []) delivery.photoUrl = absUrl(delivery.photoUrl)
  return day
}

function fixForm(view: CustomerFormView): CustomerFormView {
  fixPhotos(view.item?.photos)
  fixItems(view.items)
  return view
}

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',')
  const meta = dataUrl.slice(5, comma)
  const isBase64 = meta.endsWith(';base64')
  const mime = (isBase64 ? meta.slice(0, -7) : meta) || 'application/octet-stream'
  const data = dataUrl.slice(comma + 1)
  if (!isBase64) return new Blob([decodeURIComponent(data)], { type: mime })
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

async function fileToPhoto(file: File): Promise<Photo> {
  const type = await validatePhoto(file)
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read photo'))
    reader.readAsDataURL(file.slice(0, file.size, type))
  })
  return { id: `pho-${Math.random().toString(36).slice(2, 9)}`, name: file.name, dataUrl }
}

function buildFormData(payload: CustomerFormPayload): FormData {
  const form = new FormData()
  const reduced = {
    ...payload,
    items: payload.items.map((item) => ({
      ...item,
      photos: item.photos.map((photo) => ({ id: photo.id, name: photo.name })),
    })),
  }
  form.append('payload', new Blob([JSON.stringify(reduced)], { type: 'application/json' }))
  for (const item of payload.items) {
    for (const photo of item.photos) {
      if (photo.dataUrl.startsWith('data:')) {
        form.append(`photo-${photo.id}`, dataUrlToBlob(photo.dataUrl), photo.name)
      }
    }
  }
  return form
}

function buildCheckoutFormData(input: ShopCheckoutInput): FormData {
  const form = new FormData()
  const reduced = {
    ...input,
    items: input.items.map((item) => ({
      ...item,
      photos: item.photos.map((photo) => ({ id: photo.id, name: photo.name })),
    })),
  }
  form.append('payload', new Blob([JSON.stringify(reduced)], { type: 'application/json' }))
  for (const item of input.items) {
    for (const photo of item.photos) {
      if (photo.dataUrl.startsWith('data:')) {
        form.append(`photo-${photo.id}`, dataUrlToBlob(photo.dataUrl), photo.name)
      }
    }
  }
  return form
}

const enc = encodeURIComponent

export const httpApi: Api = {
  inventory: { list: () => request('/api/inventory', {}, staff), update: (id, quantity, expectedQuantity) => request(`/api/inventory/${enc(id)}`, jsonInit('PATCH', { quantity, expectedQuantity }), staff) },
  paintingDays: { list: (from, to) => request(`/api/painting-days?from=${enc(from)}&to=${enc(to)}`, {}, staff), update: (date, open, maxPaintings, hours) => request(`/api/painting-days/${enc(date)}`, jsonInit('PATCH', { open, maxPaintings, ...hours }), staff) },
  auth: {
    login: (email, password) =>
      request('/api/staff/login', jsonInit('POST', { email, password })),
    me: (token) => request('/api/staff/me', {}, { token }),
    logout: () => request('/api/staff/logout', { method: 'POST' }, staff),
    changePassword: (currentPassword, newPassword) => request('/api/staff/password', jsonInit('POST', { currentPassword, newPassword }), { auth: true, handle401: false }),
  },
  markets: {
    listMarkets: () => request('/api/markets', {}, staff),
    listMarketDays: (marketId) =>
      request(`/api/market-days${marketId ? `?marketId=${enc(marketId)}` : ''}`, {}, staff),
    saveMarket: (input) => request('/api/markets', jsonInit('POST', input), staff),
    deleteMarket: (id) => request(`/api/markets/${enc(id)}`, { method: 'DELETE' }, staff),
    deleteMarketDay: (id) => request(`/api/market-days/${enc(id)}`, { method: 'DELETE' }, staff),
  },
  agenda: {
    listDays: async () => (await request<AgendaDay[]>('/api/agenda/days', {}, staff)).map(fixDay),
    getDay: async (date) => fixDay(await request<AgendaDay>(`/api/agenda/days/${enc(date)}`, {}, staff)),
    moveBlock: (blockId, date, startHour) =>
      request(`/api/agenda/blocks/${enc(blockId)}`, jsonInit('PATCH', { date, startHour }), staff),
    checkCapacity: (input) => request('/api/agenda/capacity', jsonInit('POST', input), staff),
    findMoveSuggestion: async (input) =>
      (await request('/api/agenda/move-suggestion', jsonInit('POST', input), staff)) ?? null,
  },
  orders: {
    listSales: (filters) => {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== '') params.set(key, String(value))
      return request(`/api/orders?${params}`, {}, staff)
    },
    search: (query) => request(`/api/orders/search?q=${enc(query)}`, {}, staff),
    attention: () => request('/api/orders/attention', {}, staff),
    getOrder: (id) => request(`/api/orders/${enc(id)}`, {}, staff),
    getOrderByCode: async (code) => {
      try {
        return await request<Order>(`/api/orders?code=${enc(code)}`, {}, staff)
      } catch (err) {
        if (err instanceof HttpError && err.status === 404) return null
        throw err
      }
    },
    getOrderBundle: async (id) => {
      const bundle = await request<Awaited<ReturnType<Api['orders']['getOrderBundle']>>>(
        `/api/orders/${enc(id)}/bundle`,
        {},
        staff,
      )
      fixItems(bundle.items)
      return bundle
    },
    createSale: (input, key) => request('/api/orders', { ...jsonInit('POST', input), headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key } }, staff),
    cancelOrder: (id, reason) => request(`/api/orders/${enc(id)}/cancel`, jsonInit('POST', { reason }), staff),
    setItemStatus: (orderId, itemId, status) =>
      request(
        `/api/orders/${enc(orderId)}/items/${enc(itemId)}/status`,
        jsonInit('PATCH', { status }),
        staff,
      ),
    setHandedOver: (orderId, handedOver, itemIds) =>
      request(`/api/orders/${enc(orderId)}/handed-over`, jsonInit('PATCH', { handedOver, itemIds }), staff),
  },
  payments: {
    setPaymentState: (orderId, state, method, amountPaid) =>
      request(
        `/api/orders/${enc(orderId)}/payment-state`,
        jsonInit('PATCH', { state, method: method ?? null, amountPaid }),
        staff,
      ),
  },
  tracking: {
    getByCode: (code) =>
      request<TrackView>(`/api/track/${enc(code)}`, { headers: formTokenHeader(code) }),
    updateViennaAddress: (code, address) => {
      const init = jsonInit('PATCH', address)
      return request<TrackView>(`/api/track/${enc(code)}/address`, {
        ...init,
        headers: { ...(init.headers as Record<string, string>), ...formTokenHeader(code) },
      })
    },
  },
  forms: {
    getForm: async (token) => fixForm(await request<CustomerFormView>(`/api/forms/${enc(token)}`)),
    submitForm: async (token, payload, options) => {
      const result = await request<{ orderCode: string }>(`/api/forms/${enc(token)}`, {
        method: 'POST',
        body: buildFormData(payload),
      })
      rememberFormToken(result.orderCode, token, options?.rememberToken)
      return result
    },
  },
  uploads: {
    toPhoto: (file) => fileToPhoto(file),
  },
  metrics: { track: (metric) => request('/api/metrics/buy', jsonInit('POST', buyMetricForHttp(metric))) },
  shop: {
    abandonCheckout: async (code) => { await request(`/api/shop/checkout/${enc(code)}/abandon`, { method: 'POST', headers: formTokenHeader(code) }); forgetFormToken(code) },
    confirmWaitlist: (token) => request('/api/shop/waitlist/confirm', jsonInit('POST', { token })),
    unsubscribeWaitlist: (token) => request('/api/shop/waitlist/unsubscribe', jsonInit('POST', { token })),
    joinWaitlist: (email, locale) => request('/api/shop/waitlist', jsonInit('POST', { email, locale })),
    getConfig: () => request<ShopConfig>('/api/shop/config'),
    listDeliveryDates: (items) => request<ShopDeliveryDate[]>('/api/shop/delivery-dates', jsonInit('POST', { items })),
    listPickupDays: (items) => request<ShopPickupDay[]>('/api/shop/pickup-days', jsonInit('POST', { items })),
    checkout: async (input) => {
      const result = await request<{ orderCode: string; formToken: string; checkoutUrl: string }>(
        '/api/shop/checkout',
        { method: 'POST', body: buildCheckoutFormData(input) },
      )
      rememberFormToken(result.orderCode, result.formToken)
      return result
    },
  },
}
