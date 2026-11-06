import { CatFace, DogFace } from './PetFaces'
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
              <CatFace className={styles.cat} />
              <DogFace className={styles.dog} />
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
