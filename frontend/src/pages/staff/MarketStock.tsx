import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { prepareMarketPhoto, seedMarketPhoto } from '../../api/marketStockPhotos'
import { StaffDialog } from '../../components/staff/StaffDialog'
import { StaffText } from '../../components/staff/StaffText'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import {
  marketColors, marketFinishes, marketOrnamentParts, marketStatusLabels, searchIds,
  type MarketOrnament, type MarketOrnamentStatus, type MarketPaintStatus,
} from '../../domain/marketStock'
import { useStaffRefresh } from '../../lib/useStaffRefresh'
import styles from './MarketStock.module.css'

const statusOptions = Object.entries(marketStatusLabels)

export function MarketStock() {
  const version = useStaffRefresh()
  const [ornaments, setOrnaments] = useState<MarketOrnament[] | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api.marketStock.list()
      .then(rows => { if (active) { setOrnaments(rows); setError('') } })
      .catch(() => { if (active) setError('Could not load market stock. Check the connection and try again.') })
    return () => { active = false }
  }, [attempt, version])

  const matches = searchIds(query, (ornaments ?? []).filter(item => status === 'all' || item.status === status))
  const selected = ornaments?.find(item => item.id === selectedId)
  const filtering = query.trim() !== '' || status !== 'all'
  const FinishHeading = filtering ? 'h4' : 'h3'

  function applyUpdate(next: MarketOrnament) {
    setOrnaments(current => current?.map(item => item.id === next.id ? next : item) ?? null)
  }

  function openMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (query.trim() && matches.length === 1) setSelectedId(matches[0].id)
  }

  return <section aria-labelledby="market-stock-heading" className={styles.section}>
    <div className={styles.heading}>
      <h2 id="market-stock-heading">Market ornaments</h2>
    </div>
    {error && <div className={styles.heading}>
      <p role="alert">{error}</p>
      <Button tone="staff" variant="secondary" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Try again</Button>
    </div>}
    {!ornaments && !error && <p role="status">Loading market ornaments…</p>}
    {ornaments && <>
      <dl className={styles.totals} aria-label="Market stock totals">
        <div><dt>Total</dt><dd>{ornaments.length}</dd></div>
        {statusOptions.map(([value, label]) =>
          <div key={value}><dt>{label}</dt><dd>{ornaments.filter(item => item.status === value).length}</dd></div>,
        )}
      </dl>
      <form aria-label="Find a market ornament" className={styles.search} onSubmit={openMatch}>
        <Field className={styles.field} label="Search inventory ID" htmlFor="market-stock-search">
          <input id="market-stock-search" type="search" placeholder="e.g. RM01" autoComplete="off" maxLength={16}
            value={query} onChange={event => setQuery(event.target.value)} />
        </Field>
        <Field className={styles.field} label="Status" htmlFor="market-stock-status">
          <select id="market-stock-status" value={status} onChange={event => setStatus(event.target.value)}>
            <option value="all">All</option>
            {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
      </form>
      {matches.length === 0 && <p role="status">{ornaments.length ? 'No ornaments match your search.' : 'No market ornaments configured.'}</p>}
      <div className={styles.colors}>
        {marketColors.map(color => {
          const rows = matches.filter(item => item.id.startsWith(color.code))
          if (!rows.length) return null
          const label = <>
            <span className={styles.swatch} style={{ background: color.swatch }} aria-hidden="true" />
            <span className={styles.color}>{color.label}</span>
            <span className={styles.count}>{rows.length} {rows.length === 1 ? 'ornament' : 'ornaments'}</span>
          </>
          const groups = <div className={styles.finishes}>
            {marketFinishes.map(finish => {
              const entries = rows.filter(item => item.id.startsWith(color.code + finish.code)).sort((a, b) => a.id.localeCompare(b.id))
              if (!entries.length) return null
              return <section key={finish.code} aria-label={`${color.label} ${finish.label}`} className={styles.finish}>
                <FinishHeading>{finish.label} <span>{entries.length}</span></FinishHeading>
                <ul className={styles.items}>
                  {entries.map(item => <li key={item.id}>
                    <button type="button" className={styles.ornament} onClick={() => setSelectedId(item.id)}>
                      <strong>{item.id}</strong><Status value={item.status} />
                    </button>
                  </li>)}
                </ul>
              </section>
            })}
          </div>
          return filtering
            ? <section key={color.code} className={styles.card}><h3 className={styles.cardHeader}>{label}</h3>{groups}</section>
            : <details key={color.code} name="market-stock-color" className={styles.card}>
                <summary className={styles.cardHeader}>{label}<span className={styles.chevron} aria-hidden="true" /></summary>
                {groups}
              </details>
        })}
      </div>
    </>}
    {selected && <OrnamentDialog key={selected.id} item={selected}
      onClose={() => setSelectedId(null)} onUpdate={applyUpdate} onReplaceAll={setOrnaments} />}
  </section>
}

