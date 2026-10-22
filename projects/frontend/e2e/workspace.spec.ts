import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const browserErrors = new WeakMap<Page, string[]>()
test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) ?? []).toEqual([])
})

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  browserErrors.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'События для вашего бизнеса' })).toBeVisible()
})

test('opens directly into the scoped feed, searches and resets an empty result', async ({
  page,
}) => {
  await expect(page.locator('article')).toHaveCount(6)
  await page.getByRole('searchbox', { name: 'Поиск по событиям' }).fill('несуществующее событие')
  await expect(page.getByText('По этому запросу ничего нет')).toBeVisible()
  await page.getByRole('button', { name: 'Сбросить фильтры' }).click()
  await page.getByRole('radio', { name: 'Риски: 2', exact: true }).click()
  await expect(page.locator('article')).toHaveCount(2)
  await page.getByRole('radio', { name: 'Возможности: 3', exact: true }).click()
  await expect(page.locator('article')).toHaveCount(3)
})

test('persists saved insights and keeps company and perspective scopes separate', async ({
  page,
}) => {
  await page
    .locator('[data-testid="news-rate"]')
    .getByRole('button', { name: /^Сохранить:/ })
    .click()
  await page.getByRole('link', { name: 'Сохранённое', exact: true }).click()
  await expect(page.locator('article')).toHaveCount(1)
  await page.reload()
  await expect(page.locator('article')).toHaveCount(1)
  await page.getByRole('button', { name: 'Выбрать компанию и роль' }).click()
  await page.getByRole('menuitemradio', { name: 'Город Маркет' }).click()
  await expect(page.locator('article').first()).toContainText('Потребители чаще')
  await page.getByRole('link', { name: 'Сохранённое', exact: true }).click()
  await expect(page.getByText('Сохраните то, к чему хотите вернуться')).toBeVisible()
  await page.getByRole('button', { name: 'Выбрать компанию и роль' }).click()
  await page.getByRole('menuitemradio', { name: /Север Металл/ }).click()
  await page.getByRole('button', { name: 'Выбрать компанию и роль' }).click()
  await page.getByRole('menuitemradio', { name: 'Генеральный директор' }).click()
  await page.getByRole('link', { name: 'Сохранённое', exact: true }).click()
  await expect(page.locator('article')).toHaveCount(0)
})

test('deep links to a reader, shows sources and restores focus on close', async ({ page }) => {
  const title = page.locator('[data-event-title="rate"]')
  await title.click()
  await expect(page).toHaveURL(/insight=rate/)
  const reader = page.getByRole('dialog')
  await expect(reader.getByRole('heading', { name: 'Что это меняет для вас' })).toBeVisible()
  await reader.getByRole('tab', { name: /Источники/ }).click()
  await expect(reader.getByText('Учебная новость · фрагмент 1')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(reader).toHaveCount(0)
  await expect(title).toBeFocused()
  await page.goto('/?insight=rate')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('asks a scoped question, keeps ratings separate from error remarks and persists them', async ({
  page,
}) => {
  await page.locator('[data-event-title="rate"]').click()
  const reader = page.getByRole('dialog')
  await reader.getByRole('tab', { name: 'Вопросы', exact: true }).click()
  await reader.getByRole('button', { name: 'Какие риски?', exact: true }).click()
  await expect(reader.getByRole('log')).toContainText('Плавающая ставка')
  await reader.getByRole('radio', { name: 'Полезно', exact: true }).click()
  await reader.getByRole('button', { name: 'Сообщить об ошибке' }).click()
  await page.getByLabel('Ваше замечание').fill('Нужен график погашения кредитов.')
  await page.getByRole('button', { name: 'Сохранить замечание', exact: true }).click()
  await expect(reader.getByRole('radio', { name: 'Полезно', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await page.reload()
  await page.getByRole('tab', { name: 'Вопросы', exact: true }).click()
  await expect(page.getByRole('log')).toContainText('Плавающая ставка')
  await expect(page.getByRole('button', { name: 'Изменить замечание' })).toBeVisible()
})

test('cancels an analysis and records cancellation in history', async ({ page }) => {
  await page.getByRole('button', { name: 'Обновить сводку', exact: true }).click()
  await page.getByRole('button', { name: 'Отменить', exact: true }).click()
  await expect(page.locator('article')).toHaveCount(6)
  await page.getByRole('link', { name: 'История анализа' }).click()
  await expect(page.getByRole('cell', { name: 'Отменён', exact: true })).toBeVisible()
})

for (const [scenario, heading] of [
  ['Частичный результат', 'Сводка обновлена по доступным источникам'],
  ['Нет новых событий', 'Новых событий пока нет'],
  ['Ошибка сервиса', 'Не удалось обновить сводку'],
  ['Лимит анализа', 'Лимит анализа исчерпан'],
  ['Нет доступа', 'Нет доступа к источнику'],
]) {
  test(`handles the ${scenario} scenario`, async ({ page }) => {
    await page.getByRole('button', { name: 'Сценарии демо' }).click()
    await page.getByRole('radio', { name: new RegExp(scenario!) }).click()
    await page.getByRole('button', { name: 'Запустить сценарий' }).click()
    await expect(page.getByText(heading!, { exact: true })).toBeVisible()
    if (scenario === 'Нет доступа') await expect(page.locator('article')).toHaveCount(0)
  })
}

test('downloads a filtered digest instead of an unrelated full feed', async ({ page }) => {
  await page.getByRole('searchbox').fill('маршрут')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать сводку' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('alfa-demo-nord-cfo.txt')
  const stream = await file.createReadStream()
  const parts = []
  for await (const part of stream!) parts.push(part)
  const text = Buffer.concat(parts).toString('utf8')
  expect(text).toContain('Новый грузовой маршрут')
  expect(text).not.toContain('Ставка без изменений')
  expect(text).toContain('Не является реальной аналитикой банка')
})

test('works on mobile without overflow and supports menu navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByText('Север Металл', { exact: true }).first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const filters = page.getByRole('radiogroup', { name: 'Фильтровать события' })
  if (await filters.count()) {
    const box = await filters.boundingBox()
    expect(box!.x + box!.width).toBeLessThanOrEqual(390 - 8)
  }
  await page.getByRole('button', { name: 'Открыть навигацию', exact: true }).click()
  await page.getByRole('link', { name: 'Контекст компании', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Контекст компании' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('recovers from invalid saved state and passes core accessibility checks', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('alfa-demo-v1', '{invalid'))
  await page.reload()
  await expect(page.getByRole('status').filter({ hasText: 'Хранилище браузера' })).toBeVisible()
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(results.violations).toEqual([])
})

test('dark theme stays readable and restores its preference', async ({ page }) => {
  await page.getByRole('button', { name: 'Переключить тему' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(results.violations).toEqual([])
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
})

test('reader sources and conversation meet core accessibility checks', async ({ page }) => {
  await page.locator('[data-event-title="rate"]').click()
  await page.getByRole('tab', { name: /Источники/ }).click()
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([])
  await page.getByRole('tab', { name: 'Вопросы', exact: true }).click()
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([])
})
