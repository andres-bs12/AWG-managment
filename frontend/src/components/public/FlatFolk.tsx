import styles from './FlatFolk.module.css'

/**
 * Flat, Santa-Tracker-style villagers for the public scene. Every figure is a standalone SVG so
 * the backdrop can place and scale it on its own; limbs only ever animate `transform`, and all
 * motion is switched off under `prefers-reduced-motion` in the module CSS.
 */

const INK = '#2a1f2d'
const SKIN = { light: '#f4c9a4', mid: '#d9a074', deep: '#8d5a3b' } as const

type Hat = 'elf' | 'beanie' | 'bun'

type HeadProps = {
  x: number
  y: number
  skin: string
  hat: Hat
  hatColor: string
  trim?: string
  ears?: boolean
}

/**
 * Head + hat, turned three-quarters to the right, centred on (x, y) with an 8 radius. The head is
 * deliberately large for the body: at 40px tall a small head turns the figure into a cone.
 */
function Head({ x, y, skin, hat, hatColor, trim = '#fbfdff', ears = false }: HeadProps) {
  return (
    <g transform={`translate(${x - 20} ${y - 21})`}>
      {ears ? <path d="M13.2 19.8 Q8 16.4 6.6 18 Q8.4 22.8 13 24.4 Z" fill={skin} /> : null}
      {hat === 'bun' ? <circle cx="12.6" cy="13.4" r="4.2" fill={hatColor} /> : null}
      <circle cx="20" cy="21" r="8" fill={skin} />
      <circle cx="21.4" cy="21.2" r="1.1" fill={INK} />
      <circle cx="25.6" cy="21.2" r="1.1" fill={INK} />
      <circle cx="18.6" cy="24.4" r="1.7" fill="#e8846f" opacity="0.5" />
      <circle cx="26.8" cy="24.2" r="1.5" fill="#e8846f" opacity="0.5" />
      <path d="M21.6 24.8 Q23.5 26.7 25.4 24.8" stroke={INK} strokeWidth="0.9" fill="none" strokeLinecap="round" />
      {hat === 'beanie' ? (
        <>
          <path d="M11.8 19.6 A8.3 8.3 0 0 1 28.2 19.6 Z" fill={hatColor} />
          <circle cx="20" cy="10.2" r="2.7" fill={trim} />
          <rect x="11.2" y="17.2" width="17.6" height="3.8" rx="1.9" fill={trim} />
        </>
      ) : hat === 'elf' ? (
        <>
          {/* the tip flops backwards with a pom, which is what reads as "elf" at this size */}
          <path d="M12 19.4 Q12.4 10 20 9.6 Q25.6 9.6 28 16 L28.2 19.4 Z" fill={hatColor} />
          <path d="M14.6 12.4 Q8.6 6.8 4.4 10.4 Q9.4 10.8 13 16.6 Z" fill={hatColor} />
          <circle cx="4.6" cy="10.8" r="2.4" fill={trim} />
          <rect x="11.2" y="17.2" width="17.6" height="3.8" rx="1.9" fill={trim} />
        </>
      ) : (
        <>
          {/* hair swept back into a bun */}
          <path d="M11.9 21 Q11 12.6 20 12.8 Q26.6 12.8 28.1 19 Q22 14.6 15.6 17.4 Q13.6 18.6 13.4 23 Z" fill={hatColor} />
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
  apron?: string
  belt?: boolean
  ears?: boolean
  pose?: 'walk' | 'stand' | 'wave' | 'hang' | 'paint'
}

/** The raised mitten of the `wave`/`hang` poses, in the figure's own units (LampElf hangs from it). */
const RAISED_HAND = { x: 30.2, y: 17.6 }

/**
 * The shared body: feet on y=60 of a 40x64 box, facing right. Rounded coat with a fur hem, sleeves
 * with mittens and short legs — soft shapes only, so nothing reads as a triangle when it is small.
 */
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
  apron,
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
        <rect x="15.4" y="44" width="5" height="13.4" rx="2.5" fill={legs} />
        <path d="M14.6 55.6 h6.2 q3.8 0 3.8 3.4 v1.2 H14.6 Z" fill={boots} />
      </g>
      <g className={walking ? styles.legB : undefined}>
        <rect x="19.6" y="44" width="5" height="13.4" rx="2.5" fill={legs} />
        <path d="M18.8 55.6 h6.2 q3.8 0 3.8 3.4 v1.2 H18.8 Z" fill={boots} />
      </g>

      {/* far sleeve, behind the coat */}
      <g className={walking ? styles.armB : undefined}>
        <path d="M17.4 32.4 L16 41" stroke={coatShade} strokeWidth="5" strokeLinecap="round" />
        <circle cx="15.8" cy="42.6" r="2.6" fill={hand} />
      </g>

      <path d="M12.4 46.6 Q10.8 33 16 30.4 Q20 28.6 24 30.4 Q29.2 33 27.6 46.6 Q20 49.4 12.4 46.6 Z" fill={coat} />
      <path d="M12.4 46.6 Q10.8 33 16 30.4 Q14.6 38 16.4 47.6 Q14 47.4 12.4 46.6 Z" fill={coatShade} opacity="0.5" />
      {apron ? <path d="M17.4 33 H24.8 Q27 40 26.4 46.9 Q21.6 48.4 17 47.9 Q16.2 40 17.4 33 Z" fill={apron} /> : null}
      {/* fur hem */}
      <path d="M12.6 46 Q20 48.8 27.4 46" stroke={trim} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      {belt ? (
        <>
          <path d="M11.9 39.4 Q20 41.4 28.1 39.4" stroke={INK} strokeWidth="2.6" fill="none" />
          <rect x="18.2" y="38.2" width="3.8" height="3.8" rx="0.9" fill="#ffd166" />
        </>
      ) : null}
      {scarf ? (
        <>
          <path d="M14.6 29.6 Q20 33 25.4 29.6" stroke={scarf} strokeWidth="3.8" fill="none" strokeLinecap="round" />
          <path d="M16.4 31.4 L15 38.2" stroke={scarf} strokeWidth="3.2" strokeLinecap="round" />
        </>
      ) : null}

      {raised ? (
        <g className={pose === 'wave' ? styles.wave : undefined}>
          <path d={`M23 32.2 Q29.6 29 ${RAISED_HAND.x - 0.4} 20.4`} stroke={coat} strokeWidth="5" fill="none" strokeLinecap="round" />
          <circle cx={RAISED_HAND.x} cy={RAISED_HAND.y} r="2.8" fill={hand} />
        </g>
      ) : pose === 'paint' ? (
        <g className={styles.paint}>
          <path d="M22.6 32.4 Q27 34 31 31.4" stroke={coat} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M31.4 31 L37 27.4" stroke="#8b5a2b" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M36.4 27.8 L38.4 26.5" stroke="#e0473f" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="31.4" cy="31" r="2.6" fill={hand} />
        </g>
      ) : (
        <g className={walking ? styles.armA : undefined}>
          <path d="M22.6 32.4 L24 41" stroke={coat} strokeWidth="5" strokeLinecap="round" />
          <circle cx="24.2" cy="42.6" r="2.6" fill={hand} />
        </g>
      )}

      <Head x={20} y={20} skin={skin} hat={hat} hatColor={hatColor} trim={trim} ears={ears} />
    </>
  )
}

/** `x`/`y`/`width`/`height` place a figure inside another SVG (the stall scene). */
type FigureProps = { className?: string; x?: number; y?: number; width?: number; height?: number }

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
    <svg className={className} viewBox="0 -6 76 70" aria-hidden="true">
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

      {/* hangs the raised mitten of PersonBody (RAISED_HAND) from the arm at (42, 44) */}
      <g className={styles.swing} style={{ transformOrigin: '42px 44px' }}>
        <g transform={`translate(42 44) rotate(-20) translate(${-RAISED_HAND.x} ${-RAISED_HAND.y})`}>
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

/** Gaby at work: apron on, brush in hand, painting the ornament that hangs from her stand. */
export function Painter({ className, ...place }: FigureProps) {
  return (
    <svg className={className} {...place} viewBox="0 0 56 64" aria-hidden="true">
      <ellipse cx="26" cy="61.6" rx="20" ry="2" fill="#3a5a96" opacity="0.18" />
      {/* stand with the ornament she is painting */}
      <path d="M48 60 V26 Q48 22 44 22 H41" stroke="#7a4a23" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M43 60 H53" stroke="#7a4a23" strokeWidth="2.4" strokeLinecap="round" />
      <g className={styles.sway}>
        <path d="M41 22 V25" stroke="#7a4a23" strokeWidth="1.2" />
        <rect x="39.4" y="24.4" width="3.2" height="2.6" rx="0.8" fill="#d2b66f" />
        <circle cx="41" cy="32" r="5.6" fill="#b03a2e" />
        <circle cx="41" cy="32.4" r="3" fill="#fff3e0" />
        <path d="M39.3 31.2 L39 29.6 L40.4 30.5 Z M42.7 31.2 L43 29.6 L41.6 30.5 Z" fill="#f0a04b" />
        <circle cx="41" cy="32.8" r="1.7" fill="#f0a04b" />
      </g>
      <PersonBody
        pose="paint"
        skin={SKIN.mid}
        hat="bun"
        hatColor="#5b3a22"
        coat="#e0473f"
        coatShade="#b53229"
        apron="#fff6e2"
        legs="#2c3d6b"
        mitten={SKIN.mid}
      />
    </svg>
  )
}

/** The stall cat: sits on the counter, tail swishing, blinking now and then. */
export function SittingCat({ className, ...place }: FigureProps) {
  return (
    <svg className={className} {...place} viewBox="-8 -8 36 36" aria-hidden="true">
      <path className={styles.catTail} d="M4 25 Q-6 24 -4 13" stroke="#e08a35" strokeWidth="3.6" fill="none" strokeLinecap="round" />
      <path d="M3.4 28 Q1.6 11 13 11 Q24.4 11 22.6 28 Z" fill="#f0a04b" />
      <ellipse cx="13" cy="21.4" rx="4.6" ry="6" fill="#fff3e0" />
      <path d="M6.2 3.4 L5.4 -5 L12 0 Z M19.8 3.4 L20.6 -5 L14 0 Z" fill="#f0a04b" />
      <path d="M7.4 1.6 L7 -2.4 L10.2 0 Z M18.6 1.6 L19 -2.4 L15.8 0 Z" fill="#f6b7a8" />
      <circle cx="13" cy="6.4" r="7.8" fill="#f0a04b" />
      <path d="M13 -1.2 V2 M10.2 -0.6 L10.8 2 M15.8 -0.6 L15.2 2" stroke="#d9822b" strokeWidth="1.2" strokeLinecap="round" />
      <ellipse cx="13" cy="9.2" rx="3.8" ry="2.8" fill="#fff3e0" />
      <g className={styles.blink}>
        <circle cx="10" cy="6" r="1.15" fill={INK} />
        <circle cx="16" cy="6" r="1.15" fill={INK} />
      </g>
      <path d="M12.2 8.2 h1.6 l-0.8 1 Z" fill="#e8846f" />
      <path d="M11.4 10.2 Q12.2 11 13 10.2 Q13.8 11 14.6 10.2" stroke={INK} strokeWidth="0.7" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** The stall dog: sits in front of the counter with a red collar and a wagging tail. */
export function SittingDog({ className, ...place }: FigureProps) {
  return (
    <svg className={className} {...place} viewBox="-6 -2 42 42" aria-hidden="true">
      <ellipse cx="16" cy="37.4" rx="14" ry="1.8" fill="#3a5a96" opacity="0.18" />
      <path className={styles.dogTail} d="M6 31 Q-3 30 -1 21" stroke="#c98a4b" strokeWidth="3.6" fill="none" strokeLinecap="round" />
      <path d="M5.4 37 Q3.4 17 16 16 Q28.6 17 26.6 37 Z" fill="#f6e7d2" />
      <rect x="11.6" y="27" width="4.4" height="10" rx="2.2" fill="#fff6ea" />
      <rect x="17.6" y="27" width="4.4" height="10" rx="2.2" fill="#fff6ea" />
      <g className={styles.tilt}>
        <path d="M10 4.4 Q4 6 6.2 17 Q10.6 15.4 12 8 Z M26 4.4 Q32 6 29.8 17 Q25.4 15.4 24 8 Z" fill="#b5713d" />
        <circle cx="18" cy="9.6" r="8.4" fill="#f6e7d2" />
        <path d="M18 1.4 Q25.6 1.6 26.2 9 Q21 9.6 18 5 Z" fill="#b5713d" opacity="0.9" />
        <circle cx="14.8" cy="9" r="1.15" fill={INK} />
        <circle cx="21.2" cy="9" r="1.15" fill={INK} />
        <ellipse cx="18" cy="13.4" rx="4" ry="3" fill="#fffaf2" />
        <circle cx="18" cy="12.2" r="1.4" fill={INK} />
        <path d="M16.9 14.6 q1.1 3.2 2.2 0 Z" fill="#ef8fa0" />
      </g>
      <path d="M11.4 17.6 Q18 20.8 24.6 17.6" stroke="#e0473f" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <circle cx="18" cy="20.4" r="1.5" fill="#ffd166" />
    </svg>
  )
}
