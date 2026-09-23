const HUB_KEY = 'awg-staff-hub'
const HUBS: Record<string, string> = {
  '/staff/agenda': 'Agenda',
  '/staff/deliveries': 'Deliveries',
  '/staff/markets': 'Markets',
  '/staff/sales/new': 'New sale',
}

function hubFor(path: string) {
  const pathname = path.split(/[?#]/)[0]
  const label = HUBS[pathname]
  return label ? { to: path, label } : null
}

export function rememberStaffHub(path: string) {
  const hub = hubFor(path)
  if (hub) sessionStorage.setItem(HUB_KEY, hub.to)
}

export function staffHubTarget(from?: string): { to: string; label: string } {
  return hubFor(from || sessionStorage.getItem(HUB_KEY) || '') ?? { to: '/staff/agenda', label: 'Agenda' }
}
