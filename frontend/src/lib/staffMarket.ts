import { createContext, useContext } from 'react'
import type { Market, MarketDay } from '../domain/types'

export const STAFF_MARKET_KEY = 'awg-active-market-id'

export type StaffStall = { market: Market; day: MarketDay }

export const StaffMarketContext = createContext<{
  stalls: StaffStall[]
  activeMarket: Market | null
  activeMarketDay: MarketDay | null
}>({ stalls: [], activeMarket: null, activeMarketDay: null })

export function useStaffMarket() {
  return useContext(StaffMarketContext)
}
