// Records the product flow as GIFs for the README (docs/media).
//   DEMO_BASE_URL=https://alfa.niik.me DEMO_ACCOUNT_ID=dataset:U_1595 node scripts/record-demo.mjs [scene ...]
// Scenes: login roles insight register. Needs ffmpeg. Nothing here calls a paid model.
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rename, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const out = resolve(root, 'docs/media')
const base = process.env.DEMO_BASE_URL ?? 'https://alfa.niik.me'
const accountId = process.env.DEMO_ACCOUNT_ID ?? 'dataset:U_1595'
const query = process.env.DEMO_QUERY ?? 'U_1595'
const size = { width: 1280, height: 800 }
const wanted = process.argv.slice(2)
await mkdir(out, { recursive: true })
const scratch = await mkdtemp(join(tmpdir(), 'alfa-demo-'))

const cursorScript = () => {
  const add = () => {
    const el = document.createElement('div')
    el.id = '__cursor'
    el.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l15 9-6.5 1.6L9 19z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    el.style.cssText =
      'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);transition:transform .03s linear'
    document.documentElement.appendChild(el)
    addEventListener(
      'mousemove',
      (e) => (el.style.transform = `translate(${e.clientX - 4}px,${e.clientY - 2}px)`),
      true,
    )
    addEventListener(
      'mousedown',
      (e) => {
        const r = document.createElement('div')
        r.style.cssText = `position:fixed;left:${e.clientX - 18}px;top:${e.clientY - 18}px;width:36px;height:36px;border-radius:50%;border:3px solid #ef3124;z-index:2147483646;pointer-events:none;transition:transform .5s,opacity .5s;opacity:.9`
        document.documentElement.appendChild(r)
        requestAnimationFrame(() => {
          r.style.transform = 'scale(1.8)'
          r.style.opacity = '0'
        })
        setTimeout(() => r.remove(), 600)
      },
      true,
    )
  }
  if (document.documentElement) add()
  else addEventListener('DOMContentLoaded', add)
}

const pause = (page, ms) => page.waitForTimeout(ms)
async function moveTo(page, locator, { dx = 0, dy = 0 } = {}) {
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 28 })
  await pause(page, 250)
}
async function click(page, locator, opts) {
  await moveTo(page, locator, opts)
  await page.mouse.down()
  await page.mouse.up()
}
async function typeSlow(page, text) {
  await page.keyboard.type(text, { delay: 110 })
}
async function wheel(page, locator, total, steps = 6) {
  await moveTo(page, locator)
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, total / steps)
    await pause(page, 260)
  }
}

async function record(name, { login, run }) {
  const context = await chromium
    .launch({ args: ['--disable-dev-shm-usage'] })
    .then((b) =>
      b
        .newContext({
          viewport: size,
          recordVideo: { dir: scratch, size },
          locale: 'ru-RU',
          colorScheme: 'light',
          reducedMotion: 'no-preference',
        })
        .then((c) => Object.assign(c, { browser: b })),
    )
  await context.addInitScript(cursorScript)
  if (login) {
    const r = await context.request.post(base + '/api/v1/session', { data: { accountId } })
    if (r.status() !== 200) throw new Error('login failed: ' + r.status())
  }
  const page = await context.newPage()
  const video = page.video()
  const started = Date.now()
  let cut = 0.4
  // Called once the first meaningful screen is painted: everything before it is dropped from the GIF.
  const ready = async () => {
    await page.evaluate(() => document.fonts.ready)
    await pause(page, 400)
    cut = (Date.now() - started) / 1000
  }
  try {
    await run(page, ready)
  } finally {
    await context.close()
    await context.browser.close()
  }
  const webm = await video.path()
  const target = join(out, name + '.gif')
  const palette = join(scratch, name + '-palette.png')
  const filters = 'fps=12,scale=960:-1:flags=lanczos'
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(cut), '-i', webm, '-vf', `${filters},palettegen=max_colors=96:stats_mode=diff`, palette])
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(cut), '-i', webm, '-i', palette, '-lavfi', `${filters}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`, target])
  await rename(webm, join(scratch, name + '.webm')).catch(() => {})
  console.log(name + '.gif')
}

