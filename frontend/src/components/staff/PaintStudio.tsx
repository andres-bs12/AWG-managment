import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/Button'
import type { Photo } from '../../domain/types'
import {
  applyPaintFilter,
  cssFallbackFilter,
  loadPaintImage,
  PAINT_FILTERS,
  rasterizePhoto,
  type PaintFilter,
} from '../../lib/paintFilters'
import { usePanZoom } from '../../lib/usePanZoom'
import styles from './PaintStudio.module.css'

type Props = {
  photos: Photo[]
  alt: string
}

type Bitmap = {
  src: string
  width: number
  height: number
  pixels: Uint8ClampedArray | null
}

export function PaintStudio({ photos, alt }: Props) {
  const [index, setIndex] = useState(0)
  const [filter, setFilter] = useState<PaintFilter>('color')
  const [bitmap, setBitmap] = useState<Bitmap | null>(null)
  const [mode, setMode] = useState<'canvas' | 'css'>('canvas')
  const [status, setStatus] = useState('Loading photo…')
  const stageRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const photo = photos[Math.min(index, Math.max(0, photos.length - 1))] ?? photos[0]

  const { percent, minPercent, maxPercent, zoomIn, zoomOut, fit, setRelative } = usePanZoom({
    stageRef,
    layerRef,
    width: bitmap?.width ?? 0,
    height: bitmap?.height ?? 0,
    resetKey: photo?.id ?? 'empty',
  })

  useEffect(() => {
    if (!photo) {
      setBitmap(null)
      setStatus('No photos uploaded')
      return
    }
    let cancelled = false
    setStatus('Loading photo…')
    setBitmap(null)
    loadPaintImage(photo.dataUrl)
      .then(({ image }) => {
        if (cancelled) return
        const raster = rasterizePhoto(image)
        setBitmap({
          src: photo.dataUrl,
          width: raster.width,
          height: raster.height,
          pixels: raster.pixels,
        })
        setMode(raster.pixels ? 'canvas' : 'css')
        setStatus('')
      })
      .catch(() => {
        if (!cancelled) setStatus('Could not load this photo.')
      })
    return () => {
      cancelled = true
    }
  }, [photo])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !bitmap?.pixels) return
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.putImageData(applyPaintFilter(bitmap.pixels, bitmap.width, bitmap.height, filter), 0, 0)
  }, [bitmap, filter])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(photos.length - 1, i + 1))
      const n = Number(e.key)
      if (n >= 1 && n <= PAINT_FILTERS.length) setFilter(PAINT_FILTERS[n - 1].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [photos.length])

  return (
    <div className={styles.studio}>
      <div
        ref={stageRef}
        className={styles.stage}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Painting reference photo"
      >
        {bitmap ? (
          <div
            ref={layerRef}
            className={styles.layer}
            style={{ width: bitmap.width, height: bitmap.height }}
          >
            {mode === 'canvas' && bitmap.pixels ? (
              <canvas ref={canvasRef} className={styles.bitmap} aria-label={alt} />
            ) : (
              <img
                className={styles.bitmap}
                src={bitmap.src}
                alt={alt}
                draggable={false}
                style={{ filter: cssFallbackFilter(filter) }}
              />
            )}
          </div>
        ) : (
          <p className={styles.status} role="status">
            {status}
          </p>
        )}
      </div>

      <div className={styles.bar}>
        <div className={styles.tools}>
          <div className={styles.filters} role="toolbar" aria-label="Drawing filters">
            {PAINT_FILTERS.map((item) => (
              <Button
                key={item.id}
                className={styles.chip}
                tone="staff"
                variant="ghost"
                selected={filter === item.id}
                title={item.hint}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <div className={styles.zoom}>
            <Button className={styles.zoomBtn} tone="staff" variant="ghost" aria-label="Zoom out" onClick={zoomOut}>
              −
            </Button>
            <input
              className={styles.slider}
              type="range"
              min={minPercent}
              max={maxPercent}
              value={percent}
              aria-label="Zoom"
              onChange={(e) => setRelative(Number(e.target.value) / 100)}
            />
            <span className={styles.percent}>{percent}%</span>
            <Button className={styles.zoomBtn} tone="staff" variant="ghost" aria-label="Zoom in" onClick={zoomIn}>
              +
            </Button>
            <Button tone="staff" variant="secondary" onClick={fit}>
              Fit
            </Button>
          </div>
        </div>
        <p className={styles.hint}>
          Whole photo at 100%. Pinch, scroll or the slider to zoom · drag to pan · double-tap a spot to zoom in.
        </p>
        {photos.length > 1 ? (
          <div className={styles.thumbs} role="tablist" aria-label="Photos">
            {photos.map((item, i) => (
              <button
                key={item.id}
                type="button"
                className={styles.thumb}
                data-active={i === index ? 'true' : 'false'}
                aria-label={`Photo ${i + 1} of ${photos.length}`}
                onClick={() => setIndex(i)}
              >
                <img src={item.dataUrl} alt="" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
