import styles from './FlatTown.module.css'

/**
 * Flat, Santa-Tracker-style town pieces for the public daytime scene. Each export is a standalone
 * inline SVG so the backdrop can place and scale it on its own; only `transform` and `opacity`
 * animate, and all motion is switched off under `prefers-reduced-motion` in the module CSS.
 */

type Props = { className?: string }

const WARM = '#2c4fa3'
const FAR_WIN = '#6f8fd0'
const SNOW = '#ffffff'
const SHADE = '#d9eef7'
const GLOW = [styles.glowA, styles.glowB, styles.glowC]
const TWINKLE = [styles.twinkleA, styles.twinkleB, styles.twinkleC]

/* ---------- shared plant shapes (ground at local y=0, centred on x=0) ---------- */

const FIR_TIERS = [
  { a: -60, b: -40, w: 13 },
  { a: -44, b: -22, w: 18 },
  { a: -28, b: -2, w: 22 },
] as const

type FirProps = { tones: readonly [string, string, string]; snow?: string; trunk?: string }

/** Three stacked tiers, bottom first so the upper ones overlap; each carries a snow tip. */
function FirShape({ tones, snow = SNOW, trunk = '#5a3a2a' }: FirProps) {
  return (
    <>
      <rect x="-3" y="-6" width="6" height="6" fill={trunk} />
      {[2, 1, 0].map((i) => {
        const { a, b, w } = FIR_TIERS[i]!
        const m = a + (b - a) * 0.45
        const sw = w * 0.45
        return (
          <g key={i}>
            <path d={`M0 ${a} L${w} ${b} Q0 ${b + 4} ${-w} ${b} Z`} fill={tones[i]} />
            <path
              d={`M0 ${a} L${sw} ${m} Q${sw / 2} ${m + 3} 0 ${m + 1} Q${-sw / 2} ${m + 3} ${-sw} ${m} Z`}
              fill={snow}
            />
          </g>
        )
      })}
    </>
  )
}

/** Three overlapping circles with a white blob on each crown. */
function BushShape({ tones, snow = SNOW }: { tones: readonly [string, string, string]; snow?: string }) {
  const balls = [
    { x: -11, y: -9, r: 9, c: tones[0] },
    { x: 11, y: -8, r: 8, c: tones[2] },
    { x: 0, y: -13, r: 11, c: tones[1] },
  ]
  return (
    <>
      {balls.map((b) => (
        <g key={b.x}>
          <circle cx={b.x} cy={b.y} r={b.r} fill={b.c} />
          <ellipse cx={b.x} cy={b.y - b.r * 0.55} rx={b.r * 0.7} ry={b.r * 0.4} fill={snow} />
        </g>
      ))}
    </>
  )
}

/** A stem with a small three-leaf fan, like the little plants in Santa Tracker. */
function SproutShape({ leaf = '#3fb5c4', vein = '#6fd0d8' }: { leaf?: string; vein?: string }) {
  return (
    <>
      <rect x="-0.8" y="-10" width="1.6" height="10" fill={leaf} />
      <ellipse cx="0" cy="-15" rx="2.6" ry="7" fill={leaf} transform="rotate(-38 0 -8)" />
      <ellipse cx="0" cy="-15" rx="2.6" ry="7" fill={leaf} transform="rotate(38 0 -8)" />
      <ellipse cx="0" cy="-15" rx="2.8" ry="7.4" fill={vein} />
    </>
  )
}

/* ---------- FarTown ---------- */

const WALLS = ['#9fdde3', '#c9eef0', '#f3e6a6', '#bfe7b0', '#e9f4fb', '#a9c9f2']
const ROOFS = ['#ffffff', '#ffffff', '#ffffff']

