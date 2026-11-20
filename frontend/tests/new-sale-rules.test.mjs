import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, watch: null, ws: false },
})
after(() => server.close())

const {
  earliestPickupHourAfterPaint,
  isMarketDayValidForItems,
  isPickupInPast,
  isSlotInPast,
  latestLockedPaintDate,
  lockedPaintMinHourOnDate,
  PAINT_HANDLING_HOURS,
  paintFitsHandoff,
  reconcileDraftWithClockAndAgenda,
  syncSharedDelivery,
  validMarketPickupHours,
} = await server.ssrLoadModule('/src/lib/newSaleRules.ts')
const { applySlot, buildDraftFromParams, makeCustom, makeCustomFromSlot, makeFinished, SALE_DRAFT_KEY, toCreateItems } = await server.ssrLoadModule('/src/pages/staff/saleDraft.ts')
const { viennaClock } = await server.ssrLoadModule('/src/lib/viennaClock.ts')

const rathaus = { id: 'mkt-rathaus', name: 'Rathausplatz', kind: 'market', totalCost: 2400, startDate: '2026-11-25', finishDate: '2026-12-06', stall: 12 }
const spittelberg = { id: 'mkt-spittelberg', name: 'Spittelberg', kind: 'market', totalCost: 900, startDate: '2026-11-25', finishDate: '2026-11-29', stall: 4 }
const casa = { id: 'mkt-casa', name: 'Casa', kind: 'home', totalCost: 0, startDate: null, finishDate: null, stall: null }
const markets = [rathaus, spittelberg, casa]

const satRathaus = { id: 'md-sat-r', marketId: 'mkt-rathaus', date: '2026-11-28', openHour: 12, closeHour: 19, isToday: true }
const satSpit = { id: 'md-sat-s', marketId: 'mkt-spittelberg', date: '2026-11-28', openHour: 13, closeHour: 20, isToday: true }
const sunRathaus = { id: 'md-sun-r', marketId: 'mkt-rathaus', date: '2026-11-29', openHour: 12, closeHour: 19, isToday: false }
const sunSpit = { id: 'md-sun-s', marketId: 'mkt-spittelberg', date: '2026-11-29', openHour: 13, closeHour: 20, isToday: false }
const monCasa = { id: 'md-mon', marketId: 'mkt-casa', date: '2026-11-30', openHour: 10, closeHour: 13, isToday: false }
const wedCasa = { id: 'md-wed', marketId: 'mkt-casa', date: '2026-12-02', openHour: 10, closeHour: 12, isToday: false }
const friRathaus = { id: 'md-fri-r', marketId: 'mkt-rathaus', date: '2026-12-04', openHour: 12, closeHour: 19, isToday: false }
const days = [satRathaus, satSpit, sunRathaus, sunSpit, monCasa, wedCasa, friRathaus]

const agendaDays = days.map(day => ({
  marketDay: day,
  market: markets.find(m => m.id === (day.date === '2026-11-28' || day.date === '2026-11-29' ? 'mkt-rathaus' : day.marketId)),
  slots: [],
  deliveries: [],
}))

const ctx = {
  currentDate: '2026-11-28',
  nowHour: 13.5,
  firstPaintDate: '2026-11-28',
  days,
  markets,
  agendaDays,
  activeMarket: rathaus,
  seasonEnd: '2026-12-24',
}

test('Rule 1: calendar hold Sunday 15:00 requires +15 min handling, skips earlier days, and picks painting market', () => {
  assert.equal(PAINT_HANDLING_HOURS, 0.25)
  assert.equal(earliestPickupHourAfterPaint(16), 17)
  assert.equal(earliestPickupHourAfterPaint(15.75), 16)

  const item = makeCustomFromSlot('2026-11-29', 15, 16)
  assert.equal(item.delivery.pickupDate, '2026-11-29')
  assert.equal(item.delivery.pickupHour, 17)

  assert.equal(isMarketDayValidForItems(satRathaus, [item], '2026-11-28', 13.5, '2026-11-28', agendaDays), false)
  assert.equal(isMarketDayValidForItems(sunSpit, [item], '2026-11-28', 13.5, '2026-11-28', agendaDays), false)
  assert.equal(isMarketDayValidForItems(sunRathaus, [item], '2026-11-28', 13.5, '2026-11-28', agendaDays), true)
  assert.deepEqual(validMarketPickupHours(sunRathaus, [item], '2026-11-28', 13.5), [17, 18])

  // Even if active stall is Spittelberg, reconciling a Sunday 15:00 slot chooses Rathausplatz (where Gaby paints).
  const res = reconcileDraftWithClockAndAgenda(
    { items: [item], differentPickups: false, phase: 'delivery' },
    { ...ctx, activeMarket: spittelberg },
  )
  assert.equal(res.draft.items[0].delivery.marketId, 'mkt-rathaus')
  assert.equal(res.draft.items[0].delivery.marketDayId, 'md-sun-r')
  assert.equal(res.draft.items[0].delivery.pickupHour, 17)

  // A late Sunday slot (18:00-19:00) leaves no Sunday pickup hour >= 19:15, so pickup advances to Fri 4 Dec.
  const late = makeCustomFromSlot('2026-11-29', 18, 19)
  assert.equal(isMarketDayValidForItems(sunRathaus, [late], '2026-11-28', 13.5, '2026-11-28', agendaDays), false)
  const lateRes = reconcileDraftWithClockAndAgenda({ items: [late], differentPickups: false, phase: 'delivery' }, ctx)
  assert.equal(lateRes.draft.items[0].delivery.pickupDate, '2026-12-04')
  assert.equal(lateRes.draft.items[0].delivery.pickupHour, null)
})

