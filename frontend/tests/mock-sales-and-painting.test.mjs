import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, watch: null, ws: false },
})
after(() => server.close())

const { createSeed, STORAGE_KEY } = await server.ssrLoadModule('/src/api/mock/seed.ts')
const seed = createSeed()
const today = '2026-11-28'
seed.paintingDays[today] = { open: true, openHour: 17, closeHour: 18 }
seed.blocks = seed.blocks.filter(block => block.id === 'blk-106' || block.id === 'blk-103')
Object.assign(seed.blocks.find(block => block.id === 'blk-106'), { startHour: 17, endHour: 18 })
seed.soldOnMarketDays['ord-100'] = 'md-spittelberg-28'
seed.orders.find(order => order.id === 'ord-101').source = 'web'
delete seed.soldOnMarketDays['ord-102']

const values = new Map([[STORAGE_KEY, JSON.stringify(seed)]])
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key),
} })
const store = await server.ssrLoadModule('/src/api/mock/store.ts')

test('mock Ready releases the original booking and undo keeps its recorded interval', async () => {
  const block = () => store.getOrderBundle('ord-106').blocks[0]
  assert.equal(store.findFreeSlot(today, 1).ok, false)
  store.setItemStatus('ord-106', 'orn-106', 'finished')
  assert.deepEqual([block().startHour, block().endHour], [15, 15.25])
  assert.deepEqual(store.findFreeSlot(today, 1).slot, { date: today, startHour: 17, endHour: 18 })
  store.setItemStatus('ord-106', 'orn-106', 'finished')
  store.setItemStatus('ord-106', 'orn-106', 'not_started')
  assert.deepEqual([block().startHour, block().endHour], [15, 15.25])

  store.setItemStatus('ord-103', 'orn-103', 'finished')
  const future = store.getOrderBundle('ord-103').blocks[0]
  assert.deepEqual([future.startHour, future.endHour], [10, 11.25])
  assert.deepEqual(store.findFreeSlot('2026-11-30', 1).slot, { date: '2026-11-30', startHour: 10, endHour: 11 })
  const sale = await store.createSale({
    soldOnMarketDayId: 'md-28',
    customerName: 'New appointment',
    items: [{ kind: 'custom', size: 'big', color: 'red', finish: 'matte', withName: false, deliveryKind: 'market',
      marketDayId: 'md-04', pickupHour: 14, paintDate: '2026-11-30', paintStart: 10, paintEnd: 11 }],
  })
  assert.ok(sale.code)
  assert.throws(() => store.setItemStatus('ord-103', 'orn-103', 'not_started'), /Another session has booked/)
})

test('mock sales reports the selling stall, photos, and nullable market for web and legacy orders', () => {
  const byCode = (query) => store.listSales({ query }).orders[0]
  const sale = byCode('AWG0100')
  assert.equal(sale.soldAtMarketName, 'Christkindlmarkt Spittelberg')
  assert.equal(sale.saleItems[0].kind, 'custom')
  assert.equal(sale.saleItems[0].color, 'red')
  assert.equal(sale.saleItems[0].photoUrl, seed.items.find(item => item.id === 'orn-100').photos[0].dataUrl)
  assert.equal(byCode('AWG0101').soldAtMarketName, null)
  assert.equal(byCode('AWG0102').soldAtMarketName, null)
})

test('mock web Post checkout reserves planned paint blocks so a second purchase cannot reuse the same last slot', () => {
  // Close every painting day in the season except one day with a single 1-hour slot (2026-11-30 10:00–11:00).
  const day = new Date('2026-11-21T12:00:00Z')
  while (day.toISOString().slice(0, 10) <= '2026-12-24') {
    const iso = day.toISOString().slice(0, 10)
    store.updatePaintingDay(iso, false)
    day.setUTCDate(day.getUTCDate() + 1)
  }
  // 2026-11-30 already has a booked block from the earlier test; open 2026-12-03 with exactly 1 hour (10:00–11:00).
  store.updatePaintingDay('2026-12-03', true, { openHour: 10, closeHour: 11 })

  const items = [{ kind: 'custom', size: 'medium', color: 'red', finish: 'shiny', withName: false, petName: 'Luna', photos: [] }]
  const quote1 = store.getShippingQuote(items)
  assert.equal(quote1.available, true)
  assert.equal(quote1.collectionDate, '2026-12-04')

  const checkout1 = store.createMockCheckout({
    customerName: 'First Buyer',
    email: 'first@example.at',
    phone: '+43 660 1111111',
    deliveryKind: 'post',
    address: { line1: 'Herrengasse 1', postalCode: '8010', city: 'Graz' },
    expectedArrivalTo: quote1.arrivalTo,
    acceptTerms: true,
    items,
  })
  const order1 = store.getOrderByCode(checkout1.orderCode)
  const bundle1 = store.getOrderBundle(order1.id)
  assert.equal(bundle1.blocks.length, 1)
  assert.deepEqual([bundle1.blocks[0].startHour, bundle1.blocks[0].endHour], [10, 11])

  // The single slot on 2026-12-03 is now taken: a second quote and checkout must see shipping unavailable.
  const quote2 = store.getShippingQuote(items)
  assert.equal(quote2.available, false)
  assert.throws(
    () => store.createMockCheckout({
      customerName: 'Second Buyer',
      email: 'second@example.at',
      phone: '+43 660 2222222',
      deliveryKind: 'post',
      address: { line1: 'Herrengasse 2', postalCode: '8010', city: 'Graz' },
      expectedArrivalTo: quote1.arrivalTo,
      acceptTerms: true,
      items,
    }),
    err => err && err.code === 'SHIPPING_UNAVAILABLE',
  )
})
