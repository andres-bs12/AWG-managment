import styles from './FlatFolk.module.css'

/**
 * Flat, Santa-Tracker-style villagers for the public scene. Every figure is a standalone SVG so
 * the backdrop can place and scale it on its own; limbs only ever animate `transform`, and all
 * motion is switched off under `prefers-reduced-motion` in the module CSS.
 */

const INK = '#2a1f2d'
const SKIN = { light: '#f4c9a4', mid: '#d9a074', deep: '#8d5a3b' } as const

type Hat = 'elf' | 'beanie'

type HeadProps = {
  x: number
  y: number
  skin: string
  hat: Hat
  hatColor: string
  trim?: string
  ears?: boolean
}

/** Head + hat, facing right, centred on (x, y) with a 6.5 radius. */
function Head({ x, y, skin, hat, hatColor, trim = '#fbfdff', ears = false }: HeadProps) {
  return (
    <g transform={`translate(${x - 20} ${y - 21})`}>
      {ears ? <path d="M14.6 19.6 L9.6 17.2 L14 23.4 Z" fill={skin} /> : null}
      <circle cx="20" cy="21" r="6.5" fill={skin} />
      <circle cx="22.8" cy="20.4" r="0.95" fill={INK} />
      <circle cx="24.4" cy="23.2" r="1.4" fill="#e8846f" opacity="0.55" />
      <path d="M22 24.6 Q23.6 25.6 25 24.4" stroke={INK} strokeWidth="0.8" fill="none" strokeLinecap="round" />
      {hat === 'beanie' ? (
        <>
          <path d="M13.3 19.4 A6.8 6.8 0 0 1 26.7 19.4 Z" fill={hatColor} />
          <circle cx="20" cy="11.8" r="2.2" fill={trim} />
          <rect x="12.8" y="17.6" width="14.4" height="3" rx="1.5" fill={trim} />
        </>
      ) : (
        <>
          {/* the tip flops backwards, which is what reads as "elf" at 20px */}
          <path d="M13.4 19.4 Q13.6 11.6 20 11.2 Q24.2 11 26.6 15.6 L26.8 19.4 Z" fill={hatColor} />
          <path d="M15.4 13.6 Q10.2 9.6 6.6 12.8 Q10.6 12.6 14.2 17.4 Z" fill={hatColor} />
          <circle cx="6.4" cy="13" r="2.1" fill={trim} />
          <rect x="12.6" y="17.4" width="14.8" height="3.2" rx="1.6" fill={trim} />
        </>
      )}
    </g>
  )
}

type PersonProps = {
  skin?: string
  hat?: Hat
  hatColor?: string
  trim?: string
  coat: string
  coatShade: string
  legs: string
  boots?: string
  mitten?: string
  scarf?: string
  belt?: boolean
  ears?: boolean
  pose?: 'walk' | 'stand' | 'wave' | 'hang'
}

/** The shared body: feet on y=62 of a 40x64 box, facing right. */
function PersonBody({
  skin = SKIN.light,
  hat = 'beanie',
  hatColor = '#e0473f',
  trim = '#fbfdff',
  coat,
  coatShade,
  legs,
  boots = '#3b2a22',
  mitten,
  scarf,
  belt = false,
  ears = false,
  pose = 'stand',
}: PersonProps) {
  const walking = pose === 'walk'
  const hand = mitten ?? coatShade
  const raised = pose === 'wave' || pose === 'hang'

  return (
    <>
      <g className={walking ? styles.legA : undefined}>
        <rect x="15.6" y="41" width="4.8" height="16" rx="2.4" fill={legs} />
        <path d="M14.6 55.6 h6.4 q3.6 0 3.6 3.4 v1.2 H14.6 Z" fill={boots} />
      </g>
      <g className={walking ? styles.legB : undefined}>
        <rect x="19.6" y="41" width="4.8" height="16" rx="2.4" fill={legs} />
        <path d="M18.6 55.6 h6.4 q3.6 0 3.6 3.4 v1.2 H18.6 Z" fill={boots} />
      </g>

      <g className={walking ? styles.armB : undefined}>
        <path d="M19 30.4 L18 40.4" stroke={coatShade} strokeWidth="4.4" strokeLinecap="round" />
        <circle cx="17.8" cy="41.6" r="2.1" fill={hand} />
      </g>

      <path d="M12.6 45.6 Q12.2 30.6 20 28.2 Q27.8 30.6 27.4 45.6 Z" fill={coat} />
      <path d="M12.6 45.6 Q12.2 30.6 20 28.2 Q16 33 16.4 45.6 Z" fill={coatShade} opacity="0.45" />
      {belt ? (
        <>
          <rect x="12.5" y="38.4" width="15" height="3" fill={INK} />
          <rect x="18.4" y="38" width="3.6" height="3.8" rx="0.8" fill="#ffd166" />
        </>
      ) : null}
      {scarf ? (
        <>
          <path d="M15.2 29.4 Q20 32.6 24.8 29.4" stroke={scarf} strokeWidth="3.6" fill="none" strokeLinecap="round" />
          <path d="M16.6 31 L15 37.4" stroke={scarf} strokeWidth="3" strokeLinecap="round" />
        </>
      ) : null}

      {raised ? (
        <g className={pose === 'wave' ? styles.wave : undefined}>
          <path d="M21.4 31.2 L26.8 25.6 L28.6 18.6" stroke={coat} strokeWidth="4.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="29" cy="16.6" r="2.3" fill={hand} />
        </g>
      ) : (
        <g className={walking ? styles.armA : undefined}>
          <path d="M21 30.4 L22.4 40.4" stroke={coat} strokeWidth="4.4" strokeLinecap="round" />
          <circle cx="22.6" cy="41.6" r="2.1" fill={hand} />
        </g>
      )}

      <Head x={20} y={21} skin={skin} hat={hat} hatColor={hatColor} trim={trim} ears={ears} />
    </>
  )
}

