import { expect, test } from '@playwright/test'
test('typed API: scoped company → queue → worker → persisted insight', async ({ page }) => {
  test.skip(
    process.env.TEST_BACKEND !== 'true',
    'Requires migrated PostgreSQL, Redis, DEV_AUTH and worker',
  )
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/company')
  await page.getByRole('tab', { name: 'Данные сервиса', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Данные сервиса', exact: true })
  await expect(panel.getByRole('heading', { name: 'Компания U_1', exact: true })).toBeVisible()
  await expect(panel.getByText('Учебный набор', { exact: true })).toBeVisible()
  await panel.getByRole('button', { name: 'Сформировать сводку', exact: true }).click()
  await expect(panel.getByRole('status')).toHaveText('Готово с ограничениями', { timeout: 15000 })
  await expect(
    panel.getByRole('heading', {
      name: 'Изменение условий финансирования — учебный пример',
      exact: true,
    }),
  ).toBeVisible()
  await page.reload()
  await page.getByRole('tab', { name: 'Данные сервиса', exact: true }).click()
  await expect(
    panel.getByRole('heading', {
      name: 'Изменение условий финансирования — учебный пример',
      exact: true,
    }),
  ).toBeVisible()
  expect(errors).toEqual([])
})
test('server ranking changes with perspective and company and shows its grounds', async ({
  page,
}) => {
  test.skip(process.env.TEST_BACKEND !== 'true', 'Requires backend and worker')
  await page.goto('/company')
  await page.getByRole('tab', { name: 'Данные сервиса', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Данные сервиса', exact: true })
  const refresh = async () => {
    await panel.getByRole('button', { name: 'Сформировать сводку', exact: true }).click()
    await expect(panel.getByRole('status')).toHaveText('Готово с ограничениями', { timeout: 15000 })
  }
  await expect(panel.getByRole('heading', { name: 'Компания U_1', exact: true })).toBeVisible()
  await refresh()
  await expect(panel.locator('article').first().getByRole('heading')).toHaveText(
    'Изменение условий финансирования — учебный пример',
  )
  await expect(
    panel.locator('article').first().getByText('Приоритет 1', { exact: true }),
  ).toBeVisible()
  await expect(
    panel.locator('article').first().getByRole('list', { name: 'Основания приоритета' }),
  ).toContainText('Кредиты в Альфа-Банке')
  await panel.getByRole('combobox', { name: 'Ракурс анализа' }).click()
  await page.getByRole('option', { name: 'Генеральный директор', exact: true }).click()
  await refresh()
  await expect(panel.locator('article').first().getByRole('heading')).toHaveText(
    'Спрос на сталь — учебный пример',
  )
  await panel.getByRole('combobox', { name: 'Компания в сервисе' }).click()
  await page.getByRole('option', { name: 'Компания U_3', exact: true }).click()
  await expect(panel.getByRole('heading', { name: 'Компания U_3', exact: true })).toBeVisible()
  await refresh()
  await expect(panel.locator('article').first().getByRole('heading')).toHaveText(
    'Поставки угля — учебный пример',
  )
  await expect(
    panel.getByRole('heading', { name: 'Розничные продажи — учебный пример', exact: true }),
  ).toHaveCount(0)
  const steel = panel
    .locator('article')
    .filter({
      has: page.getByRole('heading', { name: 'Спрос на сталь — учебный пример', exact: true }),
    })
  await expect(steel.getByRole('list', { name: 'Основания приоритета' })).toContainText(
    'Наблюдаемые отрасли покупателей',
  )
})
