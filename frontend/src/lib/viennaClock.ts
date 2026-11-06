/** A Vienna wall clock independent of the iPad's timezone, including daylight saving. */
export function viennaClock(instant: Date = new Date()): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant)
  const value = (name: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === name)!.value
  return { date: `${value('year')}-${value('month')}-${value('day')}`, hour: Number(value('hour')) + Number(value('minute')) / 60 }
}
