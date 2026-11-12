import test from 'node:test'
import assert from 'node:assert/strict'
import { finishForColor, firstAvailableCustom, remainingColor, remainingStock, stockLabel } from '../src/lib/saleStock.ts'

const stock = (redShiny, redMatte = 0, greenShiny = 0, greenMatte = 0, beigeShiny = 0, beigeMatte = 0, finished = 0) => [
  { kind: 'custom', color: 'red', finish: 'shiny', quantity: redShiny },
  { kind: 'custom', color: 'red', finish: 'matte', quantity: redMatte },
  { kind: 'custom', color: 'green', finish: 'shiny', quantity: greenShiny },
  { kind: 'custom', color: 'green', finish: 'matte', quantity: greenMatte },
  { kind: 'custom', color: 'beige', finish: 'shiny', quantity: beigeShiny },
  { kind: 'custom', color: 'beige', finish: 'matte', quantity: beigeMatte },
  { kind: 'finished', color: null, finish: null, quantity: finished },
]

test('a new custom ornament skips a sold-out red/shiny and takes the first combination in stock', () => {
  assert.deepEqual(firstAvailableCustom(stock(0, 2), []), { color: 'red', finish: 'matte' })
  assert.deepEqual(firstAvailableCustom(stock(0, 0, 0, 1), []), { color: 'green', finish: 'matte' })
})

test('ornaments already in the draft use up stock for the next one', () => {
  const draft = [{ id: 'a', kind: 'custom', color: 'red', finish: 'shiny' }]
  assert.deepEqual(firstAvailableCustom(stock(1, 0, 1), draft), { color: 'green', finish: 'shiny' })
  assert.equal(remainingStock(stock(3), draft, 'custom', 'red', 'shiny'), 2)
  // The ornament asking does not count against itself.
  assert.equal(remainingStock(stock(3), draft, 'custom', 'red', 'shiny', 'a'), 3)
  assert.equal(remainingColor(stock(3, 2), draft, 'red'), 4)
})

test('everything sold out means no preselection', () => {
  assert.equal(firstAvailableCustom(stock(0), []), null)
  assert.equal(firstAvailableCustom(stock(1), [{ id: 'a', kind: 'custom', color: 'red', finish: 'shiny' }]), null)
})

test('finished stock counts finished ornaments in the draft', () => {
  const draft = [{ id: 'a', kind: 'finished' }, { id: 'b', kind: 'finished' }, { id: 'c', kind: 'custom', color: 'red', finish: 'shiny' }]
  assert.equal(remainingStock(stock(0, 0, 0, 0, 0, 0, 3), draft, 'finished'), 1)
  assert.equal(remainingStock(stock(0, 0, 0, 0, 0, 0, 1), draft, 'finished'), 0)
})

test('changing colour keeps the finish when it is still in stock', () => {
  assert.equal(finishForColor(stock(0, 0, 2, 2), [], 'green', 'matte'), 'matte')
  assert.equal(finishForColor(stock(0, 0, 2, 0), [], 'green', 'matte'), 'shiny')
  assert.equal(finishForColor(stock(0), [], 'green', 'matte'), null)
})

test('stock labels', () => {
  assert.equal(stockLabel(0), 'Sold out')
  assert.equal(stockLabel(1), 'Last one')
  assert.equal(stockLabel(4), '4 left')
})
