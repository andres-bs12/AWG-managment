import styles from './MarketStall.module.css'

export function MarketStall() {
  return (
    <svg className={styles.root} viewBox="0 0 320 280" role="img" aria-label="Christmas market stall">
      <ellipse cx="160" cy="262" rx="118" ry="12" fill="#d9e6ef" />
      <rect x="48" y="118" width="224" height="118" rx="6" fill="#c47a3a" />
      <rect x="56" y="126" width="208" height="102" rx="4" fill="#a85f2c" />
      <path d="M36 118 L160 38 L284 118 Z" fill="#8b4a22" />
      <path className={styles.roofSnow} d="M40 118 C90 58 140 44 160 44 C180 44 230 58 280 118 L268 118 C220 72 180 60 160 60 C140 60 100 72 52 118 Z" fill="#f4f8fb" />
      <g className={styles.banner}>
        <path d="M72 102 L248 102" stroke="#4a2a14" strokeWidth="3" />
        <polygon points="80,102 92,118 104,102" fill="#c45c4a" />
        <polygon points="112,102 124,118 136,102" fill="#4a7ab5" />
        <polygon points="144,102 156,118 168,102" fill="#e8d36a" />
        <polygon points="176,102 188,118 200,102" fill="#c45c4a" />
        <polygon points="208,102 220,118 232,102" fill="#4a7ab5" />
      </g>
      <rect x="88" y="138" width="144" height="78" rx="4" fill="#6e3c1c" />
      <rect x="96" y="146" width="128" height="62" fill="#3e2414" />
      <rect x="108" y="158" width="28" height="28" rx="3" fill="#4a7ab5" />
      <rect x="146" y="154" width="32" height="32" rx="3" fill="#c45c4a" />
      <rect x="188" y="160" width="26" height="26" rx="3" fill="#e8d36a" />
      <g className={styles.wreath}>
        <circle cx="160" cy="168" r="16" fill="none" stroke="#3d8a4a" strokeWidth="7" />
        <circle cx="160" cy="152" r="3.5" fill="#c45c4a" />
      </g>
      <g className={styles.star}>
        <circle cx="118" cy="74" r="2.2" fill="#fff6c8" />
        <circle cx="214" cy="82" r="1.8" fill="#fff6c8" />
        <circle cx="96" cy="90" r="1.6" fill="#fff6c8" />
      </g>
      <rect x="38" y="198" width="28" height="32" rx="8" fill="#8b4a22" />
      <path d="M46 204 v18 M52 204 v18 M58 204 v18" stroke="#f4f8fb" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
