import type { TimeBlock } from '../domain/types'
import { hoursOverlap } from './time'

/** Paint window used for overlap checks (single-column agenda). */
export type PaintRange = {
  id: string
  startHour: number
  endHour: number
}

export function paintElapsedUntil(date: string, today: string, nowHour: number): number {
  if (date < today) return Infinity
  if (date > today) return 0
  // Preserve the rounded quarter recorded when a session is marked Ready.
  return Math.max(0.25, Math.ceil(nowHour * 4) / 4)
}

export function bookedPaintRange(block: TimeBlock, elapsedUntil: number): PaintRange | null {
  const endHour = block.status === 'finished' ? Math.min(block.endHour, elapsedUntil) : block.endHour
  return endHour > block.startHour ? { id: block.id, startHour: block.startHour, endHour } : null
}

export function paintRangeOverlaps(
  startHour: number,
  endHour: number,
  other: PaintRange,
  ignoreId?: string,
): boolean {
  if (ignoreId && other.id === ignoreId) return false
  return hoursOverlap(startHour, endHour, other.startHour, other.endHour)
}

export function overlappingPaintBlock<T extends PaintRange>(
  blocks: T[],
  startHour: number,
  endHour: number,
  ignoreId?: string,
): T | undefined {
  return blocks.find((block) => paintRangeOverlaps(startHour, endHour, block, ignoreId))
}

export function hasPaintOverlap(
  blocks: PaintRange[],
  startHour: number,
  endHour: number,
  ignoreId?: string,
): boolean {
  return Boolean(overlappingPaintBlock(blocks, startHour, endHour, ignoreId))
}

/**
 * Single-column layout: keep earlier blocks, drop later ones that collide.
 * Overlap is not a product behavior — this is only a last-resort paint guard.
 */
export function keepNonOverlapping<T extends PaintRange>(blocks: T[]): T[] {
  const sorted = [...blocks].sort((a, b) => a.startHour - b.startHour || a.endHour - b.endHour)
  const kept: T[] = []
  for (const block of sorted) {
    if (hasPaintOverlap(kept, block.startHour, block.endHour)) continue
    kept.push(block)
  }
  return kept
}
