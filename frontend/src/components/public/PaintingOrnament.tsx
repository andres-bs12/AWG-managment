import styles from './PaintingOrnament.module.css'

type Props = {
  label: string
}

/** Tracking state `preparing`: alternating illustrated pet portraits revealed by a brush. */
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
              <g className={styles.cat}>
                <circle cx="50" cy="50" r="50" fill="#7cae98" />
                <circle cx="50" cy="52" r="40" fill="#fff4df" stroke="#d9e7cd" strokeWidth="2" />
                <path d="M26 45 L25 24 Q26 20 30 24 L41 33 Q50 29 59 33 L71 24 Q75 21 75 26 L74 46 Q82 72 61 79 Q49 84 36 78 Q19 70 26 45Z" fill="#e3a25c" />
                <path d="M29 38 L29 28 L38 35 M63 35 L71 28 L71 39" fill="#eab1a0" />
                <path d="M48 33 Q41 45 44 53 Q33 50 29 60 Q26 73 42 78 Q57 85 70 72 Q78 59 62 53 Q54 52 53 33Z" fill="#fff7e9" />
                <g fill="none" stroke="#b87539" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M37 36 l3 6 M43 33 l2 6 M59 35 l-2 6 M28 49 l6 2 M27 56 l6 1 M72 49 l-6 2 M73 56 l-6 1" />
                </g>
                <g fill="none" stroke="#62483a" strokeWidth="2.3" strokeLinecap="round">
                  <path d="M34 53 q4 -5 8 0 M58 53 q4 -5 8 0 M50 63 v4 q-5 6 -10 1 M50 67 q5 6 10 1" />
                  <path d="M34 62 l-9 -2 M34 66 l-9 1 M66 62 l9 -2 M66 66 l9 1" strokeWidth="1.3" />
                </g>
                <path d="M46 59 Q50 57 54 59 Q54 61 50 64 Q46 61 46 59" fill="#d98c89" />
              </g>
              <g className={styles.dog}>
                <circle cx="50" cy="50" r="50" fill="#86afc7" />
                <circle cx="50" cy="52" r="40" fill="#fff4df" stroke="#d7e6ec" strokeWidth="2" />
                <path d="M33 34 Q23 28 19 42 L18 62 Q20 74 29 68 L38 46 M67 34 Q77 28 81 42 L82 62 Q80 74 71 68 L62 46" fill="#956548" />
                <path d="M29 48 Q29 30 50 30 Q71 30 71 48 L72 62 Q71 81 50 82 Q29 81 28 62Z" fill="#d9ac78" />
                <path d="M46 31 Q42 43 47 55 Q34 53 33 65 Q34 78 50 79 Q66 78 67 65 Q66 53 53 55 Q58 43 54 31Z" fill="#fff7e9" />
                <path d="M46 69 h8 v6 q-4 7 -8 0Z" fill="#df9894" />
                <g fill="none" stroke="#62483a" strokeWidth="2.3" strokeLinecap="round">
                  <path d="M34 52 q4 -5 8 0 M58 52 q4 -5 8 0 M50 63 v4 q-5 6 -10 1 M50 67 q5 6 10 1" />
                </g>
                <path d="M44 59 Q50 56 56 59 Q56 63 50 65 Q44 63 44 59" fill="#62483a" />
              </g>
              <g fill="#fff6e2">
                <path d="M17 22 l1.5 4.5 L23 28 l-4.5 1.5 L17 34 l-1.5 -4.5 L11 28 l4.5 -1.5Z M82 68 l1.5 4.5 L88 74 l-4.5 1.5 L82 80 l-1.5 -4.5 L76 74 l4.5 -1.5Z" />
                <circle cx="79" cy="24" r="2" />
                <circle cx="23" cy="77" r="1.5" />
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
          <path d="M16 6 Q16 1 20 1 Q24 1 24 6 L23 43 H17Z" fill="#916448" />
          <path d="M18 6 Q18 3 20 3 L20 39" fill="none" stroke="#c39a70" strokeWidth="2" strokeLinecap="round" />
          <path d="M17 34 h6 v9 h-6Z" fill="#70513e" />
          <path d="M14 41 h12 l2 13 H12Z" fill="#a3adb0" />
          <path d="M15 42 h4 l-1 11 h-5Z" fill="#e1e5df" />
          <path d="M14 44 h12 M13 51 h14" fill="none" stroke="#7f8f92" strokeWidth="1" />
          <path d="M12 54 H28 L26 67 Q24 74 20 77 Q15 74 13 67Z" fill="#c5a479" />
          <path d="M15 55 l2 14 M20 55 v16 M25 55 l-2 14" fill="none" stroke="#94734f" strokeWidth="1" strokeLinecap="round" />
          <path className={styles.brushPaint} d="M13 65 Q17 62 20 65 Q24 68 27 64 L26 68 Q24 74 20 77 Q15 74 13 65Z" />
          <path d="M16 67 q1 5 4 7" fill="none" stroke="#fff4df" strokeOpacity=".45" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>

      <div className={styles.palette} aria-hidden="true">
        <svg viewBox="0 0 120 84" className={styles.paletteArt}>
          {/* The thumb hole is cut out of the silhouette, not painted onto it. */}
          <path
            d="M13 29 C19 11 47 5 72 12 C96 18 109 32 105 45 C102 55 88 48 84 57 C80 66 70 77 49 77 C22 77 4 55 13 29Z M77 37 C74 41 75 46 80 47 C85 48 89 44 87 40 C85 36 80 34 77 37Z"
            fill="#b68d66"
            fillRule="evenodd"
            transform="translate(0 3)"
          />
          <path
            d="M13 29 C19 11 47 5 72 12 C96 18 109 32 105 45 C102 55 88 48 84 57 C80 66 70 77 49 77 C22 77 4 55 13 29Z M77 37 C74 41 75 46 80 47 C85 48 89 44 87 40 C85 36 80 34 77 37Z"
            fill="#ead4b4"
            fillRule="evenodd"
          />
          <path d="M18 29 C25 14 48 11 68 16 M19 55 Q28 70 48 71 M46 60 Q57 65 69 59" fill="none" stroke="#f8e9d1" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M34 57 Q45 62 53 59 M43 66 l13 1" fill="none" stroke="#c7a57f" strokeOpacity=".5" strokeWidth="1" strokeLinecap="round" />
          <path d="M24 29 C23 23 31 20 35 24 C41 28 37 35 31 35 C27 36 23 33 24 29Z" fill="#cb9180" />
          <path d="M44 22 C46 16 54 18 56 23 C59 29 52 33 47 30 C43 28 42 25 44 22Z" fill="#dfb46e" />
          <path d="M65 24 C68 20 76 23 77 28 C79 34 72 37 67 34 C63 32 62 28 65 24Z" fill="#7cae98" />
          <path d="M21 45 C21 40 28 38 33 42 C39 46 34 52 29 53 C23 54 19 50 21 45Z" fill="#86afc7" />
          <path d="M42 45 C45 40 53 42 55 47 C58 53 52 57 46 55 C40 54 39 49 42 45Z" fill="#fff7e9" />
          <g fill="none" stroke="#fffaf0" strokeOpacity=".55" strokeWidth="1.6" strokeLinecap="round">
            <path d="M27 27 q3 -3 6 0 M47 22 q3 -2 5 1 M67 27 q3 -2 6 1 M24 44 q3 -2 6 0 M44 46 q3 -2 6 1" />
          </g>
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
