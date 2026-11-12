import { Fragment } from 'react'
import styles from './StaffText.module.css'

// Pieces longer than this may still wrap inside, so a long name never overflows a phone card.
const KEEP_WHOLE = 28

/**
 * Text made of pieces joined by " · " (or →, ↗, –) breaks only between pieces: a separator never
 * starts a line and a short piece such as "Sat, 28 Nov" never splits. Text content is unchanged.
 */
export function StaffText({ children }: { children: string }) {
  const parts = children.split(/ ([·→↗–]) /u)
  const pieces: string[] = []
  for (let index = 0; index < parts.length; index += 2) pieces.push(index + 1 < parts.length ? `${parts[index]} ${parts[index + 1]}` : parts[index])
  // One wrapping span: inside a flex/grid parent, loose spaces between children would collapse ("Nov ·15:30").
  return <span>{pieces.map((piece, index) => <Fragment key={index}>{index > 0 && ' '}{piece.length <= KEEP_WHOLE ? <span className={styles.joined} data-staff-joined>{piece}</span> : piece}</Fragment>)}</span>
}
