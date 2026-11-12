import { useEffect, useState } from 'react'
import { useMockStoreVersion } from 'demo-source'

/** Invalidate HTTP reads after mutations and keep multiple stall devices current. */
export function useStaffRefresh() {
  const mockVersion = useMockStoreVersion()
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const refresh = () => setVersion(value => value + 1)
    const visible = () => { if (document.visibilityState === 'visible') refresh() }
    const timer = window.setInterval(visible, 60_000)
    window.addEventListener('focus', refresh)
    window.addEventListener('awg-staff-data-changed', refresh)
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('awg-staff-data-changed', refresh)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [])
  return `${mockVersion}:${version}`
}
