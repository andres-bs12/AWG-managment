/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE: 'mock' | 'http' | (string & {})
  readonly VITE_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'data-source' {
  export const selectedApi: import('./api/contracts').Api
}

declare module 'demo-source' {
 export function useMockStoreVersion(): number
 export function resetStore(): void
 export const DEMO_NOW_HOUR: number
 export const demoEmail: string
 export const demoAccounts: string
}
