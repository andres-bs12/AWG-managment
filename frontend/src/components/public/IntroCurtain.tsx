import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PetBauble } from './PetBauble'
import styles from './IntroCurtain.module.css'

type Props = {
  label: string
  /** Fires as the curtain starts to rise, so the page can start its own entrance underneath. */
  onReveal: () => void
  /** Fires once the curtain is fully gone and can be unmounted. */
  onDone: () => void
}

/** Two full waves; a page that is already loaded never waits longer than this. */
const MIN_MS = 2000
/** Slow networks still get the scene: the curtain never holds past this. */
const MAX_MS = 3800
const LEAVE_MS = 760

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function pageReady(): Promise<unknown> {
  const loaded =
    document.readyState === 'complete'
      ? Promise.resolve()
      : new Promise<void>((resolve) => window.addEventListener('load', () => resolve(), { once: true }))
  return Promise.all([loaded, document.fonts?.ready ?? Promise.resolve()])
}

/**
 * Opening curtain, after Santa Tracker: two of our pet ornaments swing on their threads while
 * the page settles, then the whole panel lifts away to reveal the village. Any tap or key skips it.
 */
export function IntroCurtain({ label, onReveal, onDone }: Props) {
  const [leaving, setLeaving] = useState(false)
  const callbacks = useRef({ onReveal, onDone })

  useEffect(() => {
    callbacks.current = { onReveal, onDone }
  })

  useEffect(() => {
    if (leaving) return
    const reduced = prefersReducedMotion()
    const started = performance.now()
    let cancelled = false
    let holdTimer = 0

    const leave = () => {
      if (cancelled) return
      cancelled = true
      setLeaving(true)
      callbacks.current.onReveal()
    }

    Promise.race([pageReady(), new Promise((resolve) => window.setTimeout(resolve, MAX_MS))]).then(() => {
      if (cancelled) return
      const wait = Math.max(0, (reduced ? 350 : MIN_MS) - (performance.now() - started))
      holdTimer = window.setTimeout(leave, wait)
    })

    window.addEventListener('pointerdown', leave, { once: true })
    window.addEventListener('keydown', leave, { once: true })
    return () => {
      cancelled = true
      window.clearTimeout(holdTimer)
      window.removeEventListener('pointerdown', leave)
      window.removeEventListener('keydown', leave)
    }
  }, [leaving])

  useEffect(() => {
    if (!leaving) return
    const timer = window.setTimeout(() => callbacks.current.onDone(), prefersReducedMotion() ? 260 : LEAVE_MS)
    return () => window.clearTimeout(timer)
  }, [leaving])

  return createPortal(
    <div className={`${styles.curtain} ${leaving ? styles.leaving : ''}`} role="status" aria-live="polite">
      <div className={styles.panel}>
        <div className={styles.baubles} aria-hidden="true">
          <PetBauble pet="cat" className={`${styles.hang} ${styles.hangA}`} />
          <PetBauble pet="dog" className={`${styles.hang} ${styles.hangB}`} />
        </div>

        <div className={styles.copy}>
          <p className={styles.brand} aria-hidden="true">
            ArtWithGab
          </p>
          <p className={styles.label}>{label}</p>
          <div className={styles.dots} aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>

      {/* Scalloped hem that hangs below the panel, only seen while the curtain rises. */}
      <svg className={styles.hem} viewBox="0 0 400 24" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M0 0 H400 V8 Q390 20 380 8 Q366 22 352 8 Q340 16 328 8 Q312 24 296 8 Q284 18 272 8 Q256 22 240 8 Q228 16 216 8 Q200 24 184 8 Q172 18 160 8 Q144 22 128 8 Q116 16 104 8 Q88 24 72 8 Q60 18 48 8 Q32 22 16 8 Q8 16 0 8 Z"
          fill="var(--sky-low)"
        />
      </svg>
    </div>,
    document.body,
  )
}
