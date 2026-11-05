import { readFile, readdir } from 'node:fs/promises'
import postcss from 'postcss'

const roots = ['src/pages/staff', 'src/components/staff']
const files = (await Promise.all(roots.map(async root => (await readdir(root)).filter(name => name.endsWith('.module.css')).map(name => `${root}/${name}`)))).flat()
files.push('src/layouts/StaffLayout.module.css', 'src/components/ui/StaffButton.module.css', 'src/components/ui/SegmentedControl.module.css', 'src/components/ui/ChoiceList.module.css')
const tokens = await readFile('src/styles/tokens.css', 'utf8')
const known = new Set([...tokens.matchAll(/(--[\w-]+)\s*:/g)].map(match => match[1]))
const errors = []
for (const file of files) {
  const source = await readFile(file, 'utf8')
  const root = postcss.parse(source, { from: file })
  root.walkDecls(declaration => {
    const { prop, value } = declaration
    const where = `${file}:${declaration.source.start.line}`
    if (!/^(?:--[\w-]+|-?[a-z][\w-]*)$/.test(prop)) errors.push(`${where} Invalid CSS property: ${prop}`)
    if (/#[\da-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/i.test(value)) errors.push(`${where} Use colour tokens`)
    const lengths = value.match(/-?(?:\d*\.)?\d+px\b/g) ?? []
    if (lengths.some(length => length !== '1px' || !/^border(?:-|$)/.test(prop))) errors.push(`${where} Use size/space tokens`)
    if (/(?:\d*\.)?\d+(?:rem|em|ms)\b/.test(value) && prop !== 'letter-spacing') errors.push(`${where} Use type/space/duration tokens`)
    if (prop === 'transition' && /(?:^|,)\s*(?!transform\b|opacity\b)[a-z-]+/.test(value)) errors.push(`${where} Only transform/opacity transitions`)
    for (const match of value.matchAll(/var\((--[\w-]+)/g)) {
      if (!known.has(match[1]) && match[1] !== '--hour-h') errors.push(`${where} Unknown token ${match[1]}`)
    }
  })
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 }
else console.log(`Staff CSS contracts: ${files.length} modules passed`)
