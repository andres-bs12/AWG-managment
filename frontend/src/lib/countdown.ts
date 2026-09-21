export type ChristmasCountdown = {
  /** True for the whole of 25 December, when a greeting beats a clock. */
  isChristmas: boolean
  days: number
  hours: number
  minutes: number
  seconds: number
}

/** Counts down to 25 December in the visitor's own time zone (Vienna for the stall's customers). */
export function christmasCountdown(now: Date = new Date()): ChristmasCountdown {
  const year = now.getFullYear()
  const christmas = new Date(year, 11, 25, 0, 0, 0, 0)
  const dayAfter = new Date(year, 11, 26, 0, 0, 0, 0)

  if (now >= christmas && now < dayAfter) {
    return { isChristmas: true, days: 0, hours: 0, minutes: 0, seconds: 0 }
  }

  const target = now < christmas ? christmas : new Date(year + 1, 11, 25, 0, 0, 0, 0)
  const total = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000))

  return {
    isChristmas: false,
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  }
}
