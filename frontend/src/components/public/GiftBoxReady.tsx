import styles from './GiftBoxReady.module.css'

type Props = {
  label: string
  tag?: string
}

/** A finished keepsake nestled in tissue paper, ready to take home. */
export function GiftBoxReady({ label, tag }: Props) {
  return (
    <div className={styles.wrap} role="img" aria-label={label}>
      <svg className={styles.art} viewBox="0 0 260 260" aria-hidden="true">
        <ellipse cx="130" cy="230" rx="76" ry="8" fill="#dce5e7" opacity=".55" />
        <path d="M57 139 Q130 119 205 139 L205 178 H57Z" fill="#c4ae8d" />
        <path d="M55 145 L48 117 L73 128 L84 111 L104 131 L130 117 L152 133 L180 114 L190 130 L212 118 L205 161Z" fill="#fff5e4" />

        <g className={styles.keepsake}>
          <path d="M124 52 v-6 a6 6 0 0 1 12 0 v6" fill="none" stroke="#c3a16b" strokeWidth="2.5" />
          <rect x="120" y="50" width="20" height="12" rx="3" fill="#dfc38b" />
          <path d="M124 52 v7 M130 52 v7 M136 52 v7" stroke="#f6e4b9" strokeWidth="1.5" />
          <circle cx="130" cy="112" r="53" fill="#7cae98" />
          <circle cx="130" cy="113" r="43" fill="#fff4df" stroke="#d9e7cd" strokeWidth="2" />
          <path d="M102 107 L103 85 Q103 82 107 85 L120 95 Q130 91 140 95 L153 85 Q157 82 157 87 L158 108 Q165 134 144 141 Q130 147 115 141 Q94 133 102 107Z" fill="#e3a25c" />
          <path d="M107 100 L107 90 L116 97 M144 97 L153 90 L153 101" fill="#eab1a0" />
          <path d="M128 95 Q121 109 125 115 Q107 110 105 125 Q104 141 130 143 Q155 141 156 126 Q155 112 137 115 Q132 103 133 95Z" fill="#fff7e9" />
          <path d="M114 98 l3 6 M120 95 l2 6 M144 99 l-3 6 M104 112 l6 2 M156 112 l-6 2" fill="none" stroke="#b87539" strokeWidth="2.5" strokeLinecap="round" />
          <g fill="none" stroke="#62483a" strokeWidth="2.3" strokeLinecap="round">
            <path d="M112 116 q4 -5 8 0 M140 116 q4 -5 8 0 M130 127 v4 q-5 6 -10 1 M130 131 q5 6 10 1" />
            <path d="M114 126 l-8 -2 M114 130 l-8 1 M146 126 l8 -2 M146 130 l8 1" strokeWidth="1.2" />
          </g>
          <path d="M126 123 Q130 121 134 123 Q134 125 130 128 Q126 125 126 123" fill="#d98c89" />
          <path d="M94 85 q7 -10 18 -13" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="4" strokeLinecap="round" />
        </g>

        <path d="M54 151 L72 143 L91 157 L110 147 L131 159 L157 147 L178 155 L198 143 L207 151 V173 H54Z" fill="#fffbf2" />
        <path d="M54 157 Q130 164 206 157 L199 214 Q198 222 189 222 H71 Q62 222 61 214Z" fill="#ead4b4" />
        <path d="M61 214 Q130 222 199 214 Q198 222 189 222 H71 Q63 222 61 214" fill="#d8bd98" />
        <path d="M54 157 Q130 164 206 157" fill="none" stroke="#f8e9d1" strokeWidth="4" strokeLinecap="round" />
        <path d="M120 162 H140 V222 H120Z" fill="#7cae98" />
        <path d="M124 164 v54" stroke="#a5c7ac" strokeWidth="2" />
        <g className={styles.bow} fill="#a5c7ac" stroke="#659780" strokeWidth="1.5" strokeLinejoin="round">
          <path d="M130 184 Q107 161 103 177 Q102 191 130 184Z M130 184 Q153 161 157 177 Q158 191 130 184Z" />
          <path d="M127 186 l-9 17 8 -3 4 4 3 -17 M133 186 l10 15 1 -7 6 1 -13 -12" />
          <ellipse cx="130" cy="184" rx="5" ry="6" fill="#7cae98" />
        </g>
        <g className={styles.sparkle} fill="#dfbd78">
          <path d="M63 48 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2Z" />
          <path d="M205 99 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2Z" />
        </g>
        <g className={styles.lateSparkle} fill="#dfbd78">
          <path d="M184 35 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2Z" />
          <circle cx="49" cy="102" r="2" />
        </g>
      </svg>
      {tag ? <p className={styles.caption}>{tag}</p> : null}
    </div>
  )
}