const FAR_HOUSES = [
  { x: 20, w: 50, h: 40, win: 2 },
  { x: 85, w: 60, h: 50, win: 3 },
  { x: 160, w: 40, h: 32, win: 1 },
  { x: 215, w: 70, h: 58, win: 3 },
  { x: 300, w: 44, h: 36, win: 1 },
  { x: 420, w: 64, h: 54, win: 2 },
  { x: 490, w: 40, h: 30, win: 1 },
  { x: 545, w: 56, h: 46, win: 2 },
  { x: 615, w: 78, h: 62, win: 3 },
  { x: 705, w: 36, h: 28, win: 1 },
  { x: 755, w: 62, h: 48, win: 2 },
  { x: 930, w: 52, h: 40, win: 2 },
  { x: 995, w: 70, h: 56, win: 3 },
  { x: 1075, w: 44, h: 34, win: 1 },
  { x: 1130, w: 56, h: 44, win: 2 },
]

const LOLLIPOPS = [
  { x: 152, h: 30 },
  { x: 207, h: 36 },
  { x: 352, h: 26 },
  { x: 537, h: 32 },
  { x: 604, h: 28 },
  { x: 748, h: 34 },
  { x: 920, h: 30 },
  { x: 988, h: 26 },
  { x: 1068, h: 32 },
]

function FarHouse({ x, w, h, win, i }: (typeof FAR_HOUSES)[number] & { i: number }) {
  const rh = Math.round(w * 0.34)
  const top = 120 - h
  const eave = top + rh
  const cx = x + w / 2
  const lx = cx + (x - 4 - cx) * 0.62
  const rx = cx + (x + w + 4 - cx) * 0.62
  const sy = top + rh * 0.62
  const wy = eave + Math.min(5, (h - rh) * 0.25)
  return (
    <g>
      <rect x={x} y={eave} width={w} height={120 - eave} fill={WALLS[i % WALLS.length]} />
      <polygon points={`${cx},${top} ${x + w + 4},${eave} ${x - 4},${eave}`} fill={ROOFS[i % 3]} />
      <path
        d={`M${cx} ${top - 1} L${lx} ${sy} Q${cx} ${top + rh * 0.95} ${rx} ${sy} Z`}
        fill={SHADE}
        stroke={SHADE}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <g className={GLOW[i % 3]} fill={FAR_WIN}>
        {Array.from({ length: win }, (_, k) => (
          <rect key={k} x={x + (w * (k + 1)) / (win + 1) - 2.5} y={wy} width="5" height="7" rx="1" />
        ))}
      </g>
    </g>
  )
}

export function FarTown({ className }: Props) {
  const wheel = [0, 1, 2, 3, 4, 5, 6, 7]
  return (
    <svg
      className={className}
      viewBox="0 0 1200 120"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      {/* ferris wheel: legs stay put, the rim and gondolas turn */}
      <path d="M865 66 L846 120 M865 66 L884 120" stroke="#7aa6e0" strokeWidth="3" strokeLinecap="round" />
      <g className={styles.wheel}>
        <circle cx="865" cy="66" r="30" fill="none" stroke="#8fb3e6" strokeWidth="2.5" />
        <path
          d="M835 66 H895 M865 36 V96 M844 45 L886 87 M886 45 L844 87"
          stroke="#8fb3e6"
          strokeWidth="1.4"
        />
        {wheel.map((k) => {
          const t = (k * Math.PI) / 4
          return (
            <circle
              key={k}
              cx={865 + 30 * Math.cos(t)}
              cy={66 + 30 * Math.sin(t)}
              r="3.2"
              fill={k % 2 ? '#f3e6a6' : '#a9c9f2'}
            />
          )
        })}
      </g>
      <circle cx="865" cy="66" r="4" fill="#8fb3e6" />

      {/* church: tower, spire and a low nave */}
      <rect x="388" y="92" width="26" height="28" fill="#a9c9f2" />
      <polygon points="386,92 401,80 416,92" fill="#ffffff" />
      <rect x="364" y="54" width="26" height="66" fill="#c9eef0" />
      <polygon points="361,54 377,26 393,54" fill="#8fb3e6" />
      <path d="M377 25 L371 40 Q377 43 383 40 Z" fill={SHADE} />
      <rect x="372" y="60" width="10" height="14" rx="5" fill={FAR_WIN} />
      <circle cx="377" cy="88" r="4.4" fill={FAR_WIN} className={styles.glowA} />

      {FAR_HOUSES.map((h, i) => (
        <FarHouse key={h.x} {...h} i={i} />
      ))}

      {LOLLIPOPS.map((t) => (
        <g key={t.x}>
          <rect x={t.x - 0.8} y={120 - t.h} width="1.6" height={t.h} fill="#7aa6e0" />
          <circle cx={t.x} cy={120 - t.h - 4} r="9" fill="#7fb4ee" />
          <circle cx={t.x - 2.5} cy={120 - t.h - 7} r="3.2" fill="#5f9fe8" />
        </g>
      ))}

      <rect x="0" y="115" width="1200" height="5" fill="#d9eef7" />
    </svg>
  )
}