function Status({ value }: { value: MarketOrnamentStatus }) {
  return <span className={styles.status} data-status={value}>{marketStatusLabels[value]}</span>
}

const soldDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Vienna', dateStyle: 'medium', timeStyle: 'short' })

function OrnamentDialog({ item, onClose, onUpdate, onReplaceAll }: {
  item: MarketOrnament
  onClose: () => void
  onUpdate: (row: MarketOrnament) => void
  onReplaceAll: (rows: MarketOrnament[]) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [photo, setPhoto] = useState<{ revision: number; url: string | null; failed?: boolean } | null>(null)
  const [photoAttempt, setPhotoAttempt] = useState(0)
  const parts = marketOrnamentParts(item.id)
  const fallback = seedMarketPhoto(item.id)
  const currentPhoto = photo?.revision === item.revision ? photo : null
  const image = item.hasUploadedPhoto ? currentPhoto?.url : fallback

  useEffect(() => {
    if (!item.hasUploadedPhoto) return
    let active = true
    const revision = item.revision
    api.marketStock.photo(item.id)
      .then(url => { if (active) setPhoto({ revision, url, failed: !url }) })
      .catch(() => { if (active) setPhoto({ revision, url: null, failed: true }) })
    return () => { active = false }
  }, [item.id, item.revision, item.hasUploadedPhoto, photoAttempt])

  async function save(change: () => Promise<MarketOrnament>, success: string) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const next = await change()
      onUpdate(next)
      setNotice(success)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the ornament. Try again.')
      if (['MARKET_STOCK_CHANGED', 'MARKET_STOCK_SELL_IN_SALE'].includes((err as { code?: string })?.code ?? '')) {
        try {
          onReplaceAll(await api.marketStock.list())
        } catch {
          setError('Could not refresh this ornament. Reopen Stock and try again.')
        }
      }
    } finally {
      setBusy(false)
    }
  }

  function changeStatus(status: MarketPaintStatus, message: string) {
    void save(() => api.marketStock.changeStatus(item.id, status, item.revision), message)
  }

  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void save(async () => api.marketStock.savePhoto(item.id, await prepareMarketPhoto(file), item.revision), 'Photo saved.')
  }

  return <StaffDialog title={item.id} busy={busy} onClose={onClose}>
    <div className={styles.detail}>
      <div className={styles.detailLine}>
        {parts && <p><StaffText>{`${parts.color.label} · ${parts.finish.label}`}</StaffText></p>}
        {item.status !== 'sold' && <Status value={item.status} />}
      </div>
      {item.status === 'sold' && <p className={styles.saleLink}>
        <span>Sold{item.soldAt && ` ${soldDate.format(new Date(item.soldAt))}`}{item.orderId && item.orderCode && ' ·'}</span>
        {item.orderId && item.orderCode && <Link to={`/staff/orders/${encodeURIComponent(item.orderId)}`} state={{ from: '/staff/inventory' }}>Order {item.orderCode}</Link>}
      </p>}
      {item.status !== 'sold' && <div className={styles.actions}>
        {item.status === 'unpainted' ? <Button tone="staff" size="lg" disabled={busy}
          onClick={() => changeStatus('painted', 'Marked as painted.')}>Mark painted</Button>
          : <Button tone="staff" variant="secondary" disabled={busy}
            onClick={() => changeStatus('unpainted', 'Moved back to To paint.')}>Mark unpainted</Button>}
      </div>}
      {notice && <p role="status">{notice}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {image && <img className={styles.photo} src={image} alt={`Painted design on ${item.id}`} />}
      {item.hasUploadedPhoto && !currentPhoto && <p role="status">Loading photo…</p>}
      {currentPhoto?.failed && <div className={styles.heading}>
        <p role="alert">Could not load the photo.</p>
        <Button tone="staff" variant="secondary" onClick={() => { setPhoto(null); setPhotoAttempt(value => value + 1) }}>Retry photo</Button>
      </div>}
      {item.status !== 'sold' && <Field className={styles.field} label={item.hasUploadedPhoto || fallback ? 'Replace photo' : 'Add photo'} htmlFor="market-stock-photo">
        <input id="market-stock-photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          disabled={busy} onChange={upload} />
      </Field>}
    </div>
  </StaffDialog>
}
