import type { AgendaSlot } from '../domain/types'

/** Interval partitioning: preserve every overlapping slot, with a lane for each concurrent block. */
export function layoutAgendaSlots(slots: AgendaSlot[]) {
  const result = new Map<string, { lane: number; lanes: number }>()
  let cluster: { id: string; lane: number }[] = []
  let ends: number[] = []
  const flush = () => { for (const entry of cluster) result.set(entry.id, { lane: entry.lane, lanes: ends.length }); cluster = []; ends = [] }
  for (const slot of [...slots].sort((a, b) => a.block.startHour - b.block.startHour)) {
    const { id, startHour, endHour } = slot.block
    if (ends.length && startHour >= Math.max(...ends)) flush()
    let lane = ends.findIndex(end => end <= startHour)
    if (lane < 0) lane = ends.length
    ends[lane] = endHour
    cluster.push({ id, lane })
  }
  flush()
  return result
}
