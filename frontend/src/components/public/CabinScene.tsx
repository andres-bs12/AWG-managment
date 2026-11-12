import { Painter, SittingCat, SittingDog } from './FlatFolk'
import styles from './CabinScene.module.css'

type Props = {
  title: string
}

const BUNTING = ['var(--berry)', 'var(--gold)', 'var(--green-bright)', 'var(--gift-blue)', 'var(--berry)', 'var(--gold)']

/** Sampled off the two garland swags so every bulb hangs on the cord, not under the stall. */
const COUNTER_BULBS = [
  { x: 106.5, y: 295.5, hue: '#e0473f' },
  { x: 141, y: 300, hue: '#ffd166' },
  { x: 175.5, y: 297.5, hue: '#2fae6a' },
  { x: 210, y: 289, hue: '#4a7ab5' },
  { x: 244.5, y: 297.5, hue: '#e0473f' },
  { x: 279, y: 300, hue: '#ffd166' },
  { x: 313.5, y: 295.5, hue: '#2fae6a' },
]

const TOP_SHELF = [
  { x: 128, body: '#e0473f', shine: '#ffb9b3' },
  { x: 168, body: '#2fae6a', shine: '#b6f0ce' },
  { x: 208, body: '#4a7ab5', shine: '#c3ddf6' },
  { x: 248, body: '#ffd166', shine: '#fff3d0' },
  { x: 288, body: '#e0473f', shine: '#ffb9b3' },
]

