import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = path.resolve('src')
const layers = ['app', 'pages', 'blocks', 'components', 'entities', 'shared']
const files = []
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(file)
    else if (/\.tsx?$/.test(file)) files.push(file)
  }
}
walk(root)
const known = new Set(files)
const graph = new Map()
const errors = []
function resolveImport(file, name) {
  const base = name.startsWith('@/')
    ? path.join(root, name.slice(2))
    : name.startsWith('.')
      ? path.resolve(path.dirname(file), name)
      : null
  if (!base) return null
  return [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ].find((candidate) => known.has(candidate))
}
const moduleOf = (file) => path.relative(root, file).split(path.sep).slice(0, 2).join('/')
for (const file of files) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const from = path.relative(root, file).split(path.sep)
  const edges = []
  for (const node of source.statements) {
    if (
      (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) ||
      !node.moduleSpecifier ||
      !ts.isStringLiteral(node.moduleSpecifier)
    )
      continue
    const target = resolveImport(file, node.moduleSpecifier.text)
    if (!target) continue
    const to = path.relative(root, target).split(path.sep)
    // Generated Router registration imports its router type back. Types do not create a runtime cycle.
    if (!node.isTypeOnly && !node.importClause?.isTypeOnly) edges.push(target)
    const sourceLayer = layers.indexOf(from[0])
    const targetLayer = layers.indexOf(to[0])
    if (sourceLayer < 0 || targetLayer < 0)
      errors.push(`${path.relative(root, file)}: unknown architecture layer`)
    else if (targetLayer < sourceLayer)
      errors.push(`${path.relative(root, file)} imports upper layer ${path.relative(root, target)}`)
    if (from[0] === 'pages' && to[0] === 'pages' && from[1] !== to[1])
      errors.push(`${path.relative(root, file)} imports another page`)
    if (
      ['pages', 'blocks', 'entities', 'shared'].includes(to[0]) &&
      moduleOf(file) !== moduleOf(target) &&
      path.basename(target) !== 'index.ts' &&
      path.basename(target) !== 'index.tsx'
    ) {
      errors.push(`${path.relative(root, file)} bypasses public API of ${moduleOf(target)}`)
    }
  }
  graph.set(file, edges)
}
const visiting = new Set(),
  visited = new Set()
function visit(file, chain = []) {
  if (visiting.has(file)) {
    errors.push(`Import cycle: ${[...chain, file].map((f) => path.relative(root, f)).join(' → ')}`)
    return
  }
  if (visited.has(file)) return
  visiting.add(file)
  for (const child of graph.get(file) ?? []) visit(child, [...chain, file])
  visiting.delete(file)
  visited.add(file)
}
for (const file of files) visit(file)
if (errors.length) {
  console.error([...new Set(errors)].join('\n'))
  process.exit(1)
}
console.log(
  `Architecture: ${files.length} files, downward imports, public APIs and no cycles verified`,
)
