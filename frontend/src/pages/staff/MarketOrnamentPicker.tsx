import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { api } from '../../api/client'
import { createMarketThumbnailUrl, seedMarketPhoto } from '../../api/marketStockPhotos'
import { StaffText } from '../../components/staff/StaffText'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { marketColors, marketFinishes, marketOrnamentLabel, marketOrnamentParts, searchIds, type MarketOrnament } from '../../domain/marketStock'
import { marketPieceShortSpec } from './saleDraft'
import styles from './MarketOrnamentPicker.module.css'

type CachedPhoto = {
  url: string | null
  isObjectUrl: boolean
  refs: number
  stale: boolean
}

const MAX_CACHED_PHOTOS = 32
const uploadedPhotoCache = new Map<string, CachedPhoto>()
const inFlightPhotos = new Map<string, Promise<CachedPhoto>>()

function revokePhoto(entry: { url: string | null; isObjectUrl: boolean }) {
  if (entry.isObjectUrl && entry.url) URL.revokeObjectURL(entry.url)
}

function evictOverflow() {
  if (uploadedPhotoCache.size <= MAX_CACHED_PHOTOS) return
  for (const [key, entry] of uploadedPhotoCache) {
    if (uploadedPhotoCache.size <= MAX_CACHED_PHOTOS) break
    if (entry.refs > 0) continue
    uploadedPhotoCache.delete(key)
    revokePhoto(entry)
  }
}

function invalidateOlderRevisions(id: string, keepKey: string) {
  const prefix = `${id}:`
  for (const [key, entry] of uploadedPhotoCache) {
    if (!key.startsWith(prefix) || key === keepKey) continue
    if (entry.refs <= 0) {
      uploadedPhotoCache.delete(key)
      revokePhoto(entry)
    } else {
      entry.stale = true
    }
  }
}

function touchCache(key: string, entry: CachedPhoto) {
  uploadedPhotoCache.delete(key)
  uploadedPhotoCache.set(key, entry)
}

function retainCachedPhoto(key: string): CachedPhoto | null {
  const entry = uploadedPhotoCache.get(key)
  if (!entry) return null
  entry.refs += 1
  touchCache(key, entry)
  return entry
}

function releaseCachedPhoto(key: string, entry: CachedPhoto) {
  entry.refs = Math.max(0, entry.refs - 1)
  if (entry.refs === 0 && entry.stale) {
    if (uploadedPhotoCache.get(key) === entry) uploadedPhotoCache.delete(key)
    revokePhoto(entry)
    return
  }
  evictOverflow()
}

function fetchCachedPhoto(id: string, cacheKey: string): Promise<CachedPhoto> {
  const existing = uploadedPhotoCache.get(cacheKey)
  if (existing) return Promise.resolve(existing)
  const pending = inFlightPhotos.get(cacheKey)
  if (pending) return pending
  const load = api.marketStock.photo(id)
    .then(async rawUrl => {
      const prepared = rawUrl ? await createMarketThumbnailUrl(rawUrl) : { url: null, isObjectUrl: false }
      const entry: CachedPhoto = { url: prepared.url, isObjectUrl: prepared.isObjectUrl, refs: 0, stale: false }
      invalidateOlderRevisions(id, cacheKey)
      const previous = uploadedPhotoCache.get(cacheKey)
      if (previous) {
        if (previous.refs <= 0) revokePhoto(previous)
        else previous.stale = true
      }
      touchCache(cacheKey, entry)
      evictOverflow()
      return entry
    })
    .finally(() => {
      inFlightPhotos.delete(cacheKey)
    })
  inFlightPhotos.set(cacheKey, load)
  return load
}

type Props = {
  pieces: MarketOrnament[]
  loading: boolean
  error: string
  onRetry: () => void
  onPick: (id: string) => void
}