type FigureProps = { className?: string }

/** Ground shadow under every standing figure, so nobody floats on the snow. */
function Shadow({ cx, rx }: { cx: number; rx: number }) {
  return <ellipse cx={cx} cy="61.6" rx={rx} ry="2" fill="#3a5a96" opacity="0.18" />
}

export function WalkingElf({ className }: FigureProps) {
  return (
    <svg className={className} viewBox="0 0 40 64" aria-hidden="true">
      <Shadow cx={21} rx={10} />
      <g className={styles.step}>
        <PersonBody
          pose="walk"
          hat="elf"
          hatColor="#e0473f"
          coat="#2fae6a"
          coatShade="#1f7a4d"
          legs="#e0473f"
          mitten="#ffd166"
          belt
          ears
        />
      </g>
    </svg>
  )
}

export function WalkingNeighbour({ className }: FigureProps) {
  return (
    <svg className={className} viewBox="0 0 40 64" aria-hidden="true">
      <Shadow cx={21} rx={10} />
      <g className={styles.stepSlow}>
        <PersonBody
          pose="walk"
          skin={SKIN.deep}
          hat="beanie"
          hatColor="#4a7ab5"
          trim="#ffd166"
          coat="#f08a3c"
          coatShade="#c8652a"
          legs="#2c3d6b"
          mitten="#4a7ab5"
          scarf="#e0473f"
        />
      </g>
    </svg>
  )
}

export function WavingElf({ className, coat = '#7b5cd6', coatShade = '#5a3fb0' }: FigureProps & { coat?: string; coatShade?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 64" aria-hidden="true">
      <Shadow cx={20} rx={10} />
      <PersonBody
        pose="wave"
        skin={SKIN.mid}
        hat="elf"
        hatColor="#2fae6a"
        coat={coat}
        coatShade={coatShade}
        legs="#2a1f2d"
        mitten="#ffd166"
        belt
        ears
      />
    </svg>
  )
}

export function Cyclist({ className }: FigureProps) {
  const wheel = (cx: number) => (
    <g>
      <circle cx={cx} cy="50" r="10.5" fill="none" stroke={INK} strokeWidth="2.6" />
      <g className={styles.spin} style={{ transformOrigin: `${cx}px 50px` }}>
        <path d={`M${cx - 10} 50 H${cx + 10} M${cx} 40 V60 M${cx - 7} 43 L${cx + 7} 57 M${cx + 7} 43 L${cx - 7} 57`} stroke="#9fb3cf" strokeWidth="0.9" />
      </g>
    </g>
  )

  return (
    <svg className={className} viewBox="0 0 76 64" aria-hidden="true">
      <ellipse cx="38" cy="61.6" rx="30" ry="2" fill="#3a5a96" opacity="0.18" />
      <g className={styles.ride}>
        {wheel(15)}
        {wheel(60)}
        {/* frame */}
        <path d="M15 50 L34 50 L28 33 L54 33 L60 50 M34 50 L54 33 M28 33 L26 29 M52 27 L54 33" stroke="#4a7ab5" strokeWidth="2.8" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <path d="M22 28.4 h8" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <path d="M49 26 h6" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />

        {/* rider: legs pump around the crank, torso leans to the bars */}
        <g className={styles.pedalA}>
          <path d="M28 30 L38 39 L34 50" stroke="#2c3d6b" strokeWidth="4.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M31 48.6 h6 q2.6 0 2.6 2.6 H31 Z" fill="#3b2a22" />
        </g>
        <path d="M24 32 Q24 20 33 16.4 Q40 16 40.6 24 L32 33 Z" fill="#e0473f" />
        <path d="M34 20 L44 23.6 L51 26.4" stroke="#e0473f" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="52" cy="26.4" r="2" fill="#ffd166" />
        <path d="M23.6 29 h11" stroke={INK} strokeWidth="2.6" />
        <Head x={37} y={11} skin={SKIN.mid} hat="elf" hatColor="#2fae6a" ears />
      </g>
    </svg>
  )
}

