import styles from './GiftBoxReady.module.css'

type Props = {
  label: string
  /** Shown on the little tag hanging from the ribbon. */
  tag?: string
}

/** Tracking state `ready` / `delivered`: the ornament is packed in a Christmas box. */
export function GiftBoxReady({ label, tag }: Props) {
  return (
    <div className={styles.wrap} role="img" aria-label={label}>
      <span className={styles.glow} aria-hidden="true" />

      <div className={styles.sparkles} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      <svg className={styles.art} viewBox="0 0 260 240" aria-hidden="true">
        <defs>
          <linearGradient id="awgBoxFront" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ef5d54" />
            <stop offset="1" stopColor="#b52f27" />
          </linearGradient>
          <linearGradient id="awgBoxLid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f77c72" />
            <stop offset="1" stopColor="#d13f36" />
          </linearGradient>
        </defs>

        <ellipse cx="130" cy="214" rx="82" ry="12" fill="#c3d9ee" opacity="0.65" />

        <g className={styles.box}>
          <rect x="54" y="96" width="152" height="112" rx="10" fill="url(#awgBoxFront)" />
          <rect x="54" y="96" width="152" height="112" rx="10" fill="none" stroke="#8f231d" strokeWidth="3" />
          <rect x="116" y="96" width="28" height="112" fill="var(--gold)" />
          <path d="M54 140 h152" stroke="var(--gold)" strokeWidth="14" />
          <path d="M54 140 h152" stroke="var(--gold-deep)" strokeWidth="2" opacity="0.5" />

          <g className={styles.lid}>
            <rect x="42" y="70" width="176" height="34" rx="9" fill="url(#awgBoxLid)" />
            <rect x="42" y="70" width="176" height="34" rx="9" fill="none" stroke="#8f231d" strokeWidth="3" />
            <rect x="116" y="70" width="28" height="34" fill="var(--gold)" />

            <g className={styles.bow}>
              <path
                d="M130 66 q-28 -26 -44 -10 q-10 12 8 15 q16 3 36 -5 Z"
                fill="var(--gold)"
                stroke="var(--gold-deep)"
                strokeWidth="2.5"
              />
              <path
                d="M130 66 q28 -26 44 -10 q10 12 -8 15 q-16 3 -36 -5 Z"
                fill="var(--gold)"
                stroke="var(--gold-deep)"
                strokeWidth="2.5"
              />
              <path d="M124 70 l-12 16 M136 70 l12 16" stroke="var(--gold-deep)" strokeWidth="4" strokeLinecap="round" />
              <circle cx="130" cy="64" r="9" fill="#ffe4a0" stroke="var(--gold-deep)" strokeWidth="2.5" />
            </g>
          </g>

          <g className={styles.tag}>
            <path d="M188 150 q12 6 14 18" stroke="#f0d9a6" strokeWidth="3" fill="none" />
            <g className={styles.tagCard}>
              <rect x="186" y="166" width="46" height="30" rx="6" fill="#fff8e6" stroke="#d9c49a" strokeWidth="2.5" />
              <circle cx="192" cy="172" r="2.4" fill="#c9b07e" />
              <path d="M196 180 h28 M196 188 h20" stroke="#c2a97d" strokeWidth="3" strokeLinecap="round" />
            </g>
          </g>

        </g>

        <g className={styles.check}>
          <circle cx="212" cy="112" r="22" fill="var(--green-bright)" stroke="#fff" strokeWidth="4" />
          <path
            d="M202 112 l7 8 l14 -16"
            stroke="#fff"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>

      {tag ? <p className={styles.caption}>{tag}</p> : null}
    </div>
  )
}
