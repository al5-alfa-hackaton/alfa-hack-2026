import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const output = fileURLToPath(new URL('../../../docs/screenshots/', import.meta.url))
const baseURL = process.env.SCREENSHOT_BASE_URL ?? 'http://127.0.0.1:3000'
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
async function ready() {
  await page.evaluate(() => document.fonts.ready)
  await page.getByRole('heading', { level: 1 }).waitFor()
}
async function screen(name) {
  await ready()
  await page.screenshot({ path: `${output}${name}.png`, animations: 'disabled' })
  console.log(`${name}.png`)
}
async function panel(name) {
  const dialog = page.getByRole('dialog')
  await dialog.evaluate((element) => {
    element.scrollTop = 0
  })
  await dialog.screenshot({ path: `${output}${name}.png`, animations: 'disabled' })
  console.log(`${name}.png`)
}
try {
  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'События для вашего бизнеса' }).waitFor()
  await screen('feed-desktop')
  await page.locator('[data-event-title="rate"]').click()
  await page.getByRole('heading', { name: 'Что это меняет для вас' }).waitFor()
  await panel('insight-reader')
  await page.getByRole('tab', { name: /Источники/ }).click()
  await page.getByText('Учебная новость · фрагмент 1', { exact: false }).waitFor()
  await panel('sources')
  await page.getByRole('tab', { name: 'Вопросы', exact: true }).click()
  await page.getByRole('button', { name: 'Какие риски?', exact: true }).click()
  await page
    .getByRole('log')
    .getByText(/Плавающая ставка/)
    .waitFor()
  await panel('conversation')
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Контекст компании', exact: true }).click()
  await page.getByRole('heading', { name: 'Контекст компании', exact: true }).waitFor()
  await screen('company-desktop')
  await page.getByRole('link', { name: 'События для вас', exact: true }).click()
  await page.getByRole('button', { name: 'Переключить тему' }).click()
  await page.locator('html.dark').waitFor()
  await screen('feed-dark')
  await page.getByRole('button', { name: 'Переключить тему' }).click()
  await page.locator('html:not(.dark)').waitFor()
  await page.setViewportSize({ width: 768, height: 1024 })
  await screen('feed-tablet')
  await page.setViewportSize({ width: 390, height: 844 })
  await screen('feed-mobile')
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`)
} finally {
  await context.close()
  await browser.close()
}
