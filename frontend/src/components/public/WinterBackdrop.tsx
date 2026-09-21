import { useMemo } from 'react'
import styles from './WinterBackdrop.module.css'

type Props = {
  /** `calm` dims the scene so foreground panels stay readable. */
  mood?: 'hero' | 'calm'
}

const STAR_COUNT = 42

/** Silhouetted market row: [x, width, height] with the baseline at y=120. */
const BOOTHS: ReadonlyArray<readonly [number, number, number]> = [
  [40, 46, 26],
  [96, 32, 20],
  [146, 52, 30],
  [222, 38, 22],
  [292, 58, 34],
  [364, 34, 20],
  [500, 46, 26],
  [572, 68, 40],
  [658, 38, 22],
  [724, 52, 30],
  [812, 36, 20],
  [864, 56, 34],
  [1060, 42, 24],
  [1116, 54, 28],
]

function Booth({ x, w, h }: { x: number; w: number; h: number }) {
  const y = 120 - h
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="2" />
      <path d={`M${x - 6} ${y + 1} L${x + w / 2} ${y - 13} L${x + w + 6} ${y + 1} Z`} />
    </g>
  )
}

/** Tiny pedestrian, drawn as a silhouette because it is only ~18px tall on screen. */
function Walker({ scale = 1 }: { scale?: number }) {
  return (
    <g transform={`scale(${scale})`}>
      <circle cx="7" cy="4" r="3.4" />
      <path d="M7 7.5 q4 1 4 7 l-1 6 h-6 l-1 -6 q0 -6 4 -7 Z" />
      <path d="M5 20 l-1 4 M9 20 l1 4" strokeWidth="1.8" strokeLinecap="round" />
    </g>
  )
}

export function WinterBackdrop({ mood = 'hero' }: Props) {
  const stars = useMemo(
    () =>
      Array.from({ length: STAR_COUNT }, (_, i) => ({
        id: i,
        left: `${(i * 61.8) % 100}%`,
        top: `${4 + ((i * 29) % 50)}%`,
        size: i % 9 === 0 ? 3 : 2,
        delay: `${((i * 0.73) % 4).toFixed(2)}s`,
        duration: `${(2.6 + ((i * 0.31) % 2.4)).toFixed(2)}s`,
      })),
    [],
  )

  return (
    <div className={`${styles.backdrop} ${mood === 'calm' ? styles.calm : ''}`} aria-hidden="true">
      <div className={styles.sky} />
      <div className={styles.auroraA} />
      <div className={styles.auroraB} />

      <div className={styles.stars}>
        {stars.map((star) => (
          <span
            key={star.id}
            className={styles.star}
            style={{
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              animationDelay: star.delay,
              animationDuration: star.duration,
            }}
          />
        ))}
      </div>

      <div className={styles.moon}>
        <span className={styles.moonBody} />
      </div>

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

      <svg className={styles.ridgeFar} viewBox="0 0 1200 240" preserveAspectRatio="none">
        <path d="M0 240 L0 150 L130 66 L250 140 L360 92 L470 170 L600 104 L720 164 L850 88 L980 152 L1090 108 L1200 168 L1200 240 Z" />
      </svg>

      <svg className={styles.ridgeNear} viewBox="0 0 1200 200" preserveAspectRatio="none">
        <path d="M0 200 L0 132 L110 78 L230 136 L340 96 L470 150 L590 100 L700 146 L830 96 L960 144 L1080 100 L1200 150 L1200 200 Z" />
      </svg>

      {/* Market row behind the pines — desktop only so phones stay simple. */}
      <svg className={styles.village} viewBox="0 0 1200 120" preserveAspectRatio="none">
        <g className={styles.villageBody}>
          {BOOTHS.map(([x, w, h]) => (
            <Booth key={x} x={x} w={w} h={h} />
          ))}
          {/* church */}
          <rect x="418" y="86" width="42" height="34" rx="2" />
          <path d="M412 87 L439 70 L466 87 Z" />
          <rect x="433" y="42" width="12" height="46" rx="2" />
          <path d="M430 43 L439 24 L448 43 Z" />
          {/* ferris wheel frame */}
          <path d="M958 120 L976 82 M994 120 L976 82" stroke="currentColor" strokeWidth="4" fill="none" />
        </g>
        <g className={styles.wheel}>
          <circle cx="976" cy="80" r="32" fill="none" stroke="currentColor" strokeWidth="3" />
          <path
            d="M976 48 V112 M944 80 H1008 M953 57 L999 103 M999 57 L953 103"
            stroke="currentColor"
            strokeWidth="2.4"
            fill="none"
          />
        </g>
        <g className={styles.villageLights}>
          {BOOTHS.filter((_, i) => i % 2 === 0).map(([x, w, h]) => (
            <rect key={x} x={x + w / 2 - 5} y={120 - h + 6} width="10" height="10" rx="2" />
          ))}
          <rect x="433" y="94" width="12" height="14" rx="2.5" />
        </g>
      </svg>

      <svg className={styles.pinesBack} viewBox="0 0 1200 160" preserveAspectRatio="none">
        <g className={styles.pineGroup}>
          {[40, 130, 210, 330, 430, 520, 660, 760, 880, 1000, 1090, 1160].map((x, i) => {
            const h = 78 + ((i * 17) % 44)
            return (
              <g key={x} transform={`translate(${x} 160)`}>
                <rect x="-4" y={-14} width="8" height="16" rx="2" fill="#123227" />
                <path d={`M0 ${-h} L${h * 0.3} -60 L${-h * 0.3} -60 Z`} fill="var(--pine-light)" />
                <path d={`M0 ${-h * 0.72} L${h * 0.38} -30 L${-h * 0.38} -30 Z`} fill="var(--pine)" />
                <path d={`M0 ${-h * 0.44} L${h * 0.46} -12 L${-h * 0.46} -12 Z`} fill="var(--pine)" />
              </g>
            )
          })}
        </g>
      </svg>

      <div className={styles.field}>
        <div className={styles.drift} />
        <div className={styles.driftTwo} />
      </div>

      {/* Two tiny groups strolling the snow — desktop only. */}
      <div className={styles.walkers}>
        <div className={styles.walkA}>
          <span className={styles.bob}>
            <svg viewBox="0 0 34 26" className={styles.walkerArt}>
              <g fill="currentColor" stroke="currentColor">
                <Walker />
                <g transform="translate(15 8)">
                  <Walker scale={0.66} />
                </g>
              </g>
            </svg>
          </span>
        </div>
        <div className={styles.walkB}>
          <span className={styles.bobSlow}>
            {/* someone pulling a small toboggan */}
            <svg viewBox="0 0 44 28" className={styles.walkerArt}>
              <g fill="currentColor" stroke="currentColor">
                <g transform="translate(28 0)">
                  <Walker />
                </g>
                <path d="M29 17 L17 21" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                <path d="M4 20 h13 v4 H4 Z" stroke="none" />
                <path d="M2 25 h17 M5 24 v-4 M16 24 v-4" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              </g>
            </svg>
          </span>
        </div>
      </div>
    </div>
  )
}
