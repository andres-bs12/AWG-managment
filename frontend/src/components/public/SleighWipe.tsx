import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import styles from './SleighWipe.module.css'

type Props = {
  label: string
  /** Plays the exit animation instead of holding the loading loop. */
  leaving?: boolean
}

type DeerProps = {
  x: number
  shade: string
  light: string
  /** Flips which leg pair leads, so the two animals do not gallop in lockstep. */
  lead?: boolean
}

/** Hooves land on y=152 whatever the scale, so the whole team runs on one line. */
const DEER_SCALE = 1.14
const DEER_Y = 152 - 152 * DEER_SCALE

function Reindeer({ x, shade, light, lead = false }: DeerProps) {
  const front = lead ? styles.legsA : styles.legsB
  const rear = lead ? styles.legsB : styles.legsA

  return (
    <g transform={`translate(${x} ${DEER_Y.toFixed(1)}) scale(${DEER_SCALE})`}>
      <g className={rear} stroke={shade} strokeWidth="7" strokeLinecap="round" fill="none">
        <path d="M-16 114 L-23 138 L-29 152" />
        <path d="M-8 116 L-6 140 L-1 153" />
      </g>

      <ellipse cx="0" cy="116" rx="28" ry="16" fill={shade} />
      <path d="M-26 104 q-9 -5 -11 3 q6 5 12 3 Z" fill={light} />
      <ellipse cx="-4" cy="122" rx="18" ry="8" fill={light} opacity="0.35" />

      <g className={front} stroke={shade} strokeWidth="7" strokeLinecap="round" fill="none">
        <path d="M14 114 L11 138 L5 152" />
        <path d="M22 112 L29 136 L35 150" />
      </g>

      <path d="M13 110 Q21 96 31 83 L48 91 Q39 104 29 122 Z" fill={shade} />
      <ellipse cx="50" cy="84" rx="15" ry="10" fill={shade} transform="rotate(-12 50 84)" />
      <ellipse cx="62" cy="89" rx="7.5" ry="5.5" fill={light} />
      <circle cx="67.5" cy="89" r="3.8" fill="var(--berry)" />
      <circle cx="50" cy="79" r="2.1" fill="#2a1a10" />
      <ellipse cx="40" cy="72" rx="5.4" ry="3.4" fill={light} transform="rotate(-32 40 72)" />
      <path
        d="M44 69 L38 53 M38 53 L28 49 M38 53 L39 42 M54 67 L60 51 M60 51 L70 47 M60 51 L63 40"
        stroke="#6b4423"
        strokeWidth="3.6"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M22 92 q11 7 15 17" stroke="#f0c46a" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <circle cx="30" cy="105" r="3.4" fill="var(--gold)" />
    </g>
  )
}

