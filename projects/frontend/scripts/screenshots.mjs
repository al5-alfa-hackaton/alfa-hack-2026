import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const output = resolve(root, 'docs/screenshots')
const baseURL = process.env.SCREENSHOT_BASE_URL ?? 'http://127.0.0.1:3000'
const accountId = process.env.SCREENSHOT_ACCOUNT_ID ?? 'dataset:U_1595'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args: ['--disable-dev-shm-usage'],
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
  colorScheme: 'light',
  reducedMotion: 'reduce',
})
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
async function screen(name) {
  await page.evaluate(() => document.fonts.ready)
  await page.getByRole('heading', { level: 1 }).waitFor()
  await page.screenshot({ path: resolve(output, name + '.png'), animations: 'disabled' })
  console.log(name + '.png')
}
try {
  await expect
    .poll(async () => (await context.request.get(baseURL + '/api/ready')).status(), {
      timeout: 30_000,
    })
    .toBe(200)
  await page.goto(baseURL)
  await page.getByRole('heading', { name: 'Выберите компанию' }).waitFor()
  await screen('login')
  const login = await context.request.post(baseURL + '/api/v1/session', {
    data: { accountId },
  })
  if (login.status() !== 200) throw new Error('Could not authenticate screenshot session')
  await page.goto(baseURL + '/company')
  await page.getByRole('table').waitFor()
  await screen('company-desktop')
  await page.goto(baseURL)
  await page.getByRole('heading', { name: 'События для вашего бизнеса' }).waitFor()
  await expect(page.getByRole('status', { name: 'Загрузка данных' })).toHaveCount(0)
  await screen('feed-desktop')
  await page.getByRole('button', { name: 'Переключить тему' }).click()
  await page.locator('html.dark').waitFor()
  await screen('feed-dark')
  await page.getByRole('button', { name: 'Переключить тему' }).click()
  await page.locator('html:not(.dark)').waitFor()
  await page.setViewportSize({ width: 768, height: 1024 })
  await screen('feed-tablet')
  await page.setViewportSize({ width: 390, height: 844 })
  await screen('feed-mobile')
  if (errors.length) throw new Error('Browser errors: ' + errors.join('; '))
} finally {
  await context.close()
  await browser.close()
}
