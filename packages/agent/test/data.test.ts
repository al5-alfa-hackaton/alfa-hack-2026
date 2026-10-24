import { stripHtml } from '../src/data/text.js'
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { locateSources } from '../src/agent/sources.js'
import { chunkPage, normalizePageText } from '../src/data/bank.js'
import { buildDataContext } from '../src/data/context.js'
import { isWarNews, mergeNews, NEWS_SOURCES, parseFeed, type NewsItem } from '../src/data/news.js'
import { evidenceVerify, newsSearch } from '../src/tools/functions.js'
import { bank, fixtureContext, news } from './helpers.js'

const ctx = await fixtureContext()
const rbc = NEWS_SOURCES.find((s) => s.id === 'rbc')!

const feed = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title>Ставка &laquo;без изменений&raquo;</title>
    <link>https://www.rbc.ru/a</link>
    <pubDate>Tue, 20 Oct 2026 08:00:00 +0300</pubDate>
    <description>&lt;p&gt;Короткий лид&lt;/p&gt;</description>
    <rbc_news:full-text>&lt;p&gt;Полный текст новости.&lt;/p&gt;</rbc_news:full-text>
  </item>
  <item>
    <title>Новость без даты</title>
    <link>https://www.rbc.ru/b</link>
    <pubDate>не дата</pubDate>
    <description>&lt;b&gt;Лид&lt;/b&gt; второй новости</description>
  </item>
  <item>
    <title>Новость без ссылки</title>
  </item>
</channel></rss>`

const item = (id: string, title: string, publishedAt: string): NewsItem => ({
  id,
  sourceId: 'rbc',
  sourceName: 'РБК',
  title,
  text: '',
  url: `https://www.rbc.ru/${id}`,
  publishedAt,
  fetchedAt: publishedAt,
})

describe('news ingestion', () => {
  it('parses RSS items, prefers full text and strips HTML', () => {
    const items = parseFeed(feed, rbc, '2026-10-20T06:00:00.000Z')
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      sourceId: 'rbc',
      title: 'Ставка «без изменений»',
      text: 'Полный текст новости.',
      publishedAt: '2026-10-20T05:00:00.000Z',
    })
    expect(items[0]!.id).toMatch(/^news_[0-9a-f]{12}$/)
    expect(items[1]).toMatchObject({ text: 'Лид второй новости', publishedAt: null })
  })

  it('merges feeds without duplicates by URL or normalized title, newest first', () => {
    const merged = mergeNews(
      [item('a', 'Цены на нефть выросли', '2026-10-19T10:00:00.000Z')],
      [
        item('a', 'Другой заголовок той же ссылки', '2026-10-19T10:00:00.000Z'),
        item('b', 'ЦЕНЫ  на нефть выросли', '2026-10-20T10:00:00.000Z'),
        item('c', 'Рубль укрепился', '2026-10-21T10:00:00.000Z'),
      ],
    )
    expect(merged.map((n) => n.id)).toEqual(['c', 'a'])
  })

  it('drops news of sources removed from the feed list', () => {
    const removed = { ...item('t', 'Новость удаленной ленты', '2026-10-21T10:00:00.000Z'), sourceId: 'tass' }
    expect(mergeNews([removed, item('a', 'Рубль укрепился', '2026-10-20T10:00:00.000Z')], []).map((n) => n.id)).toEqual(['a'])
    expect(NEWS_SOURCES.map((s) => s.id)).not.toContain('tass')
  })

  it('includes the whole last day when until is a date', () => {
    const ids = (until: string) => newsSearch(buildDataContext(ctx.companies, bank, news), 'ставка сталь Китай', { until }).results.map((r) => r.documentId)
    expect(ids('2026-09-20')).toContain('news_steel')
    expect(ids('2026-09-19')).not.toContain('news_steel')
    expect(ids('2026-09-20T07:00:00.000Z')).not.toContain('news_steel')
  })
})

