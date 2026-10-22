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
