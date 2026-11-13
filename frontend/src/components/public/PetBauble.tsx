import { useId } from 'react'
import { CatFace, DogFace } from './PetFaces'
// The bauble artwork is shared with the opening curtain; .bauble carries its svg sizing and shadow.
import curtain from './IntroCurtain.module.css'

/**
 * A painted bauble hanging on its thread, with one of our pet portraits on the ball.
 * The clipPath id is unique per instance, because the curtain and a loader can be on screen together.
 */
export function PetBauble({ pet, className }: { pet: 'cat' | 'dog'; className: string }) {
  const clip = `awgBauble-${useId().replace(/:/g, '')}`
  return (
    <div className={className}>
      <svg className={curtain.bauble} viewBox="0 0 120 138" aria-hidden="true">
        <defs>
          <clipPath id={clip}>
            <circle cx="60" cy="78" r="56" />
          </clipPath>
        </defs>
        <path d="M54 4 Q60 -2 66 4" stroke="#d8e0e6" strokeWidth="3" fill="none" />
        <rect x="47" y="6" width="26" height="18" rx="4" fill="#ffd166" />
        <rect x="47" y="18" width="26" height="6" fill="#e0a83c" />
        <g clipPath={`url(#${clip})`}>
          <g transform="translate(4 22) scale(1.12)">{pet === 'cat' ? <CatFace /> : <DogFace />}</g>
        </g>
        <circle cx="60" cy="78" r="56" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
        <ellipse cx="38" cy="50" rx="10" ry="16" fill="#ffffff" opacity="0.35" transform="rotate(30 38 50)" />
      </svg>
    </div>
  )
}
