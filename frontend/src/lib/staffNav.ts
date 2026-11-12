const HUB_KEY = 'awg-staff-hub'
const HUBS: Record<string, string> = {
  '/staff/agenda': 'Agenda',
  '/staff/deliveries': 'Deliveries',
  '/staff/markets': 'Markets',
  '/staff/search': 'Search orders',
  '/staff/attention': 'Needs attention',
  '/staff/inventory': 'Stock',
  '/staff/painting-days': 'Painting days',
  '/staff/sales/new': 'New sale',
  '/staff/sales': 'Sales',
}

function hubFor(path: string) {
  const pathname = path.split(/[?#]/)[0]
  const label = HUBS[pathname]
  const [base, query = ''] = path.split('?')
  const params = new URLSearchParams(query)
  params.delete('fresh')
  return label ? { to: base + (params.size ? `?${params}` : ''), label } : null
}

export function rememberStaffHub(path: string) {
  const hub = hubFor(path)
  if (hub) sessionStorage.setItem(HUB_KEY, hub.to)
}

export function staffHubTarget(from?: string): { to: string; label: string } {
  return hubFor(from || sessionStorage.getItem(HUB_KEY) || '') ?? { to: '/staff/agenda', label: 'Agenda' }
}
