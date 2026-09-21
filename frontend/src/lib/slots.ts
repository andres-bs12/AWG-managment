import { hoursOverlap } from './time'

/** Paint window used for overlap checks (single-column agenda). */
export type PaintRange = {
  id: string
  startHour: number
  endHour: number
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