export function CabinScene({ title }: Props) {
  return (
    <div className={styles.wrap}>
      <svg className={styles.svg} viewBox="0 0 420 332" role="img" aria-label={title}>
        {/* flat snow ledge: straight full-width bottom edge at y=332, gently rounded top */}
        <path d="M-10 332 V322 Q40 314 120 316 Q210 318 300 316 Q380 314 430 322 V332 Z" fill="#f2f8ff" />
        {/* flat contact shadow right under the stall */}
        <ellipse cx="210" cy="325" rx="150" ry="3.5" fill="#c9daef" />

        {/* layered fir with snow on each tier, and a smaller one tucked behind it */}
        <g className={styles.pineLeft}>
          <rect x="29" y="292" width="7" height="32" rx="2" fill="#5b3a22" />
          <path d="M32 204 L52 238 L12 238 Z" fill="var(--pine-light)" />
          <path d="M32 224 L58 264 L6 264 Z" fill="var(--pine)" />
          <path d="M32 248 L64 294 L0 294 Z" fill="#1a4237" />
          <path d="M32 204 L41 219 L23 219 Z M14 236 Q32 230 50 236 Q32 242 14 236 Z M9 262 Q32 254 55 262 Q32 268 9 262 Z" fill="#eaf4ff" />
          <circle cx="24" cy="252" r="2.6" fill="var(--berry)" />
          <circle cx="42" cy="276" r="2.6" fill="var(--gold)" />
          <circle cx="20" cy="282" r="2.2" fill="var(--gift-blue)" />
        </g>
        {/*
          Chimney steam. It leaves the mouth at y=44, right behind the chimney's snow lip, and is
          drawn before the cabin so the lip hides where each puff is born.
        */}
        <g className={styles.smoke} aria-hidden="true">
          <circle className={styles.puff1} cx="290" cy="44" r="5" fill="#ffffff" />
          <circle className={styles.puff2} cx="293" cy="44" r="4.2" fill="#ffffff" />
          <circle className={styles.puff3} cx="288" cy="44" r="6" fill="#ffffff" />
          <circle className={styles.puff4} cx="292" cy="44" r="4.6" fill="#ffffff" />
        </g>

        <g className={styles.cabin}>
          {/* chimney: base is tucked under the roof slope, top clears it well */}
          <rect x="274" y="54" width="34" height="62" rx="3" fill="#8b4a22" />
          <rect x="270" y="54" width="42" height="12" rx="4" fill="#71391a" />
          {/* snow hat inset into the chimney lip, so it cannot read as a loose pill */}
          <rect x="274" y="46" width="34" height="13" rx="6" fill="#f7fbff" />

          {/* gable wall + roof */}
          <path d="M210 62 L354 156 L66 156 Z" fill="#a8601f" />
          <g stroke="#7d4419" strokeWidth="2" opacity="0.35">
            <path d="M120 130 H300 M150 108 H270" />
          </g>
          <path
            d="M38 162 L210 46 L382 162"
            fill="none"
            stroke="#6e3813"
            strokeWidth="19"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* roof snow: one connected shape — the two short fat strokes are drifts, not loose circles */}
          <g fill="none" stroke="#f7fbff" strokeLinejoin="round" strokeLinecap="round">
            <path d="M38 149 L210 33 L382 149" strokeWidth="17" />
            <path d="M92 113 L122 93" strokeWidth="26" />
            <path d="M318 105 L346 124" strokeWidth="24" />
            <path d="M196 39 L224 39" strokeWidth="22" />
          </g>

          <g className={styles.star}>
            <circle cx="210" cy="112" r="24" fill="rgba(255, 209, 102, 0.22)" />
            <path
              d="M210 90 L217 107 L235 108 L221 119 L226 137 L210 127 L194 137 L199 119 L185 108 L203 107 Z"
              fill="var(--gold)"
              stroke="var(--gold-deep)"
              strokeWidth="2"
            />
          </g>

          {/* side walls */}
          <rect x="62" y="156" width="296" height="152" rx="5" fill="#b86f30" />
          <rect x="62" y="156" width="26" height="152" fill="#9a581f" />
          <rect x="332" y="156" width="26" height="152" fill="#9a581f" />
          <g stroke="#8d4c1b" strokeWidth="2" opacity="0.3">
            <path d="M62 196 H358 M62 236 H358 M62 276 H358" />
          </g>

          {/* head beam over the opening */}
          <rect x="74" y="156" width="272" height="18" rx="4" fill="#7d4419" />

          {/* opening */}
          <path d="M92 174 H328 V276 H92 Z" fill="#3c2213" />
          <path d="M92 174 H328 V240 H92 Z" fill="#58361c" />
          <path className={styles.lampGlow} d="M92 174 H328 V276 H92 Z" fill="#ffc878" fillOpacity="0.26" />

          {/* shelves with painted ornaments */}
          <g>
            <rect x="104" y="230" width="212" height="6" rx="3" fill="#7a4a23" />
            {TOP_SHELF.map((orn, i) => (
              <g key={orn.x} className={styles[`orn${(i % 3) + 1}` as 'orn1' | 'orn2' | 'orn3']}>
                <rect x={orn.x - 2.5} y="204" width="5" height="6" rx="1.5" fill="#d2dae2" />
                <circle cx={orn.x} cy="219" r="11" fill={orn.body} />
                <circle cx={orn.x - 3.5} cy="215" r="3.4" fill={orn.shine} opacity="0.9" />
              </g>
            ))}
            <rect x="104" y="266" width="212" height="6" rx="3" fill="#7a4a23" />
            <g>
              <rect x="152" y="250" width="26" height="16" rx="4" fill="var(--gift-blue)" />
              <rect x="162" y="250" width="6" height="16" fill="#f7fbff" />
              <circle cx="206" cy="256" r="10" fill="#2fae6a" />
              <circle cx="203" cy="252" r="3" fill="#b6f0ce" />
              <rect x="232" y="244" width="34" height="22" rx="4" fill="var(--gold)" />
              <rect x="246" y="244" width="6" height="22" fill="#fff6e2" />
              <circle cx="292" cy="256" r="10" fill="#4a7ab5" />
              <circle cx="289" cy="252" r="3" fill="#c3ddf6" />
            </g>
          </g>

          {/* bunting under the beam */}
          <g className={styles.bunting}>
            <path d="M96 178 Q210 196 324 178" fill="none" stroke="#4a2a14" strokeWidth="2.5" />
            {BUNTING.map((color, i) => {
              const x = 116 + i * 38
              const dip = Math.round(Math.sin((i / (BUNTING.length - 1)) * Math.PI) * 9)
              const y = 180 + dip
              return <polygon key={color + i} points={`${x - 13},${y} ${x + 13},${y} ${x},${y + 20}`} fill={color} />
            })}
          </g>

          {/* hanging lantern inside */}
          <g className={styles.lantern}>
            <path d="M210 174 V196" stroke="#4a2a14" strokeWidth="2" />
            <path d="M203 196 h14 l3 6 v13 l-3 5 h-14 l-3 -5 v-13 Z" fill="#7e4a20" />
            <rect x="204" y="200" width="12" height="12" rx="2" fill="#ffe3a0" />
          </g>

          {/* counter + apron */}
          <rect x="52" y="276" width="316" height="20" rx="7" fill="#e2a964" />
          <rect x="52" y="276" width="316" height="6" rx="3" fill="#f0c98f" />
          <path d="M70 296 H350 V324 H70 Z" fill="#a45f27" />
          <g stroke="#8b4a22" strokeWidth="2" opacity="0.55">
            <path d="M112 298 V322 M154 298 V322 M196 298 V322 M238 298 V322 M280 298 V322 M322 298 V322" />
          </g>

          {/* garland: two swags that stay on the counter apron */}
          <path
            d="M72 284 Q141 314 210 288 Q279 314 348 284"
            fill="none"
            stroke="var(--green-deep)"
            strokeWidth="11"
            strokeLinecap="round"
          />
          <path
            d="M72 284 Q141 314 210 288 Q279 314 348 284"
            fill="none"
            stroke="var(--pine-light)"
            strokeWidth="5"
            strokeLinecap="round"
            opacity="0.75"
          />
          <g className={styles.bulbs}>
            {COUNTER_BULBS.map((bulb) => (
              <circle
                key={bulb.x}
                className={styles.bulb}
                cx={bulb.x}
                cy={bulb.y}
                r="4.5"
                fill="currentColor"
                style={{ color: bulb.hue }}
              />
            ))}
          </g>

          {/* wreath on the left post */}
          <g className={styles.wreath}>
            <circle cx="78" cy="212" r="13" fill="none" stroke="var(--green-deep)" strokeWidth="8" />
            <circle cx="78" cy="212" r="13" fill="none" stroke="var(--pine-light)" strokeWidth="3.5" opacity="0.85" />
            <circle cx="70" cy="205" r="3.2" fill="var(--berry)" />
            <circle cx="86" cy="219" r="3.2" fill="var(--berry)" />
            <path d="M78 198 l-8 -9 l8 4 l8 -4 Z" fill="var(--berry)" />
          </g>

          {/* brush jar on the counter */}
          <g className={styles.brushJar}>
            <path d="M296 276 h24 l-4 -16 h-16 Z" fill="#cfe0f2" />
            <path d="M304 262 v-20" stroke="#c47a3a" strokeWidth="3" strokeLinecap="round" />
            <path d="M304 244 v-7" stroke="var(--berry)" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M314 262 v-25" stroke="#8b5a2b" strokeWidth="3" strokeLinecap="round" />
            <path d="M314 240 v-7" stroke="var(--gift-blue)" strokeWidth="4.5" strokeLinecap="round" />
          </g>
        </g>

        <g className={styles.gifts}>
          <g>
            <rect x="44" y="296" width="36" height="28" rx="4" fill="var(--berry)" />
            <rect x="58" y="296" width="8" height="28" fill="var(--gold)" />
            <rect x="44" y="306" width="36" height="7" fill="var(--gold)" />
            <path d="M62 296 l-6 -8 l6 3 l6 -3 Z" fill="var(--gold)" />
          </g>
        </g>

        {/* What the stall is about: the cat on the counter, the dog in front, Gaby painting an ornament. */}
        <SittingCat x={96} y={236} width={40} height={40} />
        <SittingDog x={84} y={281} width={46} height={46} />
        <Painter x={350} y={248} width={69} height={79} />
      </svg>
    </div>
  )
}
