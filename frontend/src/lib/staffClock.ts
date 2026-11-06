import { useEffect, useState } from 'react'
import { DEMO_NOW_HOUR } from 'demo-source'
import { viennaClock } from './viennaClock'

export function useStaffClock() {
  const [now, setNow] = useState(() => viennaClock())
  useEffect(() => {
    const tick = () => setNow(viennaClock())
    const timer = window.setInterval(tick, 60_000)
    window.addEventListener('focus', tick)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', tick) }
  }, [])
  return { ...now, hour: DEMO_NOW_HOUR ?? now.hour }
}
