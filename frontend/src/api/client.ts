import type { Api } from './contracts'
import { httpApi } from './http/services'
import { mockApi } from './mock/services'

export function getDataSource(): 'mock' | 'http' {
  return import.meta.env.VITE_DATA_SOURCE === 'http' ? 'http' : 'mock'
}

export function getApi(): Api {
  return getDataSource() === 'http' ? httpApi : mockApi
}

export const api: Api = new Proxy({} as Api, {
  get(_target, prop, _receiver) {
    const real = getApi()
    return Reflect.get(real, prop)
  },
})