/* ---------- TreeRow ---------- */

type Kind = 'fir' | 'bush' | 'pine' | 'sprout'

const ROW: readonly [number, Kind, number, number][] = [
  [24, 'fir', 0.9, 0],
  [78, 'bush', 1.1, 1],
  [130, 'pine', 0.85, 0],
  [188, 'fir', 1.05, 2],
  [240, 'sprout', 1.2, 0],
  [292, 'bush', 0.95, 2],
  [346, 'pine', 1.0, 0],
  [402, 'fir', 0.85, 1],
  [452, 'sprout', 1.0, 0],
  [506, 'bush', 1.15, 0],
  [562, 'fir', 1.0, 0],
  [616, 'pine', 0.9, 0],
  [668, 'sprout', 1.3, 0],
  [722, 'fir', 1.1, 2],
  [778, 'bush', 0.9, 1],
  [832, 'pine', 1.05, 0],
  [888, 'fir', 0.95, 1],
  [944, 'sprout', 1.1, 0],
  [996, 'bush', 1.05, 2],
  [1052, 'fir', 1.0, 0],
  [1108, 'pine', 0.9, 0],
  [1164, 'fir', 0.9, 2],
]

const ROW_TONES: readonly (readonly [string, string, string])[] = [
  ['#3d7fe0', '#4f8fe8', '#2f6fd6'],
  ['#2f6fd6', '#3d7fe0', '#4f8fe8'],
  ['#4f8fe8', '#2f6fd6', '#3d7fe0'],
]

function RowTree({ kind, v }: { kind: Kind; v: number }) {
  const tones = ROW_TONES[v % 3]!
  if (kind === 'fir') return <FirShape tones={tones} snow="#ffffff" trunk="#2f6fd6" />
  if (kind === 'bush') return <BushShape tones={['#5b9cf0', '#4f8fe8', '#5b9cf0']} snow="#ffffff" />
  if (kind === 'sprout') return <SproutShape />
  return (
    <>
      <rect x="-2" y="-8" width="4" height="8" fill="#2f6fd6" />
      <ellipse cx="0" cy="-34" rx="11" ry="30" fill="#3fb5c4" />
      <ellipse cx="4" cy="-34" rx="3.5" ry="24" fill="#6fd0d8" />
    </>
  )
}

export function TreeRow({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 1200 120"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <g>
        {ROW.map(([x, kind, s, v]) => (
          <g key={x} transform={`translate(${x} 120) scale(${s})`}>
            <RowTree kind={kind} v={v} />
          </g>
        ))}
      </g>
    </svg>
  )
}

/* ---------- foreground houses ---------- */

type Bulb = { x: number; y: number; c: string }

const BULB_COLORS = ['#e8453c', '#ffd166', '#3cc46a', '#3d7fe0']

function Bulbs({ list }: { list: Bulb[] }) {
  return (
    <>
      {list.map((b, i) => (
        <circle key={b.x} className={TWINKLE[i % 3]} cx={b.x} cy={b.y} r="3.2" fill={b.c} />
      ))}
    </>
  )
}

