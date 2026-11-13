/** Days between two ISO dates (YYYY-MM-DD), computed in UTC so no DST shift moves a day. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
}

/**
 * Splits the dates from `today` to the last of `dates` into ranges the API accepts
 * (the painting-days endpoint refuses more than `maxSpan` days). Past dates are skipped:
 * a sale never books them, and one old market day must not make the whole range too long.
 */
export function upcomingWindows(dates: string[], today: string, maxSpan = 62): Array<[string, string]> {
  if (!dates.length) return []
  const sorted = [...dates].sort()
  const start = sorted[0] > today ? sorted[0] : today
  const end = sorted.at(-1)!
  if (end < start) return []
  const windows: Array<[string, string]> = []
  for (let from = start; from <= end; from = addDays(from, maxSpan + 1)) {
    const to = daysBetween(from, end) > maxSpan ? addDays(from, maxSpan) : end
    windows.push([from, to])
  }
  return windows
}
