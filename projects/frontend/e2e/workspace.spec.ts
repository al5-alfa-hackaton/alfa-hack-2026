import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const accessKey = process.env.E2E_ACCESS_KEY
test.skip(!accessKey, 'Set E2E_ACCESS_KEY for an isolated fixture backend and worker')
async function login(request: APIRequestContext) {
  const result = await request.post('/api/v1/session', { data: { token: accessKey } })
  expect(result.status()).toBe(200)
}
async function refresh(request: APIRequestContext, perspective = 'cfo', companyId = 'U_1') {
  const accepted = await request.post('/api/v1/analysis-runs', {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    data: { companyId, perspective, kind: 'refresh_feed' },
  })
  expect(accepted.status()).toBe(202)
  const { runId } = await accepted.json()
  await expect
    .poll(async () => (await (await request.get('/api/v1/analysis-runs/' + runId)).json()).status)
    .toBe('partial')
}
async function openFirst(page: Page) {
  await page.locator('[data-event-title]').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  return page.getByRole('dialog')
}
test('signs in without SSO, keeps keys out of browser storage, and logs out', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Вход в аналитику' })).toBeVisible()
  await page.getByLabel('Ключ доступа').fill(accessKey!)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'События для вашего бизнеса' })).toBeVisible()
  const cookie = (await page.context().cookies()).find((item) => item.name === 'alfa_session')
  expect(cookie?.httpOnly).toBe(true)
  expect(await page.evaluate(() => JSON.stringify(localStorage) + document.cookie)).not.toContain(
    accessKey,
  )
  await page.reload()
  await expect(page.getByRole('heading', { name: 'События для вашего бизнеса' })).toBeVisible()
  await page.getByRole('button', { name: 'Выйти', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Вход в аналитику' })).toBeVisible()
})
test.describe('workspace backed by API and PostgreSQL', () => {
  test.beforeEach(async ({ page }) => {
    const request = page.request
    await login(request)
    await refresh(request)
    const saved = await (
      await request.get('/api/v1/companies/U_1/saved-insights?perspective=cfo&limit=100')
    ).json()
    for (const item of saved.items)
      await request.delete(
        '/api/v1/me/saved-insights/' + item.id + '?perspective=cfo&version=' + item.version,
      )
    await page.goto('/')
    await expect(page.locator('article')).toHaveCount(3)
  })
  test('searches real API results and exports only the selected events', async ({ page }) => {
    await expect(page.getByText('Демо', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Сценарии/ })).toHaveCount(0)
    await page.getByRole('searchbox', { name: 'Поиск по событиям' }).fill('несуществующее событие')
    await expect(page.getByText('По этому запросу ничего нет')).toBeVisible()
    await page.getByRole('button', { name: 'Сбросить фильтры' }).click()
    await page.getByRole('searchbox', { name: 'Поиск по событиям' }).fill('финансирования')
    await expect(page.locator('article')).toHaveCount(1)
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Скачать сводку' }).click()
    const path = await (await download).path()
    const { readFile } = await import('node:fs/promises')
    const text = await readFile(path!, 'utf8')
    expect(text).toContain('Изменение условий финансирования')
    expect(text).not.toContain('Спрос на сталь')
  })
  test('saves to the account, restores on reload and separates perspectives', async ({ page }) => {
    const first = page.locator('article').first()
    const save = first.getByRole('button', { name: /^Сохранить:/ })
    await save.click()
    await expect(first.getByRole('button', { name: /^Убрать из сохранённого:/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.getByRole('link', { name: 'Сохранённое', exact: true }).click()
    await expect(page.locator('article')).toHaveCount(1)
    await page.reload()
    await expect(page.locator('article')).toHaveCount(1)
    await page.getByRole('button', { name: 'Выбрать компанию и роль' }).click()
    await page.getByRole('menuitemradio', { name: 'Генеральный директор', exact: true }).click()
    await page.getByRole('link', { name: 'Сохранённое', exact: true }).click()
    await expect(page.locator('article')).toHaveCount(0)
    await expect(page.getByText('Сохраните то, к чему хотите вернуться')).toBeVisible()
    await page.reload()
    await expect(page.getByText('Сохраните то, к чему хотите вернуться')).toBeVisible()
  })
  test('deep-links to persisted insights, loads authorized sources and restores focus', async ({
    page,
  }) => {
    const title = page.locator('[data-event-title]').first()
    const id = await title.getAttribute('data-event-title')
    const reader = await openFirst(page)
    await expect(page).toHaveURL(new RegExp('insight=' + id))
    await reader.getByRole('tab', { name: /Источники/ }).click()
    await reader
      .getByRole('button', { name: /Новостная публикация/ })
      .first()
      .click()
    await expect(reader.getByRole('blockquote')).toContainText('Синтетическая новость')
    await page.keyboard.press('Escape')
    await expect(title).toBeFocused()
    await page.goto('/?insight=' + id)
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('dialog')).toBeVisible()
  })
  test('persists questions, ratings, comments and the actual agent journal', async ({ page }) => {
    const reader = await openFirst(page)
    await reader.getByRole('tab', { name: 'Вопросы', exact: true }).click()
    await reader.getByLabel('Ваш вопрос').fill('Какие риски?')
    await reader.getByRole('button', { name: 'Отправить вопрос' }).click()
    await expect(reader.getByRole('log')).toContainText('Аналитик', { timeout: 15000 })
    await reader.getByRole('radio', { name: 'Полезно', exact: true }).click()
    await expect(reader.getByRole('radio', { name: 'Полезно', exact: true })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await reader.getByRole('button', { name: 'Сообщить об ошибке' }).click()
    await page.getByLabel('Ваше замечание').fill('Проверить цитату и дату публикации.')
    await page.getByRole('button', { name: 'Сохранить замечание', exact: true }).click()
    await page.reload()
    await expect(page.getByRole('radio', { name: 'Полезно', exact: true })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await page.getByRole('tab', { name: 'Вопросы', exact: true }).click()
    await expect(page.getByRole('log')).toContainText('Какие риски?')
    await expect(page.getByRole('button', { name: 'Изменить замечание' })).toBeVisible()
    await page.getByRole('tab', { name: 'Ход анализа', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Журнал анализа' })).toContainText(
      'Задание принято',
    )
  })
  test('updates through the queue and restores the server history', async ({ page }) => {
    await page.getByRole('button', { name: 'Обновить сводку', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Обновить сводку', exact: true })).toBeEnabled({
      timeout: 15000,
    })
    await page.getByRole('link', { name: 'История анализа', exact: true }).click()
    await expect(page.getByRole('table')).toContainText('Готово с ограничениями')
    const count = await page.getByRole('row').count()
    await page.reload()
    await expect(page.getByRole('row')).toHaveCount(count)
  })
  test('changes server ranking with company and role and opens the real profile', async ({
    page,
  }) => {
    const request = page.request
    await refresh(request, 'ceo')
    await refresh(request, 'ceo', 'U_3')
    await page.getByRole('button', { name: 'Выбрать компанию и роль' }).click()
    await page.getByRole('menuitemradio', { name: 'Генеральный директор', exact: true }).click()
    await expect(page.locator('article').first()).toContainText('Спрос на сталь')
    await page.getByRole('button', { name: 'Выбрать компанию и роль' }).click()
    await page.getByRole('menuitemradio', { name: /Компания U_3/ }).click()
    await expect(page.locator('article').first()).toContainText('Поставки угля')
    await page.getByRole('link', { name: 'Контекст компании', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Компания U_3', exact: true })).toBeVisible()
    await expect(page.getByRole('table')).toContainText('Лизинг')
    await expect(page.getByRole('tab', { name: 'Демо-профиль' })).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Компания U_3', exact: true })).toBeVisible()
  })
  test('shows API failure with retry rather than a fabricated feed', async ({ page }) => {
    await page.route('**/api/v1/companies/U_1/insights?*', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'unavailable', message: 'Временная ошибка источника' }),
      }),
    )
    await page.reload()
    await expect(
      page.getByRole('alert').filter({ hasText: 'Временная ошибка источника' }),
    ).toBeVisible()
    await expect(page.locator('article')).toHaveCount(0)
    await page.unroute('**/api/v1/companies/U_1/insights?*')
    await page.getByRole('button', { name: 'Повторить', exact: true }).click()
    await expect(page.locator('article')).toHaveCount(3)
  })
  test('works on mobile and passes accessibility checks in the feed and reader', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    await page.getByRole('button', { name: 'Открыть навигацию' }).click()
    await page.getByRole('link', { name: 'Контекст компании', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Контекст компании', exact: true }),
    ).toBeVisible()
    await page.goto('/')
    await expect(page.locator('article')).toHaveCount(3)
    const feed = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(feed.violations).toEqual([])
    await openFirst(page)
    const reader = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(reader.violations).toEqual([])
  })
})