export function Yeti({ className }: FigureProps) {
  return (
    <svg className={className} viewBox="0 -4 60 84" aria-hidden="true">
      <ellipse cx="28" cy="77.6" rx="20" ry="2.4" fill="#3a5a96" opacity="0.2" />
      {/* a cool blue rim keeps the white fur readable against white snow */}
      <path d="M16 70 v7 h9 v-7 Z M31 70 v7 h9 v-7 Z" fill="#dde8f6" stroke="#b9cde8" strokeWidth="1.4" />
      <path d="M12 38 Q4 48 7 60" stroke="#b9cde8" strokeWidth="10.6" fill="none" strokeLinecap="round" />
      <path d="M9 72 Q4 38 16 22 Q28 8 40 22 Q52 38 47 72 Z" fill="#f6f9ff" stroke="#b9cde8" strokeWidth="1.6" />
      <path d="M9 72 Q4 38 16 22 Q12 40 18 72 Z" fill="#dbe6f5" />
      <path d="M12 38 Q4 48 7 60" stroke="#eef3fb" strokeWidth="8" fill="none" strokeLinecap="round" />
      <g className={styles.yetiWave}>
        <path d="M39 41 Q52 30 50 18" stroke="#b9cde8" strokeWidth="10.6" fill="none" strokeLinecap="round" />
        <path d="M39 41 Q52 30 50 18" stroke="#f6f9ff" strokeWidth="8" fill="none" strokeLinecap="round" />
        <path d="M46.4 14 l1 -4 M50 13.4 l0.6 -4.4 M53.4 14.6 l1.4 -3.8" stroke="#b9cde8" strokeWidth="2.6" strokeLinecap="round" />
      </g>
      <ellipse cx="28" cy="28" rx="10.5" ry="9" fill="#7fa7de" />
      <circle cx="24.4" cy="26" r="1.5" fill={INK} />
      <circle cx="31.6" cy="26" r="1.5" fill={INK} />
      <path d="M21.6 31.2 Q24.6 29 28 31 Q31.4 29 34.4 31.2 Q31 33.4 28 32 Q25 33.4 21.6 31.2 Z" fill="#f6f9ff" />
      <path d="M25 34.4 Q28 36.4 31 34.4" stroke={INK} strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M22 19 l-2 -4 l4 2 l1 -5 l3 4 l3 -4 l1 5 l4 -2 l-2 4 Z" fill="#f6f9ff" />
    </svg>
  )
}

export function Reindeer({ className }: FigureProps) {
  return (
    <svg className={className} viewBox="0 0 72 64" aria-hidden="true">
      <ellipse cx="34" cy="61.6" rx="24" ry="2" fill="#3a5a96" opacity="0.18" />
      <g stroke="#9a6236" strokeWidth="4" strokeLinecap="round">
        <path d="M18 40 V59 M26 41 V59 M40 41 V59 M47 40 V59" />
      </g>
      <g stroke={INK} strokeWidth="4" strokeLinecap="round">
        <path d="M18 58.4 v1.4 M26 58.4 v1.4 M40 58.4 v1.4 M47 58.4 v1.4" />
      </g>
      <path d="M12 38 Q12 28 24 28 H44 Q53 28 53 37 Q53 45 44 45 H22 Q12 45 12 38 Z" fill="#c08553" />
      <path d="M12.4 34 Q8 30 7.4 35 Q9 37.4 12.6 37 Z" fill="#f0dcc0" />
      {/* red blanket with a gold trim, as in the village reference */}
      <path d="M26 28 H40 V40 Q33 43 26 40 Z" fill="#e0473f" />
      <path d="M26 39.4 Q33 42.4 40 39.4" stroke="#ffd166" strokeWidth="1.6" fill="none" />
      <g className={styles.nod}>
        <path d="M46 31 L52 16 L59 19 L54 33 Z" fill="#c08553" />
        <ellipse cx="59" cy="15.6" rx="7.6" ry="5.4" fill="#c08553" transform="rotate(-10 59 15.6)" />
        <circle cx="66.4" cy="16.6" r="2.4" fill="#e0473f" />
        <circle cx="59.4" cy="13" r="1.1" fill={INK} />
        <ellipse cx="53.4" cy="10.4" rx="3" ry="1.8" fill="#9a6236" transform="rotate(-30 53.4 10.4)" />
        <path d="M56 9.6 L54 2.6 M54 2.6 L50 1.2 M54 2.6 L55 -0.6 M60.6 9.4 L62.4 2.8 M62.4 2.8 L66 1.6 M62.4 2.8 L61.8 -0.4" stroke="#e6d4b6" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  )
}

