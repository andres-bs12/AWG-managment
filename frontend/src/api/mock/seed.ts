import type {
  Customer,
  Market,
  MarketDay,
  Order,
  OrderItem,
  StaffUser,
  TimeBlock,
} from '../../domain/types'
import { itemCost } from '../../lib/money'

export const DEMO_NOW_HOUR = 15 + 10 / 60
/** v6 discards stale overlap (Bruno/Otto) and refreshes market days (Fri/Wed for Vienna). */
export const STORAGE_KEY = 'awg-mock-store-v6'

export const STAFF_ACCOUNTS: Array<StaffUser & { password: string }> = [
  {
    id: 'staff-gaby',
    name: 'Gaby',
    email: 'gaby@artwithgab.com',
    password: 'gaby',
  },
  {
    id: 'staff-andres',
    name: 'Andres',
    email: 'andres@artwithgab.com',
    password: 'andres',
  },
]

export type MockState = {
  staff: StaffUser[]
  customers: Customer[]
  markets: Market[]
  marketDays: MarketDay[]
  orders: Order[]
  items: OrderItem[]
  blocks: TimeBlock[]
}

function photo(id: string, url: string, name: string) {
  return { id, name, dataUrl: url }
}

export function createSeed(): MockState {
  const staff: StaffUser[] = STAFF_ACCOUNTS.map(({ password: _p, ...u }) => u)

  const markets: Market[] = [
    { id: 'mkt-rathaus', name: 'Rathausplatz', kind: 'market', totalCost: 2400 },
    { id: 'mkt-spittelberg', name: 'Christkindlmarkt Spittelberg', kind: 'market', totalCost: 900 },
    { id: 'mkt-casa', name: 'Casa', kind: 'home', totalCost: 0 },
  ]

  const marketDays: MarketDay[] = [
    { id: 'md-27', marketId: 'mkt-rathaus', date: '2026-11-27', openHour: 12, closeHour: 19, isToday: false },
    { id: 'md-28', marketId: 'mkt-rathaus', date: '2026-11-28', openHour: 12, closeHour: 19, isToday: true },
    { id: 'md-29', marketId: 'mkt-rathaus', date: '2026-11-29', openHour: 12, closeHour: 19, isToday: false },
    { id: 'md-30', marketId: 'mkt-rathaus', date: '2026-11-30', openHour: 12, closeHour: 19, isToday: false },
    { id: 'md-01', marketId: 'mkt-rathaus', date: '2026-12-01', openHour: 12, closeHour: 19, isToday: false },
    { id: 'md-02', marketId: 'mkt-rathaus', date: '2026-12-02', openHour: 12, closeHour: 19, isToday: false },
    { id: 'md-casa-24', marketId: 'mkt-casa', date: '2026-11-24', openHour: 10, closeHour: 13, isToday: false },
    { id: 'md-casa-25', marketId: 'mkt-casa', date: '2026-11-25', openHour: 10, closeHour: 13, isToday: false },
  ]

  const customers: Customer[] = [
    { id: 'cus-sarah', name: 'Sarah Müller', phone: '+43 664 123 4567', email: 'sarah.mueller@example.com' },
    { id: 'cus-thomas', name: 'Thomas Weber', phone: '+43 699 882 1100', email: 't.weber@gmail.com' },
    { id: 'cus-elena', name: 'Elena Novak', phone: '+43 650 445 9900', email: 'elena.novak@outlook.at' },
    { id: 'cus-julia', name: 'Julia Hartmann', phone: '+43 676 554 3210', email: 'julia.h@example.com' },
    { id: 'cus-anna', name: 'Anna Berger', phone: '+43 660 111 2233', email: 'anna.berger@example.at' },
    { id: 'cus-wait', name: 'Walk-in', phone: '+43 660 000 0000', email: 'wait@example.at' },
    { id: 'cus-lukas', name: 'Lukas Fischer', phone: '+43 664 778 9900', email: 'lukas.fischer@example.at' },
  ]

  const dog = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=max&w=1800`

  const items: OrderItem[] = [
    {
      id: 'orn-milo-1',
      orderId: 'ord-111',
      kind: 'custom',
      petName: 'Milo',
      withName: true,
      backName: 'MILO',
      note: '',
      cost: itemCost('custom', true),
      productionStatus: 'in_progress',
      photos: [
        photo('p1', dog('1583511655857-d19b40a7a54e'), 'milo-1.jpg'),
        photo('p2', dog('1548199973-03cce0bbc87b'), 'milo-2.jpg'),
      ],
      formComplete: true,
      delivery: { kind: 'market', marketId: 'mkt-rathaus', marketDayId: 'md-28', pickupHour: 14 },
    },
    {
      id: 'orn-lena-1',
      orderId: 'ord-118',
      kind: 'custom',
      petName: 'Lena',
      withName: true,
      backName: 'LENA',
      note: '',
      cost: itemCost('custom', true),
      productionStatus: 'in_progress',
      photos: [photo('p3', dog('1517849845537-4d257902454a'), 'lena.jpg')],
      formComplete: true,
      delivery: { kind: 'market', marketId: 'mkt-rathaus', marketDayId: 'md-28', pickupHour: 15 },
    },
    {
      id: 'orn-bruno-1',
      orderId: 'ord-118',
      kind: 'custom',
      petName: 'Bruno',
      withName: false,
      backName: '',
      note: '',
      cost: itemCost('custom', false),
      productionStatus: 'finished',
      photos: [photo('p4', dog('1530281700549-e82e7bf110d6'), 'bruno.jpg')],
      formComplete: true,
      delivery: { kind: 'market', marketId: 'mkt-rathaus', marketDayId: 'md-28', pickupHour: 17 },
    },
    {
      id: 'orn-otto-1',
      orderId: 'ord-130',
      kind: 'custom',
      petName: 'Otto',
      withName: true,
      backName: 'OTTO',
      note: '',
      cost: itemCost('custom', true),
      productionStatus: 'in_progress',
      photos: [photo('p5', dog('1583337130417-3346a1be7dee'), 'otto.jpg')],
      formComplete: true,
      delivery: { kind: 'market', marketId: 'mkt-rathaus', marketDayId: 'md-29', pickupHour: 12 },
    },
    {
      id: 'orn-felix-1',
      orderId: 'ord-122',
      kind: 'custom',
      petName: 'Felix',
      withName: false,
      backName: '',
      note: '',
      cost: itemCost('custom', false),
      productionStatus: 'not_started',
      photos: [photo('p6', dog('1574158622682-e40e69881006'), 'felix.jpg')],
      formComplete: true,
      delivery: { kind: 'market', marketId: 'mkt-rathaus', marketDayId: 'md-28', pickupHour: 16.25 },
    },
    {
      id: 'orn-anna-1',
      orderId: 'ord-131',
      kind: 'custom',
      petName: 'Anna',
      withName: true,
      backName: 'ANNA',
      note: 'Please keep the snow hat.',
      cost: itemCost('custom', true),
      productionStatus: 'not_started',
      photos: [photo('p7', dog('1543466835-00a7907e9de1'), 'anna.jpg')],
      formComplete: true,
      delivery: {
        kind: 'vienna',
        address: { line1: 'Kettenbrückengasse 12', city: 'Vienna', postalCode: '1050' },
      },
    },
    {
      id: 'orn-wait-1',
      orderId: 'ord-wait',
      kind: 'custom',
      petName: '',
      withName: true,
      backName: '',
      note: '',
      cost: itemCost('custom', true),
      productionStatus: 'not_started',
      photos: [],
      formComplete: false,
      delivery: { kind: 'market', marketId: 'mkt-rathaus', marketDayId: 'md-28', pickupHour: 18 },
    },
    {
      id: 'orn-nala-1',
      orderId: 'ord-140',
      kind: 'custom',
      petName: 'Nala',
      withName: true,
      backName: 'NALA',
      note: '',
      cost: itemCost('custom', true),
      productionStatus: 'finished',
      photos: [photo('p8', dog('1552053831-71594a27632d'), 'nala.jpg')],
      formComplete: true,
      delivery: { kind: 'market', marketId: 'mkt-rathaus', marketDayId: 'md-28', pickupHour: 18.75 },
    },
  ]

  const orders: Order[] = [
    {
      id: 'ord-111',
      customerId: 'cus-sarah',
      code: 'ABS111',
      trackToken: 'trk-abs111',
      formToken: 'frm-abs111',
      paymentState: 'paid',
      paymentMethod: 'card',
      total: itemCost('custom', true),
      createdAt: '2026-11-28T10:02:00',
      itemIds: ['orn-milo-1'],
    },
    {
      id: 'ord-118',
      customerId: 'cus-thomas',
      code: 'ABS118',
      trackToken: 'trk-abs118',
      formToken: 'frm-abs118',
      paymentState: 'deposit',
      paymentMethod: 'cash',
      total: itemCost('custom', true) + itemCost('custom', false),
      createdAt: '2026-11-28T10:40:00',
      itemIds: ['orn-lena-1', 'orn-bruno-1'],
    },
    {
      id: 'ord-130',
      customerId: 'cus-elena',
      code: 'ABS130',
      trackToken: 'trk-abs130',
      formToken: 'frm-abs130',
      paymentState: 'unpaid',
      paymentMethod: null,
      total: itemCost('custom', true),
      createdAt: '2026-11-28T11:15:00',
      itemIds: ['orn-otto-1'],
    },
    {
      id: 'ord-122',
      customerId: 'cus-julia',
      code: 'ABS122',
      trackToken: 'trk-abs122',
      formToken: 'frm-abs122',
      paymentState: 'paid',
      paymentMethod: 'cash',
      total: itemCost('custom', false),
      createdAt: '2026-11-28T12:01:00',
      itemIds: ['orn-felix-1'],
    },
    {
      id: 'ord-131',
      customerId: 'cus-anna',
      code: 'ABS131',
      trackToken: 'trk-abs131',
      formToken: 'frm-abs131',
      paymentState: 'deposit',
      paymentMethod: 'card',
      total: itemCost('custom', true),
      createdAt: '2026-11-28T13:20:00',
      itemIds: ['orn-anna-1'],
    },
    {
      id: 'ord-wait',
      customerId: 'cus-wait',
      code: 'AWG000',
      trackToken: 'trk-wait',
      formToken: 'frm-wait',
      paymentState: 'unpaid',
      paymentMethod: null,
      total: itemCost('custom', true),
      createdAt: '2026-11-28T14:00:00',
      itemIds: ['orn-wait-1'],
    },
    {
      id: 'ord-140',
      customerId: 'cus-lukas',
      code: 'ABS140',
      trackToken: 'trk-abs140',
      formToken: 'frm-abs140',
      paymentState: 'paid',
      paymentMethod: 'card',
      total: itemCost('custom', true),
      createdAt: '2026-11-28T09:30:00',
      itemIds: ['orn-nala-1'],
    },
  ]

  const blocks: TimeBlock[] = [
    { id: 's-281-1', marketDayId: 'md-28', orderItemId: 'orn-milo-1', startHour: 12, endHour: 13, status: 'in_progress' },
    { id: 's-281-2a', marketDayId: 'md-28', orderItemId: 'orn-lena-1', startHour: 13, endHour: 14.25, status: 'in_progress' },
    { id: 's-281-3', marketDayId: 'md-28', orderItemId: 'orn-felix-1', startHour: 14.5, endHour: 15.5, status: 'not_started' },
    { id: 's-281-2b', marketDayId: 'md-28', orderItemId: 'orn-bruno-1', startHour: 15.5, endHour: 16.5, status: 'finished' },
    // Otto used to be 16:00–17:00 and overlapped Bruno 15:30–16:30. Starts when Bruno ends.
    { id: 's-281-4', marketDayId: 'md-28', orderItemId: 'orn-otto-1', startHour: 16.5, endHour: 17.75, status: 'in_progress' },
    { id: 's-281-5', marketDayId: 'md-29', orderItemId: 'orn-anna-1', startHour: 12, endHour: 13.25, status: 'not_started' },
    { id: 's-281-6', marketDayId: 'md-28', orderItemId: 'orn-nala-1', startHour: 17.75, endHour: 18.75, status: 'finished' },
  ]

  return { staff, customers, markets, marketDays, orders, items, blocks }
}
