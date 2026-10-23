import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import openapiTS, { astToString } from 'openapi-typescript'
import { buildApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
const app = await buildApp(loadConfig({ LOG_LEVEL: 'silent', NODE_ENV: 'test' }))
try {
  await app.ready()
  const spec = app.swagger()
  const target = fileURLToPath(new URL('../../../packages/api-client/', import.meta.url))
  await writeFile(`${target}openapi.json`, JSON.stringify(spec, null, 2) + '\n')
  const ast = await openapiTS(spec as Parameters<typeof openapiTS>[0])
  await writeFile(`${target}src/schema.d.ts`, astToString(ast))
  process.stdout.write(
    `Generated ${Object.keys(spec.paths ?? {}).length} OpenAPI paths and frontend types\n`,
  )
} finally {
  await app.close()
}