test('Rule 2 & 9: past paint slots and past pickups are dropped with a notice and never survive reload', () => {
  const yesterday = makeCustomFromSlot('2026-11-27', 13, 14)
  assert.equal(isSlotInPast(yesterday, '2026-11-28', 10), true)

  const passedToday = makeCustomFromSlot('2026-11-28', 13, 14)
  assert.equal(isSlotInPast(passedToday, '2026-11-28', 13.5), true)
  assert.equal(isPickupInPast(passedToday.delivery, '2026-11-28', 16), true)

  const res = reconcileDraftWithClockAndAgenda(
    { items: [passedToday], differentPickups: false, phase: 'delivery' },
    { ...ctx, nowHour: 13.5 },
  )
  assert.equal(res.changed, true)
  assert.ok(res.notice)
  assert.equal(res.draft.items[0].slotLocked, false)
  assert.equal(res.draft.items[0].paintStart, undefined)
  assert.equal(res.draft.items[0].delivery.pickupDate, '2026-11-28')
})

test('Rule 3 & 5: same-day paint requires >= 15 min before pickup and legacy Vienna drafts migrate to Post', () => {
  const item = makeCustom({ paintDate: '2026-11-29', paintStart: 13, paintEnd: 14, slotLocked: true })
  assert.equal(paintFitsHandoff(item, { mode: 'market', pickupDate: '2026-11-29', pickupHour: 14 }), false)
  assert.equal(paintFitsHandoff(item, { mode: 'market', pickupDate: '2026-11-29', pickupHour: 15 }), true)

  const qtrItem = makeCustom({ paintDate: '2026-11-29', paintStart: 12.75, paintEnd: 13.75, slotLocked: true })
  assert.equal(paintFitsHandoff(qtrItem, { mode: 'market', pickupDate: '2026-11-29', pickupHour: 14 }), true)
  assert.equal(paintFitsHandoff(item, { mode: 'post' }), true)

  const postApplied = applySlot(makeCustom({ delivery: { mode: 'post' } }), '2026-12-02', 10, 11)
  assert.equal(postApplied.delivery.mode, 'post')
  assert.equal(postApplied.delivery.pickupDate, undefined)

  // Legacy Vienna draft in sessionStorage migrates to Post, keeps address, drops Vienna date, and never submits vienna.
  const store = new Map()
  globalThis.sessionStorage = {
    getItem: key => store.get(key) ?? null,
    setItem: (key, val) => store.set(key, val),
    removeItem: key => store.delete(key),
  }
  const legacyAddress = { line1: 'Mariahilfer Str. 10', postalCode: '1070', city: 'Wien' }
  store.set(SALE_DRAFT_KEY, JSON.stringify({
    differentPickups: false,
    phase: 'delivery',
    items: [{
      ...makeCustom({ paintDate: '2026-11-30', paintStart: 10, paintEnd: 11, slotLocked: true }),
      delivery: { mode: 'vienna', pickupDate: '2026-12-02', marketDayId: 'md-wed', address: legacyAddress },
    }],
  }))
  const restored = buildDraftFromParams(new URLSearchParams())
  assert.equal(restored.items[0].delivery.mode, 'post')
  assert.equal(restored.items[0].delivery.pickupDate, undefined)
  assert.equal(restored.items[0].delivery.marketDayId, undefined)
  assert.deepEqual(restored.postAddress, legacyAddress)

  const payload = toCreateItems(restored.items, days, satRathaus, restored.postAddress)
  assert.equal(payload[0].deliveryKind, 'post')
  assert.deepEqual(payload[0].address, legacyAddress)
})

test('Rule 4: multi-item shared pickup uses latest locked paint end and syncing merges cleanly', () => {
  const first = makeCustomFromSlot('2026-11-28', 13, 14)
  const second = makeCustomFromSlot('2026-11-29', 15, 16)
  assert.equal(latestLockedPaintDate([first, second]), '2026-11-29')
  assert.equal(lockedPaintMinHourOnDate([first, second], '2026-11-29'), 16.25)
  assert.deepEqual(validMarketPickupHours(sunRathaus, [first, second], '2026-11-28', 13.5), [17, 18])

  const synced = syncSharedDelivery([first, second], ctx)
  assert.equal(synced[0].delivery.pickupDate, '2026-11-29')
  assert.equal(synced[0].delivery.pickupHour, 17)
  assert.equal(synced[1].delivery.pickupDate, '2026-11-29')
  assert.equal(synced[1].delivery.pickupHour, 17)
})

test('Rule 6 & 7 & 10: finished defaults to now and Europe/Vienna midnight rolls over date', () => {
  const fin = makeFinished('RM01')
  assert.equal(fin.delivery.mode, 'now')

  const beforeMidnight = viennaClock(new Date('2026-11-28T22:50:00Z'))
  const afterMidnight = viennaClock(new Date('2026-11-28T23:05:00Z'))
  assert.equal(beforeMidnight.date, '2026-11-28')
  assert.equal(afterMidnight.date, '2026-11-29')

  const satSale = makeCustom({ delivery: { mode: 'market', pickupDate: '2026-11-28', marketDayId: 'md-sat-r', marketId: 'mkt-rathaus', pickupHour: 18 } })
  const rolled = reconcileDraftWithClockAndAgenda(
    { items: [satSale], differentPickups: false, phase: 'delivery' },
    { ...ctx, currentDate: afterMidnight.date, nowHour: afterMidnight.hour, firstPaintDate: afterMidnight.date },
  )
  assert.equal(rolled.draft.items[0].delivery.pickupDate, '2026-11-29')
  assert.equal(rolled.draft.items[0].delivery.pickupHour, null)
})