describe('bank corpus', () => {
  const table = 'Табл. 1\n\n\n| Показатель  | 2025 | 2026П |\n|---|---|---|\n| Курс, руб./юань |   11,2 | 13,0 |  \n'

  it('keeps table rows on separate lines and collapses spaces', () => {
    expect(normalizePageText(table)).toBe('Табл. 1\n\n| Показатель | 2025 | 2026П |\n|---|---|---|\n| Курс, руб./юань | 11,2 | 13,0 |')
  })

  it('verifies quotes that span line breaks', () => {
    const page = normalizePageText(table)
    const multiline = buildDataContext(ctx.companies, { documents: [{ ...bank.documents[0]!, pages: [page] }], chunks: [] }, [])
    expect(evidenceVerify(multiline, [{ documentId: 'bank_test', quote: '|---|---|---| | Курс, руб./юань | 11,2' }])[0]).toMatchObject({ verified: true, page: 1 })
  })

  it('chunks long pages with overlap and sentence boundaries', () => {
    const text = Array.from({ length: 60 }, (_, i) => `Предложение номер ${i} про ключевую ставку банка.`).join(' ')
    const spans = chunkPage(text)
    expect(spans.length).toBeGreaterThan(1)
    expect(spans[0]!.start).toBe(0)
    expect(spans.at(-1)!.end).toBe(text.length)
    for (const s of spans) expect(s.end - s.start).toBeLessThanOrEqual(1200)
    for (const s of spans.slice(0, -1)) expect(text[s.end - 1]).toBe('.')
    for (let i = 1; i < spans.length; i++) expect(spans[i]!.start).toBeLessThan(spans[i - 1]!.end)
  })
})

describe('answer sources', () => {
  it('maps footnotes to bank pages and news URLs, including nested quotes', () => {
    const answer = [
      'Вывод.',
      'Источники: [1] Альфа-Банк, «Синтетический обзор ставки», 11.09.2026, стр. 1; [2] Интерфакс, «"Экспорт стали в Китай вырос"», 20.09.2026; [3] ТАСС, «Неизвестная новость», 21.09.2026',
    ].join('\n')
    const sources = locateSources(answer, ctx, { bankPdfDir: '/pdf', bankPages: '/pages' })
    expect(sources.map((s) => s.where)).toEqual([
      [join('/pdf', 'test.pdf'), join('/pages', 'bank_test', 'p01.png')],
      ['https://www.interfax.ru/test'],
      ['не удалось сопоставить с документом'],
    ])
  })
})


describe('HTML-сущности в тексте новостей', () => {
  it('раскрывает типографские сущности и убирает мягкие переносы', () => {
    expect(stripHtml('ставка&shy;&shy; 14% &ndash; рост &euro;5 &#39;А&#39;&hellip;')).toBe("ставка 14% – рост €5 'А'…")
  })
})

describe('новости о боевых действиях', () => {
  it('скрывает новости про БПЛА, СВО и войну и не задевает похожие слова', () => {
    const t = (title: string) => isWarNews({ title })
    expect(t('За ночь над Россией сбили 136 БПЛА')).toBe(true)
    expect(t('Роструд: работу нашли 52% ветеранов СВО')).toBe(true)
    expect(t('Потери портов превысили 200 млрд руб. из-за атак беспилотников')).toBe(true)
    expect(t('Песков: переговоры по Украине пройдут в Абу-Даби')).toBe(true)
    expect(t('Вьетнам заключил соглашение о свободной торговле')).toBe(false)
    expect(t('Малые банки попросили освободить их от социальных вкладов')).toBe(false)
    expect(t('Банк России сохранил ключевую ставку')).toBe(false)
    expect(t('NYT: США и Израиль подготовят новые удары по Ирану')).toBe(true)
    expect(t('Хуситы заявили об ударе по минобороны Саудовской Аравии')).toBe(true)
    expect(t('КСИР сообщил о подрыве танкера в Ормузском проливе')).toBe(true)
    expect(t('Россиянам посоветовали зафиксировать доходность по вкладам')).toBe(false)
    expect(t('Пентагон планирует сеть агентов для экономической войны с Китаем')).toBe(false)
    expect(t('Банк России рекомендовал поддержать предпринимателей, пострадавших от терактов')).toBe(false)
  })
})
