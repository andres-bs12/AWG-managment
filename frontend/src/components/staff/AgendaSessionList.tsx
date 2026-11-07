import type { AgendaSlot } from '../../domain/types'
import { formatHour } from '../../lib/time'
import styles from './AgendaSessionList.module.css'

type Props = { slots: AgendaSlot[]; selectedId: string | null; onOpen: (slot: AgendaSlot) => void }

export function AgendaSessionList({ slots, selectedId, onOpen }: Props) {
  if (!slots.length) return <p className={styles.empty}>No painting scheduled for this day.</p>
  return <ul className={styles.list}>
    {[...slots].sort((a, b) => a.block.startHour - b.block.startHour).map(slot => {
      const name = slot.held ? 'Held by web checkout' : slot.item?.petName || (slot.item?.kind === 'custom' ? 'Custom ornament' : 'Reserved session')
      const tone = slot.held ? 'held' : (slot.item?.handedOver ?? slot.order?.handedOver) ? 'delivered' : slot.block.status
      const status = slot.held ? 'Held by web checkout' : tone === 'delivered' ? 'Delivered' : tone === 'finished' ? 'Ready' : tone === 'in_progress' ? 'Painting' : 'To paint'
      return <li key={slot.block.id}>
        <button type="button" className={styles.row} data-status={tone} data-held={slot.held || undefined} data-selected={selectedId === slot.block.id} disabled={!slot.order} onClick={() => onOpen(slot)} aria-label={`Open ${name}, ${slot.order?.code ?? 'reservation'}, ${formatHour(slot.block.startHour)}, ${status}`}>
          <span className={styles.time}><strong>{formatHour(slot.block.startHour)}</strong><span>{formatHour(slot.block.endHour)}</span></span>
          <span className={styles.body}><strong>{name}</strong><span>{slot.order?.code}</span></span>
          <span className={styles.status} data-status={tone}>{status}<span aria-hidden="true"> →</span></span>
        </button>
      </li>
    })}
  </ul>
}
