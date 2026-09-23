import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useMockStoreVersion } from '../../api/mock/useMockStore'
import { ButtonLink } from '../../components/ui/ButtonLink'
import type { Market, MarketDay } from '../../domain/types'
import { formatEur } from '../../lib/money'
import { formatDateLabel } from '../../lib/time'
import styles from './MarketsPage.module.css'

function seasonLabel(market: Market): string {
  if (!market.startDate || !market.finishDate) return 'No season'
  return `${formatDateLabel(market.startDate)} – ${formatDateLabel(market.finishDate)}`
}

function dayCountLabel(count: number): string {
  if (count === 0) return 'No days yet'
  if (count === 1) return '1 day'
  return `${count} days`
}

export function MarketsPage() {
  const version = useMockStoreVersion()
  const [markets, setMarkets] = useState<Market[]>([])
  const [days, setDays] = useState<MarketDay[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancel = false
    void Promise.all([api.markets.listMarkets(), api.markets.listMarketDays()])
      .then(([nextMarkets, nextDays]) => {
        if (cancel) return
        setMarkets(nextMarkets.filter((market) => market.kind === 'market'))
        setDays(nextDays)
        setReady(true)
      })
      .catch((err: unknown) => {
        if (cancel) return
        setError(err instanceof Error ? err.message : 'Could not load markets')
        setReady(true)
      })
    return () => {
      cancel = true
    }
  }, [version])

  if (!ready) return <p>Loading markets…</p>

  return (
    <section>
      <div className={styles.head}>
        <div>
          <h1>Markets</h1>
          <p className={styles.sub}>Stall seasons and the Friday–Sunday pickup days.</p>
        </div>
        <ButtonLink to="/staff/markets/new" tone="staff" variant="primary">
          New market
        </ButtonLink>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {markets.length === 0 ? (
        <p className={styles.empty}>No markets yet.</p>
      ) : (
        <ul className={styles.list}>
          {markets.map((market) => {
            const count = days.filter((day) => day.marketId === market.id).length
            const meta = [
              market.stall == null ? 'No stall' : `Stall ${market.stall}`,
              formatEur(market.totalCost),
              seasonLabel(market),
              dayCountLabel(count),
            ].join(' · ')
            return (
              <li key={market.id}>
                <Link className={styles.card} to={`/staff/markets/${market.id}`}>
                  <span className={styles.name}>{market.name}</span>
                  <span className={styles.meta}>{meta}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
