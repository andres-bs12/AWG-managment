import test from 'node:test'
import assert from 'node:assert/strict'
import config from '../vite.config.ts'

function configuration(command, mode, source, allowMock) {
  const previous = { source: process.env.VITE_DATA_SOURCE, allow: process.env.VITE_ALLOW_MOCK_BUILD }
  process.env.VITE_DATA_SOURCE = source
  process.env.VITE_ALLOW_MOCK_BUILD = allowMock
  try { return config({ command, mode }) } finally {
    if (previous.source === undefined) delete process.env.VITE_DATA_SOURCE
    else process.env.VITE_DATA_SOURCE = previous.source
    if (previous.allow === undefined) delete process.env.VITE_ALLOW_MOCK_BUILD
    else process.env.VITE_ALLOW_MOCK_BUILD = previous.allow
  }
}

test('production build rejects missing, misspelled and mock data sources without explicit opt-in', () => {
  for (const source of ['', 'mock', 'HTTP', 'htt']) {
    for (const allow of ['', '0', 'true']) {
      assert.throws(() => configuration('build', 'production', source, allow), /VITE_DATA_SOURCE=http.*VITE_ALLOW_MOCK_BUILD=1/s)
    }
  }
})

test('HTTP production aliases never include demo services, even with the escape hatch set', () => {
  const result = configuration('build', 'production', 'http', '1')
  assert.match(result.resolve.alias['data-source'], /\/api\/http\/entry.ts$/)
  assert.match(result.resolve.alias['demo-source'], /\/api\/http\/demo.ts$/)
})

test('local preview explicitly permits mock and development remains usable', () => {
  for (const [command, mode, allow] of [['build', 'production', '1'], ['serve', 'development', '']]) {
    const result = configuration(command, mode, 'mock', allow)
    assert.match(result.resolve.alias['data-source'], /\/api\/mock\/entry.ts$/)
  }
})
