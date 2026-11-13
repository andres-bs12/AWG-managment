import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { apiError } from '../src/lib/apiError.ts'

const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url))
function parse(file) {
  return ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
}
function walk(node, visit) {
  visit(node)
  ts.forEachChild(node, child => walk(child, visit))
}
const dictionaryTree = parse(`${sourceRoot}/i18n/LocaleContext.tsx`)
let dictionaries
walk(dictionaryTree, node => {
  if (ts.isVariableDeclaration(node) && node.name.getText(dictionaryTree) === 'messages') {
    dictionaries = Object.fromEntries(node.initializer.properties.map(locale => [
      locale.name.getText(dictionaryTree),
      new Set(locale.initializer.properties.map(entry => entry.name.getText(dictionaryTree).replace(/^['"]|['"]$/g, ''))),
    ]))
  }
})

test('English and German dictionaries expose the same translation keys', () => {
  assert.ok(dictionaries)
  assert.deepEqual([...dictionaries.en].sort(), [...dictionaries.de].sort())
})

test('every literal translation requested by any page or component exists in both languages', () => {
  const missing = []
  for (const path of readdirSync(sourceRoot, { recursive: true })) {
    if (!/\.tsx?$/.test(path)) continue
    const tree = parse(`${sourceRoot}/${path}`)
    walk(tree, node => {
      if (!ts.isCallExpression(node) || node.expression.getText(tree) !== 't'
        || !node.arguments[0] || !ts.isStringLiteral(node.arguments[0])) return
      for (const locale of ['en', 'de']) {
        if (!dictionaries[locale].has(node.arguments[0].text)) missing.push(`${path}: ${locale}.${node.arguments[0].text}`)
      }
    })
  }
  assert.deepEqual(missing, [])
})

test('the per-client checkout cap has localized recovery messages', () => {
  const problem = { code: 'PENDING_CHECKOUT_LIMIT', message: 'Too many pending checkouts.' }
  assert.match(apiError(problem, 'en', 'fallback').text, /two unpaid orders.*expire/)
  assert.match(apiError(problem, 'de', 'fallback').text, /zwei unbezahlte Bestellungen.*abläuft/)
})
