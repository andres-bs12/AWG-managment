import { petNameFromBack } from './petName.ts'

type Translate = (key: string, vars?: Record<string, string | number>) => string
export type TitledOrnament = { kind?: 'custom' | 'finished'; backName?: string; petName?: string }

/** The name a customer gave an ornament, written the way it reads on the order: "LUNA" -> "Luna". */
export function ornamentName(item: TitledOrnament): string {
  return petNameFromBack(item.backName ?? '') || (item.petName ?? '').trim()
}

/**
 * Review card title. One ornament is "Luna" or "Deine Kugel" (never "Kugel 1"); with several the
 * number stays so the cards match the editor headings: "Kugel 2 – Luna".
 */
export function reviewTitle(item: TitledOrnament, index: number, count: number, t: Translate): string {
  const name = ornamentName(item)
  if (count > 1) return `${t('ornamentN', { n: index + 1 })}${name ? ` – ${name}` : ''}`
  return name || t('formOrnamentsOne')
}

/** Track receipt line: the name, else "Not personalised" only for ready-made ornaments, else "Kugel n" / "Deine Kugel". */
export function receiptTitle(item: TitledOrnament, index: number, count: number, t: Translate): string {
  const name = ornamentName(item)
  if (name) return name
  if (item.kind === 'finished') return t('itemNotPersonalised')
  return count > 1 ? t('ornamentN', { n: index + 1 }) : t('formOrnamentsOne')
}