/** Garland of `n` droops between x0 and x1 hanging off y; returns the cord path and bulbs. */
function garland(x0: number, x1: number, y: number, n: number, sag: number) {
  const step = (x1 - x0) / n
  let d = `M${x0} ${y}`
  const bulbs: Bulb[] = []
  for (let k = 0; k < n; k++) {
    const sx = x0 + k * step
    d += ` Q${sx + step / 2} ${y + sag * 2} ${sx + step} ${y}`
    bulbs.push({ x: sx + step / 2, y: y + sag + 2.5, c: BULB_COLORS[(k * 2) % 4]! })
    if (k < n - 1) bulbs.push({ x: sx + step, y: y + 3, c: BULB_COLORS[(k * 2 + 1) % 4]! })
  }
  return { d, bulbs }
}

function Wreath({ x, y, bow = '#e8453c' }: { x: number; y: number; bow?: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r="8" fill="none" stroke="#1f8a55" strokeWidth="4.2" />
      {[0, 1, 2, 3, 4].map((k) => (
        <circle
          key={k}
          cx={x + 8 * Math.cos(1 + k * 1.3)}
          cy={y + 8 * Math.sin(1 + k * 1.3)}
          r="1.5"
          fill="#e8453c"
        />
      ))}
      <path d={`M${x} ${y + 8} L${x - 6} ${y + 5} L${x - 5} ${y + 12} Z M${x} ${y + 8} L${x + 6} ${y + 5} L${x + 5} ${y + 12} Z`} fill={bow} />
      <circle cx={x} cy={y + 8} r="2" fill={bow} />
    </g>
  )
}

/** Window with a coloured frame, warm glass and a cross. */
function Pane({ x, y, w, h, frame }: { x: number; y: number; w: number; h: number; frame: string }) {
  return (
    <g>
      <rect x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx="3" fill={frame} />
      <rect x={x} y={y} width={w} height={h} rx="1.5" fill={WARM} />
      <path d={`M${x + w / 2} ${y} V${y + h} M${x} ${y + h / 2} H${x + w}`} stroke={frame} strokeWidth="2" />
    </g>
  )
}

const DRIFT = 'M6 196 Q40 182 84 190 Q124 184 166 190 Q196 184 214 196 Z'

export function CottageHouse({ className }: Props) {
  const g = garland(26, 194, 108, 6, 6)
  const drips = [0.22, 0.5, 0.8]
  return (
    <svg className={className} viewBox="0 0 220 200" aria-hidden="true" focusable="false">
      {/* chimney sits behind the roof so only its top shows */}
      <rect x="68" y="36" width="18" height="40" fill="#f6a04d" />
      <rect x="65" y="30" width="24" height="9" rx="4.5" fill={SNOW} />

      <rect x="40" y="100" width="140" height="96" fill="#fbe9b7" />
      <rect x="40" y="152" width="140" height="10" fill="#f6a04d" />
      <polygon points="22,106 110,32 198,106" fill="#3f6fd8" />
      <rect x="40" y="104" width="140" height="5" fill="#2f5cc0" />

      {/* solar panels, drawn in a frame rotated onto the right slope */}
      <g transform="translate(110 33) rotate(39.8)">
        {[20, 48].map((px) => (
          <g key={px}>
            <rect x={px} y="12" width="24" height="18" rx="1.5" fill="#5b7fd6" />
            <path
              d={`M${px + 8} 12 V30 M${px + 16} 12 V30 M${px} 21 H${px + 24}`}
              stroke="#cfe0fb"
              strokeWidth="1"
            />
          </g>
        ))}
      </g>

      {/* thick snow cap along both slopes with rounded drips */}
      <path
        d="M24 104 L110 33 L196 104"
        fill="none"
        stroke={SNOW}
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {drips.map((t) => (
        <g key={t}>
          <circle cx={110 - 86 * t} cy={33 + 71 * t + 7} r="3.6" fill={SNOW} />
          <circle cx={110 + 86 * t} cy={33 + 71 * t + 7} r="3.6" fill={SNOW} />
        </g>
      ))}

      <circle cx="110" cy="80" r="12" fill={SNOW} />
      <circle cx="110" cy="80" r="9" fill={WARM} />
      <path d="M110 71 V89 M101 80 H119" stroke="#ffffff" strokeWidth="2" />

      <Pane x={50} y={120} w={30} h={26} frame="#ffffff" />
      <Pane x={140} y={120} w={30} h={26} frame="#ffffff" />

      <rect x="94" y="148" width="32" height="48" rx="3" fill="#3fb5c4" />
      <rect x="99" y="154" width="22" height="16" rx="2" fill="#2f9fae" />
      <circle cx="119" cy="178" r="1.8" fill="#ffd166" />
      <Wreath x={110} y={164} />

      <path d={g.d} fill="none" stroke="#1f8a55" strokeWidth="2.4" strokeLinecap="round" />
      <Bulbs list={g.bulbs} />

      <path d={DRIFT} fill={SNOW} />
    </svg>
  )
}