export function MarketOrnamentPicker({ pieces, loading, error, onRetry, onPick }: Props) {
  const fieldId = useId()
  const searchId = `${fieldId}-search`
  const colourId = `${fieldId}-colour`
  const finishId = `${fieldId}-finish`
  const [query, setQuery] = useState('')
  const [color, setColor] = useState('')
  const [finish, setFinish] = useState('')
  const pickedRef = useRef(false)
  const matches = searchIds(query, pieces).filter(piece =>
    (!color || piece.id[0] === color) && (!finish || piece.id[1] === finish),
  ).sort((a, b) => a.id.localeCompare(b.id))

  function choose(id: string) {
    if (pickedRef.current) return
    pickedRef.current = true
    onPick(id)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!loading && !error && query.trim() && matches.length === 1) choose(matches[0].id)
  }

  return <form className={styles.picker} onSubmit={submit}>
    <div className={styles.controls}>
      <Field className={styles.field} label="Search inventory ID" htmlFor={searchId}>
        <input id={searchId} type="search" placeholder="e.g. RM01" autoComplete="off"
          enterKeyHint="search" maxLength={16} value={query} onChange={event => setQuery(event.target.value)} />
      </Field>
      <div className={styles.filters}>
        <Field className={styles.field} label="Colour" htmlFor={colourId}>
          <select id={colourId} value={color} onChange={event => setColor(event.target.value)}>
            <option value="">All colours</option>
            {marketColors.map(row => <option key={row.code} value={row.code}>{row.label}</option>)}
          </select>
        </Field>
        <Field className={styles.field} label="Finish" htmlFor={finishId}>
          <select id={finishId} value={finish} onChange={event => setFinish(event.target.value)}>
            <option value="">All finishes</option>
            {marketFinishes.map(row => <option key={row.code} value={row.code}>{row.label}</option>)}
          </select>
        </Field>
      </div>
    </div>
    {loading ? <p role="status">Loading ready ornaments…</p>
      : error ? <div className={styles.error}><p role="alert">{error}</p><Button tone="staff" variant="secondary" onClick={onRetry}>Try again</Button></div>
        : !matches.length ? <p role="status">{pieces.length ? 'No ready ornaments match.' : 'No ready ornaments available.'}</p>
          : <ul className={styles.results} aria-label="Ready ornaments">
            {matches.map(piece => {
              const parts = marketOrnamentParts(piece.id)
              const shortSpec = marketPieceShortSpec(piece.id)
              return <li key={piece.id}>
                <button
                  type="button"
                  className={styles.piece}
                  aria-label={marketOrnamentLabel(piece.id)}
                  onClick={() => choose(piece.id)}
                >
                  <MarketPiecePhoto key={piece.revision} id={piece.id} piece={piece} className={styles.preview} alt="" />
                  <span className={styles.caption}>
                    <strong className={styles.code}>{piece.id}</strong>
                    {shortSpec && <span className={styles.spec}>
                      {parts && <span className={styles.swatch} style={{ background: parts.color.swatch }} aria-hidden="true" />}
                      <StaffText>{shortSpec}</StaffText>
                    </span>}
                  </span>
                </button>
              </li>
            })}
          </ul>}
  </form>
}

export function MarketPiecePhoto({
  id,
  piece,
  probeUploaded = false,
  className,
  alt,
}: {
  id: string
  piece?: Pick<MarketOrnament, 'id' | 'hasUploadedPhoto' | 'revision'>
  probeUploaded?: boolean
  className?: string
  alt: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const shouldFetch = piece ? piece.hasUploadedPhoto : probeUploaded
  // Only cache revision-tagged keys; revision-less probes stay local to this mount.
  const cacheKey = piece ? `${id}:${piece.revision}` : null
  const stateKey = cacheKey ?? `probe:${id}`
  const [loaded, setLoaded] = useState<{ key: string; url: string | null } | null>(null)
  const seeded = seedMarketPhoto(id)
  const parts = marketOrnamentParts(id)

  useEffect(() => {
    if (!shouldFetch || !ref.current) return
    let active = true
    let retained: { key: string; entry: CachedPhoto } | null = null
    let localEntry: { url: string | null; isObjectUrl: boolean } | null = null

    if (cacheKey) {
      const hit = retainCachedPhoto(cacheKey)
      if (hit) {
        retained = { key: cacheKey, entry: hit }
        // Defer sync render updates only when needed; cached URL is already read during render.
        return () => {
          if (retained) releaseCachedPhoto(retained.key, retained.entry)
        }
      }
    }

    // Fetch uploaded photos only as they come into view and keep compact thumbnails in memory.
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      if (cacheKey) {
        void fetchCachedPhoto(id, cacheKey).then(cached => {
          if (!active) {
            evictOverflow()
            return
          }
          cached.refs += 1
          touchCache(cacheKey, cached)
          retained = { key: cacheKey, entry: cached }
          setLoaded({ key: stateKey, url: cached.url })
        }).catch(() => {
          // Keep the reference photo or placeholder if this photo is temporarily unavailable.
        })
      } else {
        void api.marketStock.photo(id).then(async rawUrl => {
          const prepared = rawUrl ? await createMarketThumbnailUrl(rawUrl) : { url: null, isObjectUrl: false }
          if (!active) {
            revokePhoto(prepared)
            return
          }
          localEntry = prepared
          setLoaded({ key: stateKey, url: prepared.url })
        }).catch(() => {
          // Keep the reference photo or placeholder if this photo is temporarily unavailable.
        })
      }
    }, { rootMargin: '120px' })
    observer.observe(ref.current)
    return () => {
      active = false
      observer.disconnect()
      if (retained) releaseCachedPhoto(retained.key, retained.entry)
      if (localEntry) revokePhoto(localEntry)
    }
  }, [shouldFetch, id, cacheKey, stateKey])

  const cachedUrl = shouldFetch && cacheKey && uploadedPhotoCache.has(cacheKey)
    ? uploadedPhotoCache.get(cacheKey)?.url ?? null
    : null
  const uploaded = shouldFetch ? (cachedUrl ?? (loaded?.key === stateKey ? loaded.url : null)) : null
  const photo = uploaded ?? seeded

  return <span ref={ref} className={className ? `${styles.photoBox} ${className}` : styles.photoBox}>
    {photo ? <img src={photo} alt={alt} loading="lazy" /> : (
      <span className={styles.placeholder} aria-hidden="true">
        {parts && <span className={styles.placeholderSwatch} style={{ background: parts.color.swatch }} />}
        <span className={styles.placeholderCode}>{id}</span>
      </span>
    )}
  </span>
}
