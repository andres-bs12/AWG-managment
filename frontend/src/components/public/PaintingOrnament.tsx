import styles from './PaintingOrnament.module.css'

type Props = {
  label: string
}

/** Tracking state `preparing`: a bare ornament in the middle being painted by a brush. */
export function PaintingOrnament({ label }: Props) {
  return (
    <div className={styles.wrap} role="img" aria-label={label}>
      <span className={styles.glow} aria-hidden="true" />

      <div className={styles.ornament} aria-hidden="true">
        <span className={styles.hook} />
        <span className={styles.cap} />
        <div className={styles.ball}>
          <div className={styles.paint}>
            <svg viewBox="0 0 100 100" className={styles.pattern} aria-hidden="true">
              <circle cx="50" cy="50" r="50" fill="var(--berry)" />
              <path d="M0 62 q12 -9 25 0 q13 9 25 0 q12 -9 25 0 q13 9 25 0 V76 H0 Z" fill="var(--gold)" />
              <path d="M0 76 q12 -8 25 0 q13 8 25 0 q12 -8 25 0 q13 8 25 0 V100 H0 Z" fill="var(--green)" />
              <g fill="#fff6e2">
                <circle cx="22" cy="26" r="2.6" />
                <circle cx="76" cy="22" r="2" />
                <circle cx="62" cy="14" r="1.6" />
                <circle cx="34" cy="14" r="1.6" />
              </g>
              <g fill="#fff6e2">
                <ellipse cx="50" cy="44" rx="9" ry="7.5" />
                <ellipse cx="39" cy="33" rx="4" ry="5" />
                <ellipse cx="47" cy="29" rx="4" ry="5.4" />
                <ellipse cx="56" cy="30" rx="4" ry="5.2" />
                <ellipse cx="63" cy="35" rx="3.6" ry="4.6" />
              </g>
            </svg>
          </div>
          <span className={styles.gloss} />
        </div>
      </div>

      {/*
        Deliberately a short, chunky brush: a long handle cannot follow the paint line up to the
        crown of the ball without its end leaving the illustration box.
      */}
      <div className={styles.brush} aria-hidden="true">
        <svg viewBox="0 0 40 80" className={styles.brushArt}>
          <rect x="15" y="0" width="10" height="42" rx="5" fill="#b9762f" />
          <rect x="15" y="0" width="10" height="14" rx="5" fill="#d79c52" />
          <path d="M12 40 h16 l3 12 H9 Z" fill="#cfd8e2" />
          <path d="M9 51 h22 l-5 22 q-6 8 -12 0 Z" fill="var(--berry)" />
          <path d="M16 68 q4 7 6 0" fill="var(--berry-deep)" />
        </svg>
      </div>

      <div className={styles.palette} aria-hidden="true">
        <svg viewBox="0 0 120 84" className={styles.paletteArt}>
          <path
            d="M18 8 q44 -12 78 12 q22 20 2 44 q-18 22 -48 16 q-30 -6 -40 -28 q-10 -24 8 -44 Z"
            fill="#e6d6be"
            stroke="#c9b394"
            strokeWidth="3"
          />
          <circle cx="86" cy="52" r="9" fill="#efe3cf" />
          <circle cx="34" cy="26" r="7" fill="var(--berry)" />
          <circle cx="54" cy="20" r="7" fill="var(--gold)" />
          <circle cx="74" cy="26" r="7" fill="var(--green-bright)" />
          <circle cx="34" cy="48" r="7" fill="var(--gift-blue)" />
          <circle cx="52" cy="54" r="7" fill="#f7fbff" />
        </svg>
      </div>

      <div className={styles.splatter} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}