export function SleighWipe({ label, leaving = false }: Props) {
  const streaks = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        top: `${6 + ((i * 13) % 88)}%`,
        width: `${18 + ((i * 11) % 46)}%`,
        delay: `${((i * 0.19) % 1.6).toFixed(2)}s`,
        duration: `${(1.1 + ((i * 0.13) % 0.9)).toFixed(2)}s`,
        opacity: 0.18 + ((i % 4) * 0.12),
      })),
    [],
  )

  return createPortal(
    <div className={`${styles.wipe} ${leaving ? styles.leaving : ''}`} role="status" aria-live="polite">
      <div className={styles.fillBack} aria-hidden="true" />
      <div className={styles.fillFront} aria-hidden="true" />

      <div className={styles.streaks} aria-hidden="true">
        {streaks.map((streak) => (
          <span
            key={streak.id}
            className={styles.streak}
            style={{
              top: streak.top,
              width: streak.width,
              opacity: streak.opacity,
              animationDelay: streak.delay,
              animationDuration: streak.duration,
            }}
          />
        ))}
      </div>

      <div className={styles.stage}>
        <div className={styles.sleighHolder}>
          <svg className={styles.sleigh} viewBox="0 0 460 200" role="presentation">
            <defs>
              <linearGradient id="awgSleighBody" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ef5d54" />
                <stop offset="1" stopColor="#b52f27" />
              </linearGradient>
            </defs>

            <g className={styles.rig}>
              <g className={styles.dust} opacity="0.8">
                <circle cx="28" cy="152" r="7" fill="#d9f7e4" />
                <circle cx="8" cy="140" r="4.6" fill="#b6ecca" />
                <circle cx="20" cy="124" r="3.4" fill="#eafff2" />
              </g>

              {/* runners first, so the body sits on them */}
              <g stroke="#f0c46a" strokeWidth="7" strokeLinecap="round" fill="none">
                <path d="M44 160 H178 Q200 160 204 142" />
                <path d="M46 160 Q30 157 33 142" />
              </g>

              {/* rear panel of the sleigh — everything in the sleigh is drawn in front of it */}
              <path d="M52 156 V124 Q52 100 80 98 Q99 97 103 115 V156 Z" fill="#a5291f" />

              <g className={styles.cargo}>
                <rect x="58" y="92" width="36" height="34" rx="5" fill="var(--gold)" />
                <rect x="72" y="92" width="8" height="34" fill="#fff8e6" />
                <rect x="58" y="104" width="36" height="7" fill="#fff8e6" />
                <rect x="70" y="70" width="28" height="24" rx="5" fill="#4a7ab5" />
                <rect x="80" y="70" width="7" height="24" fill="#fff8e6" />
              </g>

              <g className={styles.santa}>
                {/* rein hand, reaching forward */}
                <path d="M150 112 Q168 113 181 122" stroke="var(--berry)" strokeWidth="11" strokeLinecap="round" fill="none" />
                <circle cx="183" cy="123" r="6.5" fill="#f6f9ff" />

                <path
                  d="M110 140 Q105 106 131 100 Q155 96 159 126 L161 140 Z"
                  fill="var(--berry)"
                  stroke="var(--berry-deep)"
                  strokeWidth="2.5"
                />
                <path d="M110 120 H160" stroke="#2b2b33" strokeWidth="10" />
                <rect x="129" y="114" width="12" height="12" rx="2.5" fill="var(--gold)" />

                <circle cx="137" cy="87" r="12.5" fill="#f2c39c" />
                <circle cx="132" cy="84" r="1.9" fill="#2a1a10" />
                <circle cx="143" cy="84" r="1.9" fill="#2a1a10" />
                <circle cx="138" cy="91" r="2.4" fill="#e08a78" />
                <path d="M120 98 Q137 91 153 98 Q156 118 137 122 Q118 118 120 98 Z" fill="#fbfdff" />

                <path d="M123 79 Q124 59 141 59 Q157 59 159 77 Z" fill="var(--berry)" />
                {/* the tassel trails backwards, which also sells the speed */}
                <path d="M133 60 Q114 55 106 65" stroke="var(--berry)" strokeWidth="9" strokeLinecap="round" fill="none" />
                <circle cx="103" cy="68" r="6" fill="#fbfdff" />
                <rect x="118" y="74" width="46" height="9" rx="4.5" fill="#fbfdff" />

                {/*
                  Waving arm, drawn as upper arm + forearm + fur cuff + mitten with a thumb.
                  A single arcing stroke read as a red hook over his head, which is why the joint
                  and the thumb are explicit here — they are what makes it a hand.
                */}
                <g className={styles.wave}>
                  <path
                    d="M154 108 L170 92"
                    stroke="var(--berry)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    d="M170 92 L178 74"
                    stroke="var(--berry)"
                    strokeWidth="11"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    d="M173 66 Q168 54 174 45 Q181 38 188 44 Q194 51 191 61 Q188 68 181 68 Z"
                    fill="var(--berry)"
                    stroke="var(--berry-deep)"
                    strokeWidth="2.2"
                  />
                  <path
                    d="M174 60 Q166 58 166 52 Q167 46 172 50 Q174 54 175 59 Z"
                    fill="var(--berry)"
                    stroke="var(--berry-deep)"
                    strokeWidth="2.2"
                  />
                  <path d="M180 50 Q184 55 181 61" stroke="var(--berry-deep)" strokeWidth="1.8" fill="none" />
                  <path d="M170 68 L185 72" stroke="#fbfdff" strokeWidth="10" strokeLinecap="round" fill="none" />
                </g>
              </g>

              {/* near wall of the sleigh, in front of Santa's lap */}
              <path d="M48 156 V134 Q48 126 60 126 H172 Q195 126 197 148 V156 Z" fill="url(#awgSleighBody)" />
              <path d="M52 132 H170" stroke="#f0c46a" strokeWidth="4" strokeLinecap="round" />

              <g className={styles.deerBack}>
                <Reindeer x={266} shade="#8f5b32" light="#c08553" lead />
              </g>
              <g className={styles.deerFront}>
                <Reindeer x={356} shade="#a1663a" light="#cf9964" />
              </g>

              {/* two traces, each ending on a collar rather than in mid-air */}
              <g className={styles.reins} stroke="#f5d68a" strokeWidth="3.2" fill="none" strokeLinecap="round">
                <path d="M184 116 Q240 86 296 96" />
                <path d="M302 94 Q344 78 386 94" />
              </g>
            </g>
          </svg>
        </div>

        <p className={styles.copy}>{label}</p>
        <div className={styles.dots} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>

      <svg className={styles.groundSnow} viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M0 120 L0 62 q150 -30 300 -8 q150 22 300 -4 q150 -26 300 2 q120 22 300 -2 L1200 120 Z"
          fill="#eafff2"
          opacity="0.2"
        />
      </svg>
    </div>,
    document.body,
  )
}
