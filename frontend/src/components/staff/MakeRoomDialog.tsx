import type { HourSpan, OrnamentColor } from '../../domain/types'
import { formatStaffShortDate } from '../../lib/postShipping'
import { formatHour, weekdayShort } from '../../lib/time'
import { Button } from '../ui/Button'
import { StaffDialog } from './StaffDialog'
import styles from './MakeRoomDialog.module.css'

export type MakeRoomDialogMove = {
  itemId: string
  orderCode: string
  photoUrl?: string | null
  color?: OrnamentColor | null
  from: HourSpan
  to: HourSpan
}

type Props = {
  moved: MakeRoomDialogMove[]
  yourSlot?: HourSpan | null
  todayDate: string
  note?: string
  onClose: () => void
}

function shortDayTime(span: HourSpan): string {
  return `${weekdayShort(span.date)} ${formatHour(span.startHour)}`
}

function yourSlotText(slot: HourSpan, todayDate: string): string {
  const day = slot.date === todayDate ? 'Today' : formatStaffShortDate(slot.date)
  return `Your slot: ${day} ${formatHour(slot.startHour)}–${formatHour(slot.endHour)}`
}

export function MakeRoomDialog({ moved, yourSlot, todayDate, note, onClose }: Props) {
  const title = yourSlot ? 'Room made' : 'Session moved'
  return (
    <StaffDialog title={title} onClose={onClose}>
      {moved.length > 0 ? (
        <ul className={styles.list} aria-label="Moved paint sessions">
          {moved.map((row) => (
            <li key={row.itemId} className={styles.row}>
              {row.photoUrl ? (
                <img className={styles.photo} src={row.photoUrl} alt="" width={44} height={44} />
              ) : row.color ? (
                <span
                  className={styles.swatch}
                  style={{ background: `var(--ornament-${row.color})` }}
                  role="img"
                  aria-label={`${row.color} ornament`}
                />
              ) : null}
              <div className={styles.body}>
                <strong>{row.orderCode || 'Paint session'}</strong>
                <p className={styles.times}>
                  <span>{shortDayTime(row.from)}</span>
                  <svg
                    className={styles.arrow}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="M5 12h14m-5-5 5 5-5 5" />
                  </svg>
                  <span className={styles.srOnly}> to </span>
                  <strong>{shortDayTime(row.to)}</strong>
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>A slot was already free.</p>
      )}
      {yourSlot ? <p className={styles.yourSlot}>{yourSlotText(yourSlot, todayDate)}</p> : null}
      {note ? <p className={styles.note}>{note}</p> : null}
      <Button tone="staff" size="lg" fullWidth onClick={onClose}>
        OK
      </Button>
    </StaffDialog>
  )
}