function CandyPost({ x }: { x: number }) {
  let d = ''
  for (let y = 122; y < 190; y += 12) d += `M${x} ${y} L${x + 7} ${y + 7} V${y + 13} L${x} ${y + 6} Z `
  return (
    <g>
      <rect x={x} y="118" width="7" height="78" fill={SNOW} />
      <path d={d} fill="#e8453c" />
    </g>
  )
}

export function GingerHouse({ className }: Props) {
  const g = garland(74, 166, 128, 4, 5)
  const scallops = Array.from({ length: 10 }, (_, k) => 75 + k * 10)
  const sprinkles = [
    [0.15, 0],
    [0.35, 1],
    [0.55, 2],
    [0.75, 3],
  ] as const
  return (
    <svg className={className} viewBox="0 0 220 200" aria-hidden="true" focusable="false">
      <rect x="148" y="36" width="16" height="46" fill="#8a4f2a" />
      <rect x="145" y="31" width="22" height="9" rx="4.5" fill={SNOW} />

      {/* side annex */}
      <rect x="22" y="152" width="50" height="44" fill="#b06a3c" />
      <polygon points="14,154 47,128 80,154" fill="#8a4f2a" />
      <path
        d="M20 152 L47 132 L74 152"
        fill="none"
        stroke={SNOW}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Pane x={34} y={164} w={22} h={20} frame={SNOW} />

      {/* main body */}
      <rect x="70" y="112" width="100" height="84" fill="#b06a3c" />
      <path d="M78 140 h14 M110 132 h16 M148 140 h14 M82 180 h16 M142 176 h14" stroke="#8a4f2a" strokeWidth="4" strokeLinecap="round" />
      <polygon points="56,116 120,20 184,116" fill="#8a4f2a" />
      <path
        d="M66 108 L120 32 L174 108"
        fill="none"
        stroke={SNOW}
        strokeWidth="22"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {sprinkles.map(([t, c]) => (
        <g key={t}>
          <circle cx={120 - 54 * t - 1} cy={32 + 76 * t - 7} r="2" fill={BULB_COLORS[c]} />
          <circle cx={120 + 54 * t + 1} cy={32 + 76 * t - 3} r="2" fill={BULB_COLORS[(c + 2) % 4]} />
        </g>
      ))}
      <circle cx="120" cy="84" r="13" fill={SNOW} />
      <circle cx="120" cy="84" r="10" fill={WARM} />
      <path d="M120 74 V94 M110 84 H130" stroke={SNOW} strokeWidth="2" />

      {/* icing scallops along the eaves */}
      {scallops.map((x) => (
        <circle key={x} cx={x} cy="114" r="5.5" fill={SNOW} />
      ))}

      <Pane x={80} y={142} w={20} h={20} frame={SNOW} />
      <Pane x={140} y={142} w={20} h={20} frame={SNOW} />

      <rect x="103" y="148" width="34" height="48" rx="3" fill={SNOW} />
      <rect x="106" y="151" width="28" height="45" rx="2" fill="#e8453c" />
      <circle cx="129" cy="176" r="1.8" fill="#ffd166" />
      <Wreath x={120} y={166} bow={SNOW} />

      <CandyPost x={65} />
      <CandyPost x={168} />

      <path d={g.d} fill="none" stroke="#1f8a55" strokeWidth="2.2" strokeLinecap="round" />
      <Bulbs list={g.bulbs} />

      <path d={DRIFT} fill={SNOW} />
    </svg>
  )
}

