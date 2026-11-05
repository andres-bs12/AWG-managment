import type { Api } from './contracts'
import { selectedApi } from 'data-source'
import { pruneFormTokens } from './formTokens'

pruneFormTokens()

export function getDataSource(): 'mock' | 'http' {
  return import.meta.env.VITE_DATA_SOURCE === 'http' ? 'http' : 'mock'
}

export function getApi(): Api {
  return selectedApi
}

export const api: Api = new Proxy({} as Api, {
  get(_target, prop, _receiver) {
    const real = getApi()
    return Reflect.get(real, prop)
  },
})
