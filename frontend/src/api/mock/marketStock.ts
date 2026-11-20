import { marketColors, marketFinishes, type MarketOrnament } from '../../domain/marketStock'
import type { Api } from '../contracts'
import { seedMarketPhoto } from '../marketStockPhotos'

type StoredOrnament = MarketOrnament & { photo?: Blob }

const seeds = new Map(marketColors.flatMap(color => marketFinishes.flatMap(finish =>
  Array.from({ length: color[finish.key] }, (_, index) => {
    const id = `${color.code}${finish.code}${String(index + 1).padStart(2, '0')}`
    const ornament: MarketOrnament = {
      id, status: seedMarketPhoto(id) ? 'painted' : 'unpainted', soldAt: null, revision: 0, hasUploadedPhoto: false,
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

function update(id: string, revision: number, change: (row: StoredOrnament) => StoredOrnament): Promise<MarketOrnament> {
  return transact('readwrite', (store, done, fail) => {
    const request = store.get(id)
    request.onsuccess = () => {
      const current = (request.result as StoredOrnament | undefined) ?? seeds.get(id)
      try {
        if (!current) throw new Error('Ornament not found.')
        if (current.revision !== revision) {
          throw Object.assign(new Error('Someone else updated this ornament. Check the current details and try again.'), {
            code: 'MARKET_STOCK_CHANGED',
          })
        }
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
  return { id, status, soldAt, revision, hasUploadedPhoto }
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
    if ((status === 'sold' && current.status !== 'painted') || (current.status === 'sold' && status !== 'painted')) {
      throw new Error('Only a painted ornament can be sold. Undo the sale before changing its paint status.')
    }
    return { ...current, status, soldAt: status === 'sold' ? new Date().toISOString() : null, revision: revision + 1 }
  }),
  savePhoto: (id, photo, revision) => update(id, revision, current => ({
    ...current, photo, hasUploadedPhoto: true, revision: revision + 1,
  })),
}
