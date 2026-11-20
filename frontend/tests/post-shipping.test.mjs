import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AUSTRIAN_POSTAL_REGEX,
  arrivalFor,
  formatArrivalRange,
  formatArrivalWithWeekdays,
  isAustrianHoliday,
  isCollectionOn,
  isWorkingDay,
  nextCollectionAfter,
  planPostShipping,
  postTrackingUrl,
  shippingWindowAfter,
} from '../src/lib/postShipping.ts'

test('worked examples: plans collections strictly after readyOn, rolls 8 Dec holiday, and enforces 23 Dec cutoff', () => {
  const cases = [
    // [readyOn, collectionDate, arrivalFrom, arrivalTo, available]
    ['2026-11-20', '2026-12-01', '2026-12-03', '2026-12-04', true],
    ['2026-11-29', '2026-12-01', '2026-12-03', '2026-12-04', true],
    ['2026-11-30', '2026-12-01', '2026-12-03', '2026-12-04', true],
    ['2026-12-01', '2026-12-04', '2026-12-09', '2026-12-10', true],
    ['2026-12-06', '2026-12-09', '2026-12-11', '2026-12-14', true],
    ['2026-12-10', '2026-12-11', '2026-12-15', '2026-12-16', true],
    ['2026-12-17', '2026-12-18', '2026-12-22', '2026-12-23', true],
    ['2026-12-18', '2026-12-22', '2026-12-24', '2026-12-28', false],
    ['2026-12-21', '2026-12-22', '2026-12-24', '2026-12-28', false],
  ]
  for (const [ready, collection, from, to, available] of cases) {
    assert.equal(nextCollectionAfter(ready), collection, `nextCollectionAfter(${ready})`)
    assert.deepEqual(arrivalFor(collection), { collectionDate: collection, arrivalFrom: from, arrivalTo: to })
    assert.deepEqual(
      shippingWindowAfter(ready),
      available
        ? { available: true, collectionDate: collection, arrivalFrom: from, arrivalTo: to }
        : { available: false, collectionDate: null, arrivalFrom: null, arrivalTo: null },
    )
  }
})

test('Post can collect on deliveries-from (2026-11-30) when Monday is a configured weekday', () => {
  assert.equal(
    nextCollectionAfter('2026-11-27', { collectionDays: ['monday'] }),
    '2026-11-30',
  )
})

test('a collection weekday on a holiday shifts to the next working day', () => {
  // Ready Sun 6 Dec 2026: Tue 8 Dec is a holiday, so the Post collects Wed 9 Dec and delivers Fri 11 – Mon 14 Dec.
  assert.deepEqual(shippingWindowAfter('2026-12-06'), {
    available: true, collectionDate: '2026-12-09', arrivalFrom: '2026-12-11', arrivalTo: '2026-12-14',
  })
  assert.equal(isCollectionOn('2026-12-08'), false)
  assert.equal(isCollectionOn('2026-12-09'), true)
  assert.equal(isCollectionOn('2026-12-10'), false)
  // Fri 25 Dec is a holiday (26 Dec too, then the weekend): its collection shifts to Mon 28 Dec.
  assert.equal(isCollectionOn('2026-12-28'), true)
  // Fri 1 Jan 2027 is a holiday: shifts to Mon 4 Jan, with no seasonal cap on the pure date rule.
  assert.equal(nextCollectionAfter('2026-12-31', { collectionsFrom: null }), '2027-01-04')
})

test('per-date collection overrides add or cancel a collection', () => {
  assert.equal(nextCollectionAfter('2026-11-30', { overrides: { '2026-12-01': false } }), '2026-12-04')
  assert.equal(nextCollectionAfter('2026-11-30', { overrides: { '2026-12-03': true, '2026-12-01': false } }), '2026-12-03')
  // Overrides on non-working days are ignored, like the backend.
  assert.equal(isCollectionOn('2026-12-08', { overrides: { '2026-12-08': true } }), false)
  assert.equal(nextCollectionAfter('2026-12-06', { overrides: { '2026-12-09': false } }), '2026-12-11')
})

test('recognizes fixed and Easter-based Austrian public holidays across years', () => {
  const holidays = [
    '2026-01-01', '2026-01-06', '2026-04-06', '2026-05-01', '2026-05-14', '2026-05-25',
    '2026-06-04', '2026-08-15', '2026-10-26', '2026-11-01', '2026-12-08', '2026-12-25',
    '2026-12-26', '2027-03-29', '2027-05-06', '2027-05-17', '2027-05-27',
  ]
  for (const date of holidays) {
    assert.equal(isAustrianHoliday(date), true, `${date} should be a holiday`)
    assert.equal(isWorkingDay(date), false, `${date} should not be a working day`)
  }
  assert.equal(isWorkingDay('2026-12-24'), true)
  assert.equal(isWorkingDay('2026-12-27'), false)
})

