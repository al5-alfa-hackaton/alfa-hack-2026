import ts from 'typescript'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, relative, dirname, sep } from 'node:path'
const root = resolve('src')
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((f) =>
    f.isDirectory()
      ? files(resolve(dir, f.name))
      : f.name.endsWith('.ts')
        ? [resolve(dir, f.name)]
        : [],
  )
}
const errors = []
for (const file of files(root)) {
  const name = relative(root, file).split(sep).join('/'),
    match = name.match(/^modules\/([^/]+)\/(domain|application|infrastructure|presentation)\//)
  if (!match) continue
  const [, module, layer] = match
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const inspect = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const spec = node.moduleSpecifier.text,
        target = spec.startsWith('.')
          ? relative(root, resolve(dirname(file), spec))
              .split(sep)
              .join('/')
          : spec
      if (
        ['domain', 'application'].includes(layer) &&
        (/fastify|drizzle|ioredis|bullmq|langchain/.test(spec) ||
          /(^|\/)(infrastructure|presentation|composition|plugins)\//.test(target) ||
          target === 'config.js')
      )
        errors.push(`${name}: forbidden ${layer} dependency ${spec}`)
      const other = target.match(/^modules\/([^/]+)\/(.+)$/)
      if (other && other[1] !== module && other[2] !== 'index.js')
        errors.push(`${name}: use public API of ${other[1]}`)
      if (layer === 'domain' && target.includes('/application/'))
        errors.push(`${name}: domain depends on application`)
    }
    ts.forEachChild(node, inspect)
  }
  inspect(source)
}
if (errors.length) {
  process.stderr.write(errors.join('\n') + '\n')
  process.exitCode = 1
} else process.stdout.write('Backend module boundaries passed\n')
