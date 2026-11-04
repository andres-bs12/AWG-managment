import { FarTown, TreeRow } from './FlatTown'
import styles from './WinterBackdrop.module.css'

type Props = {
  /** `calm` dims the scene so foreground panels stay readable. */
  mood?: 'hero' | 'calm'
}

/** Flat Santa-Tracker cloud: a few overlapping discs on a flat base, with a shaded underside. */
function Cloud({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 160 64" aria-hidden="true">
      <path d="M14 60 Q2 60 4 48 Q6 36 22 38 Q24 18 46 18 Q58 4 80 10 Q100 2 112 20 Q134 16 140 34 Q158 34 156 50 Q154 60 142 60 Z" fill="#ffffff" />
      <path d="M8 56 Q30 50 60 56 Q96 50 124 56 Q144 52 154 54 Q152 60 142 60 H14 Q6 60 8 56 Z" fill="#d6eef8" />
    </svg>
  )
}

/** Distant wind turbine; only the blades turn, and they sit in their own tiny SVG group. */
function Turbine({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 60 120" aria-hidden="true">
      <path d="M28.6 30 L27 120 H33 L31.4 30 Z" fill="currentColor" />
      <g className={styles.blades}>
        <path d="M30 30 L28.4 2 Q30 -1 31.6 2 Z M30 30 L54 44 Q55 47.6 52 47 Z M30 30 L8 47 Q5 47.6 6 44 Z" fill="currentColor" />
        <circle cx="30" cy="30" r="3.2" fill="currentColor" />
      </g>
    </svg>
  )
}

export function WinterBackdrop({ mood = 'hero' }: Props) {
  return (
    <div className={`${styles.backdrop} ${mood === 'calm' ? styles.calm : ''}`} aria-hidden="true">
      <div className={styles.sky} />
      <div className={styles.sun} />

      <Cloud className={`${styles.cloud} ${styles.cloudA}`} />
      <Cloud className={`${styles.cloud} ${styles.cloudB}`} />
      <Cloud className={`${styles.cloud} ${styles.cloudC}`} />

      {/* A distant sleigh crossing the sky — desktop only, very low contrast. */}
      <div className={styles.farSleigh}>
        <svg viewBox="0 0 120 40" className={styles.farSleighArt}>
          <g fill="currentColor">
            <path d="M6 30 q0 -10 10 -10 h14 l-3 10 h10 v6 H14 q-8 0 -8 -6 Z" />
            <path d="M4 38 h34 q6 0 8 -5" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <ellipse cx="66" cy="26" rx="11" ry="6" />
            <path d="M74 22 l5 -9 l5 3 l-4 9 Z" />
            <ellipse cx="82" cy="12" rx="6" ry="4" />
            <path d="M80 9 l-3 -6 M86 8 l3 -6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <ellipse cx="100" cy="24" rx="11" ry="6" />
            <path d="M108 20 l5 -9 l5 3 l-4 9 Z" />
            <ellipse cx="116" cy="10" rx="6" ry="4" />
            <path d="M40 28 q12 -4 24 -3 M78 25 q10 -3 20 -2" stroke="currentColor" strokeWidth="1.6" fill="none" />
          </g>
        </svg>
      </div>

      <Turbine className={`${styles.turbine} ${styles.turbineA}`} />
      <Turbine className={`${styles.turbine} ${styles.turbineB}`} />

      {/*
        Depth, back to front: each layer is darker and more saturated than the one behind it, and a
        haze band sits between layers so distant things fade into the sky, as in Santa Tracker.
      */}
      <svg className={styles.ridgeFar} viewBox="0 0 1200 240" preserveAspectRatio="none">
        <path d="M0 240 L0 150 L130 66 L250 140 L360 92 L470 170 L600 104 L720 164 L850 88 L980 152 L1090 108 L1200 168 L1200 240 Z" />
      </svg>
      <svg className={styles.ridgeNear} viewBox="0 0 1200 200" preserveAspectRatio="none">
        <path d="M0 200 L0 132 L110 78 L230 136 L340 96 L470 150 L590 100 L700 146 L830 96 L960 144 L1080 100 L1200 150 L1200 200 Z" />
      </svg>
      <div className={styles.hazeFar} />

      <FarTown className={styles.village} />
      <div className={styles.hazeTown} />
      <TreeRow className={styles.pinesBack} />

      <div className={styles.field}>
        <div className={styles.drift} />
      </div>
    </div>
  )
}
