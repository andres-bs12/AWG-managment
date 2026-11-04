/**
 * The cat and dog portraits painted on our ornaments, drawn in a 100x100 box. Shared by the
 * tracking "painting" ornament and the opening curtain so both show the same pets.
 */
type FaceProps = { className?: string }

export function CatFace({ className }: FaceProps) {
  return (
    <g className={className}>
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
  )
}

export function DogFace({ className }: FaceProps) {
  return (
    <g className={className}>
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
  )
}
