import type {
  Customer,
  Market,
  MarketDay,
  Order,
  OrderItem,
  StaffUser,
  TimeBlock,
} from '../../domain/types'
import { homePaintHours, stallHours } from '../../lib/calendar'
import { itemCost } from '../../lib/money'

export const DEMO_NOW_HOUR = 15 + 10 / 60
/** Bump when demo orders change. load() reseeds if revision mismatches. */
export const SEED_REVISION = 11
export const STORAGE_KEY = `awg-mock-store-v${SEED_REVISION}`

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
  seedRevision: number
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
    {
      id: 'mkt-rathaus',
      name: 'Rathausplatz',
      kind: 'market',
      totalCost: 2400,
      startDate: '2026-11-27',
      finishDate: '2026-12-06',
      stall: 12,
    },
    {
      id: 'mkt-spittelberg',
      name: 'Christkindlmarkt Spittelberg',
      kind: 'market',
      totalCost: 900,
      startDate: null,
      finishDate: null,
      stall: null,
    },
    {
      id: 'mkt-casa',
      name: 'Casa',
      kind: 'home',
      totalCost: 0,
      startDate: null,
      finishDate: null,
      stall: null,
    },
  ]

  const stall = stallHours()
  const casa = (date: string) => homePaintHours(date) ?? stall
  const marketDays: MarketDay[] = [
    { id: 'md-27', marketId: 'mkt-rathaus', date: '2026-11-27', ...stall, isToday: false },
    { id: 'md-28', marketId: 'mkt-rathaus', date: '2026-11-28', ...stall, isToday: true },
    { id: 'md-29', marketId: 'mkt-rathaus', date: '2026-11-29', ...stall, isToday: false },
    { id: 'md-casa-30', marketId: 'mkt-casa', date: '2026-11-30', ...casa('2026-11-30'), isToday: false },
    { id: 'md-casa-01', marketId: 'mkt-casa', date: '2026-12-01', ...casa('2026-12-01'), isToday: false },
    { id: 'md-casa-02', marketId: 'mkt-casa', date: '2026-12-02', ...casa('2026-12-02'), isToday: false },
    { id: 'md-casa-03', marketId: 'mkt-casa', date: '2026-12-03', ...casa('2026-12-03'), isToday: false },
    { id: 'md-04', marketId: 'mkt-rathaus', date: '2026-12-04', ...stall, isToday: false },
    { id: 'md-05', marketId: 'mkt-rathaus', date: '2026-12-05', ...stall, isToday: false },
    { id: 'md-06', marketId: 'mkt-rathaus', date: '2026-12-06', ...stall, isToday: false },
  ]

  /**
   * Track demos (codes ABS100+):
   *   ABS100 pickup · In the workshop
   *   ABS101 pickup · Ready to pick up
   *   ABS102 pickup · Handed over
   *   ABS103 Vienna · In the workshop
   *   ABS104 Vienna · Out for delivery
   *   ABS105 Vienna · Handed over
   * Extras: ABS106 not started, ABS107 multi-item workshop, AWG000 form pending.
   */
  const customers: Customer[] = [
    { id: 'cus-100', name: 'Sarah Müller', phone: '+43 664 123 4567', email: 'sarah.mueller@example.com' },
    { id: 'cus-101', name: 'Thomas Weber', phone: '+43 699 882 1100', email: 't.weber@gmail.com' },
    { id: 'cus-102', name: 'Lukas Fischer', phone: '+43 664 778 9900', email: 'lukas.fischer@example.at' },
    { id: 'cus-103', name: 'Anna Berger', phone: '+43 660 111 2233', email: 'anna.berger@example.at' },
    { id: 'cus-104', name: 'Elena Novak', phone: '+43 650 445 9900', email: 'elena.novak@outlook.at' },
    { id: 'cus-105', name: 'Julia Hartmann', phone: '+43 676 554 3210', email: 'julia.h@example.com' },
    { id: 'cus-106', name: 'Felix Graf', phone: '+43 660 222 3344', email: 'felix.graf@example.at' },
    { id: 'cus-107', name: 'Mia Binder', phone: '+43 699 111 7788', email: 'mia.binder@example.at' },
    { id: 'cus-wait', name: 'Walk-in', phone: '+43 660 000 0000', email: 'wait@example.at' },
  ]

  const dog = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=max&w=1800`
  const costName = itemCost('custom', true)
  const costPlain = itemCost('custom', false)

  const items: OrderItem[] = [
    {
      id: 'orn-100',
      orderId: 'ord-100',
      kind: 'custom',
      petName: 'Milo',
      withName: true,
      backName: 'MILO',
      note: '',
      cost: costName,
      productionStatus: 'in_progress',
      photos: [
        photo('p1', dog('1583511655857-d19b40a7a54e'), 'milo-1.jpg'),
        photo('p2', dog('1548199973-03cce0bbc87b'), 'milo-2.jpg'),
      ],
      formComplete: true,
      delivery: { kind: 'market', marketId: 'mkt-rathaus', marketDayId: 'md-28', pickupHour: 14 },
    },
    {
      id: 'orn-101',
      orderId: 'ord-101',
      kind: 'custom',
      petName: 'Bruno',
      withName: false,
      backName: '',
      note: '',
      cost: costPlain,
      productionStatus: 'finished',
      photos: [photo('p3', dog('1530281700549-e82e7bf110d6'), 'bruno.jpg')],
      formComplete: true,
      delivery: { kind: 'market', marketId: 'mkt-rathaus', marketDayId: 'md-28', pickupHour: 15 },
    },
    {
      id: 'orn-102',
      orderId: 'ord-102',
      kind: 'custom',
      petName: 'Nala',
      withName: true,
      backName: 'NALA',
      note: '',
      cost: costName,
      productionStatus: 'finished',
      photos: [photo('p4', dog('1552053831-71594a27632d'), 'nala.jpg')],
      formComplete: true,
      delivery: { kind: 'market', marketId: 'mkt-rathaus', marketDayId: 'md-28', pickupHour: 18.75 },
    },
    {
      id: 'orn-103',
      orderId: 'ord-103',
      kind: 'custom',
      petName: 'Anna',
      withName: true,
      backName: 'ANNA',
      note: 'Please keep the snow hat.',
      cost: costName,
      productionStatus: 'not_started',
      photos: [photo('p5', dog('1543466835-00a7907e9de1'), 'anna.jpg')],
      formComplete: true,
      delivery: {
        kind: 'vienna',
        marketDayId: 'md-casa-02',
        address: { line1: 'Kettenbrückengasse 12', city: 'Vienna', postalCode: '1050' },
      },
    },
    {
      id: 'orn-104',
      orderId: 'ord-104',
      kind: 'custom',
      petName: 'Otto',
      withName: true,
      backName: 'OTTO',
      note: '',
      cost: costName,
      productionStatus: 'finished',
      photos: [photo('p6', dog('1583337130417-3346a1be7dee'), 'otto.jpg')],
      formComplete: true,
      delivery: {
        kind: 'vienna',
        marketDayId: 'md-casa-02',
        address: { line1: 'Margaretenstraße 45', city: 'Vienna', postalCode: '1040' },
      },
    },
    {
      id: 'orn-105',
      orderId: 'ord-105',
      kind: 'custom',
      petName: 'Lena',
      withName: true,
      backName: 'LENA',
      note: '',
      cost: costName,
      productionStatus: 'finished',
      photos: [photo('p7', dog('1517849845537-4d257902454a'), 'lena.jpg')],
      formComplete: true,
      delivery: {
        kind: 'vienna',
        marketDayId: 'md-casa-02',
        address: { line1: 'Neubaugasse 8', line2: 'Stiege 2', city: 'Vienna', postalCode: '1070' },
      },
    },
    {
      id: 'orn-106',
      orderId: 'ord-106',
      kind: 'custom',
      petName: 'Felix',
      withName: false,
      backName: '',
      note: '',
      cost: costPlain,
      productionStatus: 'not_started',
      photos: [photo('p8', dog('1574158622682-e40e69881006'), 'felix.jpg')],
      formComplete: true,
      delivery: { kind: 'market', marketId: 'mkt-rathaus', marketDayId: 'md-28', pickupHour: 16.25 },
    },
    {
      id: 'orn-107a',
      orderId: 'ord-107',
      kind: 'custom',
      petName: 'Pip',
      withName: true,
      backName: 'PIP',
      note: '',
      cost: costName,
      productionStatus: 'in_progress',
      photos: [photo('p9', dog('1548199973-03cce0bbc87b'), 'pip.jpg')],
      formComplete: true,
      delivery: { kind: 'market', marketId: 'mkt-rathaus', marketDayId: 'md-28', pickupHour: 17 },
    },
    {
      id: 'orn-107b',
      orderId: 'ord-107',
      kind: 'custom',
      petName: 'Dot',
      withName: false,
      backName: '',
      note: '',
      cost: costPlain,
      productionStatus: 'finished',
      photos: [photo('p10', dog('1583511655857-d19b40a7a54e'), 'dot.jpg')],
      formComplete: true,
      delivery: { kind: 'market', marketId: 'mkt-rathaus', marketDayId: 'md-28', pickupHour: 17 },
    },
    {
      id: 'orn-wait',
      orderId: 'ord-wait',
      kind: 'custom',
      petName: '',
      withName: true,
      backName: '',
      note: '',
      cost: costName,
      productionStatus: 'not_started',
      photos: [],
      formComplete: false,
      delivery: { kind: 'market', marketId: 'mkt-rathaus', marketDayId: 'md-28', pickupHour: 18 },
    },
  ]

  const orders: Order[] = [
    {
      id: 'ord-100',
      customerId: 'cus-100',
      code: 'ABS100',
      trackToken: 'trk-abs100',
      formToken: 'frm-abs100',
      paymentState: 'paid',
      paymentMethod: 'card',
      total: costName,
      createdAt: '2026-11-28T10:02:00',
      itemIds: ['orn-100'],
      handedOver: false,
    },
    {
      id: 'ord-101',
      customerId: 'cus-101',
      code: 'ABS101',
      trackToken: 'trk-abs101',
      formToken: 'frm-abs101',
      paymentState: 'paid',
      paymentMethod: 'cash',
      total: costPlain,
      createdAt: '2026-11-28T10:20:00',
      itemIds: ['orn-101'],
      handedOver: false,
    },
    {
      id: 'ord-102',
      customerId: 'cus-102',
      code: 'ABS102',
      trackToken: 'trk-abs102',
      formToken: 'frm-abs102',
      paymentState: 'paid',
      paymentMethod: 'card',
      total: costName,
      createdAt: '2026-11-28T09:30:00',
      itemIds: ['orn-102'],
      handedOver: true,
    },
    {
      id: 'ord-103',
      customerId: 'cus-103',
      code: 'ABS103',
      trackToken: 'trk-abs103',
      formToken: 'frm-abs103',
      paymentState: 'deposit',
      paymentMethod: 'card',
      total: costName,
      createdAt: '2026-11-28T11:00:00',
      itemIds: ['orn-103'],
      handedOver: false,
    },
    {
      id: 'ord-104',
      customerId: 'cus-104',
      code: 'ABS104',
      trackToken: 'trk-abs104',
      formToken: 'frm-abs104',
      paymentState: 'paid',
      paymentMethod: 'card',
      total: costName,
      createdAt: '2026-11-28T11:30:00',
      itemIds: ['orn-104'],
      handedOver: false,
    },
    {
      id: 'ord-105',
      customerId: 'cus-105',
      code: 'ABS105',
      trackToken: 'trk-abs105',
      formToken: 'frm-abs105',
      paymentState: 'paid',
      paymentMethod: 'cash',
      total: costName,
      createdAt: '2026-11-28T12:00:00',
      itemIds: ['orn-105'],
      handedOver: true,
    },
    {
      id: 'ord-106',
      customerId: 'cus-106',
      code: 'ABS106',
      trackToken: 'trk-abs106',
      formToken: 'frm-abs106',
      paymentState: 'paid',
      paymentMethod: 'cash',
      total: costPlain,
      createdAt: '2026-11-28T12:30:00',
      itemIds: ['orn-106'],
      handedOver: false,
    },
    {
      id: 'ord-107',
      customerId: 'cus-107',
      code: 'ABS107',
      trackToken: 'trk-abs107',
      formToken: 'frm-abs107',
      paymentState: 'deposit',
      paymentMethod: 'cash',
      total: costName + costPlain,
      createdAt: '2026-11-28T13:00:00',
      itemIds: ['orn-107a', 'orn-107b'],
      handedOver: false,
    },
    {
      id: 'ord-wait',
      customerId: 'cus-wait',
      code: 'AWG000',
      trackToken: 'trk-wait',
      formToken: 'frm-wait',
      paymentState: 'unpaid',
      paymentMethod: null,
      total: costName,
      createdAt: '2026-11-28T14:00:00',
      itemIds: ['orn-wait'],
      handedOver: false,
    },
  ]

  const blocks: TimeBlock[] = [
    { id: 'blk-100', marketDayId: 'md-28', orderItemId: 'orn-100', startHour: 12, endHour: 13.25, status: 'in_progress' },
    { id: 'blk-101', marketDayId: 'md-28', orderItemId: 'orn-101', startHour: 13.25, endHour: 14.25, status: 'finished' },
    { id: 'blk-106', marketDayId: 'md-28', orderItemId: 'orn-106', startHour: 14.5, endHour: 15.5, status: 'not_started' },
    { id: 'blk-107a', marketDayId: 'md-28', orderItemId: 'orn-107a', startHour: 15.5, endHour: 16.75, status: 'in_progress' },
    { id: 'blk-107b', marketDayId: 'md-28', orderItemId: 'orn-107b', startHour: 16.75, endHour: 17.75, status: 'finished' },
    { id: 'blk-102', marketDayId: 'md-28', orderItemId: 'orn-102', startHour: 17.75, endHour: 18.75, status: 'finished' },
    { id: 'blk-103', marketDayId: 'md-casa-30', orderItemId: 'orn-103', startHour: 10, endHour: 11.25, status: 'not_started' },
    { id: 'blk-104', marketDayId: 'md-casa-01', orderItemId: 'orn-104', startHour: 10, endHour: 11.25, status: 'finished' },
    { id: 'blk-105', marketDayId: 'md-casa-01', orderItemId: 'orn-105', startHour: 11.25, endHour: 12, status: 'finished' },
  ]

  return { seedRevision: SEED_REVISION, staff, customers, markets, marketDays, orders, items, blocks }
}
