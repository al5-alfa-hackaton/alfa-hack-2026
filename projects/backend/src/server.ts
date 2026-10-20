import { buildApp } from './app.js'
import { loadConfig } from './config.js'

const config = loadConfig()
const app = buildApp(config)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.close().catch(() => { process.exitCode = 1 })
  })
}

try {
  await app.listen({ host: config.HOST, port: config.PORT })
} catch (error) {
  app.log.error(error)
  await app.close()
  process.exitCode = 1
}
