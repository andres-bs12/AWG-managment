import type { AgendaSlot, MarketDay } from '../../domain/types'
import { handoffLabel } from '../../lib/handoff'
import { formatHour } from '../../lib/time'
import styles from './AgendaSessionList.module.css'

type Props = { slots: AgendaSlot[]; days: MarketDay[]; selectedId: string | null; onOpen: (slot: AgendaSlot) => void }

export function AgendaSessionList({ slots, days, selectedId, onOpen }: Props) {
  if (!slots.length) return <p className={styles.empty}>No painting scheduled for this day.</p>
  return <ul className={styles.list}>
    {[...slots].sort((a, b) => a.block.startHour - b.block.startHour).map(slot => {
      const name = slot.item?.petName || slot.customer?.name || 'Reserved session'
      const tone = slot.order?.handedOver ? 'delivered' : slot.block.status
      const status = tone === 'delivered' ? 'Delivered' : tone === 'finished' ? 'Ready' : tone === 'in_progress' ? 'Painting' : 'To paint'
      return <li key={slot.block.id}>
        <button type="button" className={styles.row} data-status={tone} data-selected={selectedId === slot.block.id} disabled={!slot.order} onClick={() => onOpen(slot)} aria-label={`Open ${name}, ${formatHour(slot.block.startHour)}, ${status}`}>
          <span className={styles.time}><strong>{formatHour(slot.block.startHour)}</strong><span>{formatHour(slot.block.endHour)}</span></span>
          <span className={styles.body}><strong>{name}</strong><span>{slot.order?.code}{slot.item ? ` · ${handoffLabel(slot.item, days)}` : ''}</span></span>
          <span className={styles.status} data-status={tone}>{status}<span aria-hidden="true"> →</span></span>
        </button>
      </li>
    })}
  </ul>
}