export function Snowman({ className }: FigureProps) {
  return (
    <svg className={className} viewBox="0 0 40 60" aria-hidden="true">
      <ellipse cx="20" cy="58" rx="14" ry="2" fill="#3a5a96" opacity="0.18" />
      <circle cx="20" cy="46" r="12" fill="#f6f9ff" />
      <circle cx="20" cy="29" r="9" fill="#f6f9ff" />
      <circle cx="20" cy="15.4" r="7" fill="#f6f9ff" />
      <path d="M8 46 A12 12 0 0 0 20 58 A14 14 0 0 1 8 46 Z" fill="#dbe6f5" />
      <path d="M11.4 26 L3 20 M5.8 22 L3 24.6 M28.6 26 L37 21 M34.2 22.6 L37.4 24.8" stroke="#7a4a23" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="20" cy="27" r="1.2" fill={INK} />
      <circle cx="20" cy="31.6" r="1.2" fill={INK} />
      <path d="M13.6 21.6 Q20 24.6 26.4 21.6" stroke="#2fae6a" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <path d="M23.6 23 L25 29" stroke="#2fae6a" strokeWidth="2.8" strokeLinecap="round" />
      <circle cx="17.6" cy="14" r="1" fill={INK} />
      <circle cx="22.4" cy="14" r="1" fill={INK} />
      <path d="M20 16 L27.4 17.4 L20 18 Z" fill="#f08a3c" />
      <rect x="13" y="8.4" width="14" height="2.4" rx="1" fill={INK} />
      <rect x="15.4" y="1.6" width="9.2" height="7.6" rx="1.2" fill={INK} />
      <rect x="15.4" y="6" width="9.2" height="1.8" fill="#e0473f" />
    </svg>
  )
}

/**
 * Green street lamp with an elf hanging from its side arm by one hand, like the Santa Tracker
 * village. The arm gives the hand something to grip, so the pose reads as "hanging", not floating.
 */
export function LampElf({ className }: FigureProps) {
  return (
    <svg className={className} viewBox="0 0 64 128" aria-hidden="true">
      <ellipse cx="22" cy="125.4" rx="16" ry="2.4" fill="#3a5a96" opacity="0.2" />
      <path d="M12 126 Q12 118 22 116 Q32 118 32 126 Z" fill="#1f7a4d" />
      <rect x="18.6" y="28" width="6.8" height="92" rx="2" fill="#2fae6a" />
      <rect x="18.6" y="28" width="2.4" height="92" fill="#1f7a4d" opacity="0.5" />
      {/* side arm with a curl, the elf's handhold */}
      <path d="M24 44 H46 Q51 44 51 49 Q51 53 47 53" stroke="#1f7a4d" strokeWidth="4.4" fill="none" strokeLinecap="round" />
      <path d="M24 52 Q31 45 38 44" stroke="#1f7a4d" strokeWidth="2.6" fill="none" />
      <rect x="17" y="40" width="10" height="7" rx="2" fill="#1f7a4d" />
      <path d="M10 14 L22 4 L34 14 V26 H10 Z" fill="#2fae6a" />
      <path d="M8 13 L22 1.6 L36 13 Z" fill="#1f7a4d" />
      <g className={styles.lampGlow}>
        <circle cx="16.4" cy="19.4" r="4.4" fill="#fff3c4" />
        <circle cx="27.6" cy="19.4" r="4.4" fill="#fff3c4" />
      </g>
      <rect x="12" y="24.6" width="20" height="4.4" rx="1.4" fill="#1f7a4d" />

      {/* the raised mitten in PersonBody sits at (29, 16.6); this hangs it from the arm at (42, 44) */}
      <g className={styles.swing} style={{ transformOrigin: '42px 44px' }}>
        <g transform="translate(42 44) rotate(-20) translate(-29 -16.6)">
          <PersonBody
            pose="hang"
            skin={SKIN.light}
            hat="elf"
            hatColor="#e0473f"
            coat="#2fae6a"
            coatShade="#1f7a4d"
            legs="#e0473f"
            boots={INK}
            mitten="#ffd166"
            belt
            ears
          />
        </g>
      </g>
    </svg>
  )
}