/* ---------- StarTree ---------- */

function starPoints(cx: number, cy: number, outer: number, inner: number) {
  return Array.from({ length: 10 }, (_, k) => {
    const a = -Math.PI / 2 + (k * Math.PI) / 5
    const r = k % 2 ? inner : outer
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`
  }).join(' ')
}

const TREE_TIERS = [
  { a: 22, b: 62, w: 24, c: '#2fb36a' },
  { a: 44, b: 96, w: 32, c: '#1f9a5a' },
  { a: 70, b: 130, w: 41, c: '#1f9a5a' },
]

const ORNAMENTS = [
  { x: 44, y: 52, c: '#e8453c' },
  { x: 56, y: 40, c: '#ffd166' },
  { x: 36, y: 82, c: '#3d7fe0' },
  { x: 62, y: 86, c: '#ffffff' },
  { x: 50, y: 70, c: '#e8453c' },
  { x: 28, y: 114, c: '#ffd166' },
  { x: 50, y: 108, c: '#ffffff' },
  { x: 72, y: 118, c: '#3d7fe0' },
  { x: 38, y: 126, c: '#e8453c' },
  { x: 64, y: 130, c: '#ffd166' },
]

export function StarTree({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 100 160" aria-hidden="true" focusable="false">
      <rect x="44" y="126" width="12" height="26" fill="#7a4a2c" />
      {[...TREE_TIERS].reverse().map(({ a, b, w, c }) => {
        // swag across the tier, 14 units above its hem
        const y = b - 14
        const half = (w * (y - a)) / (b - a) - 2
        return (
          <g key={a}>
            <path d={`M50 ${a} L${50 + w} ${b} Q50 ${b + 6} ${50 - w} ${b} Z`} fill={c} />
            <path
              d={`M${50 - half} ${y} Q50 ${y + 12} ${50 + half} ${y}`}
              fill="none"
              stroke="#ffd166"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          </g>
        )
      })}
      {ORNAMENTS.map((o) => (
        <circle key={`${o.x}-${o.y}`} cx={o.x} cy={o.y} r="3.2" fill={o.c} />
      ))}

      <circle className={styles.starGlow} cx="50" cy="15" r="14" fill="#ffd166" opacity="0.4" />
      <polygon points={starPoints(50, 15, 10, 4.4)} fill="#ffd166" />

      {/* gifts at the foot */}
      <rect x="10" y="140" width="22" height="16" rx="1.5" fill="#e0473f" />
      <rect x="19" y="140" width="4" height="16" fill="#ffd166" />
      <rect x="10" y="146" width="22" height="3.4" fill="#ffd166" />
      <rect x="66" y="144" width="16" height="12" rx="1.5" fill="#3d7fe0" />
      <rect x="72" y="144" width="4" height="12" fill={SNOW} />
      <rect x="84" y="148" width="12" height="8" rx="1.5" fill="#2fae6a" />
      <rect x="88" y="148" width="3" height="8" fill="#e0473f" />
    </svg>
  )
}

/* ---------- scatter pieces ---------- */

const FIR_BRIGHT = ['#2fae6a', '#1f8a55', '#2fae6a'] as const

export function Fir({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 40 64" aria-hidden="true" focusable="false">
      <g transform="translate(20 62) scale(0.92)">
        <FirShape tones={FIR_BRIGHT} />
      </g>
    </svg>
  )
}

export function Bush({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 48 32" aria-hidden="true" focusable="false">
      <ellipse cx="24" cy="29" rx="22" ry="3" fill={SNOW} />
      <g transform="translate(24 29) scale(1.1)">
        <BushShape tones={['#3cc46a', '#2fae6a', '#3cc46a']} />
      </g>
    </svg>
  )
}

export function Sprout({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <ellipse cx="12" cy="22.5" rx="8" ry="1.5" fill={SNOW} />
      <g transform="translate(12 23)">
        <SproutShape />
      </g>
    </svg>
  )
}