const feedReady = async (page) => {
  await page.getByRole('heading', { name: 'События для вашего бизнеса' }).waitFor()
  await page.locator('[data-event-title]').first().waitFor()
}

const scenes = {
  login: {
    login: false,
    async run(page, ready) {
      await page.goto(base)
      await page.getByRole('heading', { name: 'Выберите компанию' }).waitFor()
      await ready()
      await pause(page, 500)
      const search = page.getByRole('combobox', { name: 'Поиск аккаунта' })
      await click(page, search)
      await typeSlow(page, query)
      await pause(page, 1100)
      await click(page, page.getByRole('option').first())
      await feedReady(page)
      await pause(page, 2200)
    },
  },
  roles: {
    login: true,
    async run(page, ready) {
      await page.goto(base)
      await feedReady(page)
      await ready()
      await pause(page, 1400)
      const titles = () => page.locator('[data-event-title]').allInnerTexts()
      const before = await titles()
      await click(page, page.getByRole('button', { name: 'Выбрать компанию и роль' }))
      await pause(page, 900)
      await click(page, page.getByText('Генеральный директор', { exact: true }))
      await page.waitForFunction(
        (first) => document.querySelector('[data-event-title]')?.textContent !== first,
        before[0],
        { timeout: 20000 },
      ).catch(() => {})
      await pause(page, 600)
      await page.mouse.move(700, 450, { steps: 20 })
      await pause(page, 2600)
    },
  },
  register: {
    login: false,
    async run(page, ready) {
      const id = 'demo_' + Math.random().toString(36).slice(2, 8)
      await page.goto(base)
      await page.getByRole('heading', { name: 'Выберите компанию' }).waitFor()
      await ready()
      await click(page, page.getByRole('tab', { name: 'Новая компания', exact: true }))
      const fill = async (label, text, exact = true) => {
        const field = page.getByLabel(label, { exact })
        await click(page, field)
        await page.keyboard.type(text, { delay: 55 })
      }
      await fill('Имя профиля', id)
      await fill('Название компании', 'Демо: сеть кофеен', false)
      await fill('Отрасль', 'Общественное питание')
      await fill('Регион', 'Санкт-Петербург')
      await fill('Выручка за 2025 год, ₽', '18000000000')
      await fill('Численность сотрудников', '1400')
      await pause(page, 500)
      await click(page, page.getByRole('button', { name: 'Продолжить', exact: true }))
      await page.getByText('Шаг 2 из 2', { exact: false }).waitFor()
      await pause(page, 900)
      await click(page, page.getByRole('combobox', { name: 'Кредиты', exact: true }))
      await click(page, page.getByRole('option', { name: 'Есть', exact: true }))
      await click(page, page.getByRole('combobox', { name: 'Лизинг', exact: true }))
      await click(page, page.getByRole('option', { name: 'Нет', exact: true }))
      await fill('Страны внешней торговли', 'Китай, Турция', false)
      await pause(page, 600)
      await click(page, page.getByRole('button', { name: 'Создать аккаунт и компанию', exact: true }))
      await page.getByRole('heading', { name: 'События для вашего бизнеса' }).waitFor()
      await pause(page, 1400)
      await click(page, page.getByRole('link', { name: /Контекст компании/ }))
      await page.getByRole('table').waitFor()
      await pause(page, 2600)
    },
  },
  insight: {
    login: true,
    async run(page, ready) {
      await page.goto(base)
      await feedReady(page)
      await ready()
      await pause(page, 900)
      await click(page, page.locator('[data-event-title]').first())
      const dialog = page.getByRole('dialog')
      await dialog.waitFor()
      await pause(page, 2200)
      await wheel(page, dialog, 520, 5)
      await pause(page, 1600)
      await wheel(page, dialog, 560, 5)
      await pause(page, 1600)
      await click(page, dialog.getByRole('tab', { name: /Источники/ }))
      await pause(page, 900)
      const bank = dialog.getByText(/Материал банка/).first()
      await click(page, bank)
      await pause(page, 2600)
      await click(page, dialog.getByRole('tab', { name: /Ход анализа/ }))
      await pause(page, 2200)
    },
  },
}

try {
  for (const [name, scene] of Object.entries(scenes))
    if (!wanted.length || wanted.includes(name)) await record(name, scene)
} finally {
  await rm(scratch, { recursive: true, force: true })
}
