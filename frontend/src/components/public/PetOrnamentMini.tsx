import { CatFace, DogFace } from './PetFaces'
import styles from './PetOrnamentMini.module.css'

/**
 * Small ornament for the /buy product card: the same cat and dog portraits as the loaders,
 * crossfading so customers see that both kinds of pets are painted. Decorative.
 */
export function PetOrnamentMini({ className }: { className?: string }) {
  return (
    <svg className={`${styles.art} ${className ?? ''}`} viewBox="0 0 80 96" aria-hidden="true">
      <defs>
        <clipPath id="pet-ornament-mini-ball">
          <circle cx="40" cy="56" r="36" />
        </clipPath>
      </defs>
      <g className={styles.sway}>
        <path d="M34 9a6 6 0 0 1 12 0" fill="none" stroke="#b89a56" strokeWidth="2.5" />
        <rect x="31" y="9" width="18" height="11" rx="2" fill="#d2b66f" />
        <g clipPath="url(#pet-ornament-mini-ball)">
          <g transform="translate(4 20) scale(0.72)">
            <CatFace className={styles.cat} />
            <DogFace className={styles.dog} />
          </g>
        </g>
        <circle cx="40" cy="56" r="36" fill="none" stroke="#bca980" strokeWidth="2" />
        <path d="M18 44c3-10 10-16 19-18" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="3.5" strokeLinecap="round" />
      </g>
    </svg>
  )
}
