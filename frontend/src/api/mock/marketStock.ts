import { marketColors, marketFinishes, type MarketOrnament } from '../../domain/marketStock'
import type { Api } from '../contracts'
import { seedMarketPhoto } from '../marketStockPhotos'

type StoredOrnament = MarketOrnament & { photo?: Blob }
type SaleLink = { orderId: string; orderCode: string; soldAt: string }

function stockError(message: string, code: string, status: number) {
  return Object.assign(new Error(message), { code, status })
}

function requireEditable(row: StoredOrnament, revision: number, target?: string) {
  if (target === 'sold') {
    throw stockError('Sell ornaments through New sale. Cancel the order to return a sold ornament.', 'MARKET_STOCK_SELL_IN_SALE', 400)
  }
  if (row.revision !== revision) {
    throw stockError('Someone else updated this ornament. Check the current details and try again.', 'MARKET_STOCK_CHANGED', 409)
  }
  if (row.status === 'sold') {
    throw stockError('Sell ornaments through New sale. Cancel the order to return a sold ornament.', 'MARKET_STOCK_SELL_IN_SALE', 400)
  }
}

const seeds = new Map(marketColors.flatMap(color => marketFinishes.flatMap(finish =>
  Array.from({ length: color[finish.key] }, (_, index) => {
    const id = `${color.code}${finish.code}${String(index + 1).padStart(2, '0')}`
    const ornament: MarketOrnament = {
      id, status: seedMarketPhoto(id) ? 'painted' : 'unpainted', soldAt: null, revision: 0, hasUploadedPhoto: false,
      orderId: null, orderCode: null,
    }
    return [id, ornament] as const
  }),
)))

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('awg-market-stock', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('ornaments', { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transact<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore, done: (result: T) => void, fail: (error: unknown) => void) => void,
): Promise<T> {
  const database = await openDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction('ornaments', mode)
      let result: T
      transaction.oncomplete = () => resolve(result)
      transaction.onabort = () => reject(transaction.error ?? new Error('Could not save market stock.'))
      run(transaction.objectStore('ornaments'), value => { result = value }, error => {
        reject(error)
        transaction.abort()
      })
    })
  } finally {
    database.close()
  }
}

function update(id: string, revision: number, change: (row: StoredOrnament) => StoredOrnament, target?: string): Promise<MarketOrnament> {
  return transact('readwrite', (store, done, fail) => {
    const request = store.get(id)
    request.onsuccess = () => {
      const current = (request.result as StoredOrnament | undefined) ?? seeds.get(id)
      try {
        if (!current) throw stockError('Ornament not found.', 'NOT_FOUND', 404)
        requireEditable(current, revision, target)
        const next = change(current)
        store.put(next)
        done(summary(next))
      } catch (error) {
        fail(error)
      }
    }
  })
}

function summary(row: StoredOrnament): MarketOrnament {
  const { id, status, soldAt, revision, hasUploadedPhoto } = row
  return {
    id, status, soldAt, revision, hasUploadedPhoto,
    orderId: status === 'sold' ? row.orderId ?? null : null,
    orderCode: status === 'sold' ? row.orderCode ?? null : null,
  }
}

// IndexedDB serialises the read/check/write across tabs. One failing piece rolls back the whole cart.
function updateSalePieces(ids: string[], change: (row: StoredOrnament) => StoredOrnament | null): Promise<void> {
  if (!ids.length) return Promise.resolve()
  return transact<void>('readwrite', (store, done, fail) => {
    const request = store.getAll()
    request.onsuccess = () => {
      const saved = new Map((request.result as StoredOrnament[]).map(row => [row.id, row]))
      try {
        for (const id of ids) {
          const current = saved.get(id) ?? seeds.get(id)
          if (!current) throw stockError('Ornament not found.', 'NOT_FOUND', 404)
          const next = change(current)
          if (next) store.put(next)
        }
        done(undefined)
      } catch (error) {
        fail(error)
      }
    }
  })
}

export function sellMarketPieces(ids: string[], sale: SaleLink): Promise<void> {
  return updateSalePieces(ids, row => {
    if (row.status === 'sold') throw stockError('This ornament was already sold.', 'MARKET_STOCK_SOLD', 409)
    if (row.status !== 'painted') throw stockError('This ornament is not painted yet.', 'MARKET_STOCK_NOT_READY', 409)
    return { ...row, ...sale, status: 'sold', revision: row.revision + 1 }
  })
}

export function returnMarketPieces(ids: string[], orderId: string): Promise<void> {
  return updateSalePieces(ids, row => row.status === 'sold' && row.orderId === orderId
    ? { ...row, status: 'painted', soldAt: null, orderId: null, orderCode: null, revision: row.revision + 1 }
    : null)
}

function dataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export const mockMarketStock: Api['marketStock'] = {
  list: () => transact('readonly', (store, done) => {
    const request = store.getAll()
    request.onsuccess = () => {
      const saved = new Map((request.result as StoredOrnament[]).map(row => [row.id, row]))
      done([...seeds.values()].map(row => summary(saved.get(row.id) ?? row)))
    }
  }),
  photo: async id => {
    const file = await transact<Blob | null>('readonly', (store, done) => {
      const request = store.get(id)
      request.onsuccess = () => done((request.result as StoredOrnament | undefined)?.photo ?? null)
    })
    return file ? dataUrl(file) : null
  },
  changeStatus: (id, status, revision) => update(id, revision, current => {
    if (status === current.status) return current
    if (status !== 'unpainted' && status !== 'painted') {
      throw stockError('Choose unpainted or painted.', 'VALIDATION', 400)
    }
    return { ...current, status, soldAt: null, revision: revision + 1 }
  }, status),
  savePhoto: (id, photo, revision) => update(id, revision, current => ({
    ...current, photo, hasUploadedPhoto: true, revision: revision + 1,
  })),
}