test('planPostShipping advances to the next collection window when earlier paint days are full and rejects past cutoff', () => {
  const openAll = () => ({ startHour: 10, endHour: 11 })
  // Sat 28 Nov order -> painted Sun 29 / Mon 30 Nov -> collected Tue 1 Dec -> arrives 3..4 Dec
  assert.deepEqual(
    planPostShipping({
      today: '2026-11-28',
      items: [{ kind: 'custom', withName: true }],
      findSlot: openAll,
    }).quote,
    { available: true, collectionDate: '2026-12-01', arrivalFrom: '2026-12-03', arrivalTo: '2026-12-04' },
  )

  // If 29 and 30 Nov are full, Tue 1 Dec collection cannot be met; rolls to Fri 4 Dec collection (arrives 9..10 Dec because 8 Dec is a holiday)
  assert.deepEqual(
    planPostShipping({
      today: '2026-11-28',
      items: [{ kind: 'custom', withName: false }],
      findSlot: date => (date <= '2026-11-30' ? null : { startHour: 10, endHour: 11 }),
    }).quote,
    { available: true, collectionDate: '2026-12-04', arrivalFrom: '2026-12-09', arrivalTo: '2026-12-10' },
  )

  // Wed 16 Dec is the last order day for fixed Tue/Fri when Thu 17 Dec has capacity
  assert.deepEqual(
    planPostShipping({
      today: '2026-12-16',
      items: [{ kind: 'custom', withName: false }],
      findSlot: openAll,
    }).quote,
    { available: true, collectionDate: '2026-12-18', arrivalFrom: '2026-12-22', arrivalTo: '2026-12-23' },
  )

  // Thu 17 Dec order misses Fri 18 Dec collection (painting starts 18 Dec, strictly before collection) -> unavailable
  assert.deepEqual(
    planPostShipping({
      today: '2026-12-17',
      items: [{ kind: 'custom', withName: false }],
      findSlot: openAll,
    }).quote,
    { available: false, collectionDate: null, arrivalFrom: null, arrivalTo: null },
  )
})

test('formats arrival ranges in German and English per contract', () => {
  assert.equal(formatArrivalWithWeekdays('2026-12-03', '2026-12-04', 'de'), 'Do, 3. – Fr, 4. Dezember')
  assert.equal(formatArrivalWithWeekdays('2026-12-03', '2026-12-04', 'en'), 'Thu 3 – Fri 4 December')
  assert.equal(formatArrivalWithWeekdays('2026-11-30', '2026-12-02', 'de'), 'Mo, 30. November – Mi, 2. Dezember')
  assert.equal(formatArrivalWithWeekdays('2026-11-30', '2026-12-02', 'en'), 'Mon 30 November – Wed 2 December')

  assert.equal(formatArrivalRange('2026-12-03', '2026-12-04', 'de'), '3.–4. Dezember')
  assert.equal(formatArrivalRange('2026-12-03', '2026-12-04', 'en'), '3–4 December')
  assert.equal(formatArrivalRange('2026-12-03', '2026-12-04', 'de', true), '3.–4. Dezember 2026')
  assert.equal(formatArrivalRange('2026-12-03', '2026-12-04', 'en', true), '3–4 December 2026')
  assert.equal(formatArrivalRange('2026-11-30', '2026-12-02', 'de'), '30. November – 2. Dezember')
  assert.equal(formatArrivalRange('2026-11-30', '2026-12-02', 'en'), '30 November – 2 December')
})

test('validates Austrian postcodes and Post tracking URLs', () => {
  assert.equal(AUSTRIAN_POSTAL_REGEX.test('1010'), true)
  assert.equal(AUSTRIAN_POSTAL_REGEX.test('5020'), true)
  assert.equal(AUSTRIAN_POSTAL_REGEX.test('8010'), true)
  assert.equal(AUSTRIAN_POSTAL_REGEX.test('0123'), false)
  assert.equal(AUSTRIAN_POSTAL_REGEX.test('123'), false)
  assert.equal(postTrackingUrl('10123456789012345678'), 'https://www.post.at/s/sendungsdetails?snr=10123456789012345678')
  assert.equal(postTrackingUrl('short'), null)
  assert.equal(postTrackingUrl(null), null)
})
