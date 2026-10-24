import { describe, expect, it } from 'vitest'
import { extractArticleText, isAllowedArticleUrl, trimArticleText } from '../src/news/fulltext.js'

describe('article full text', () => {
  it('prefers articleBody from JSON-LD, including @graph', () => {
    const html = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":"NewsArticle","articleBody":"Банк России сохранил ключевую ставку &laquo;14%&raquo;.\\n Решение принято единогласно."}]}</script></head><body><p>Меню сайта и прочие ссылки, которые не относятся к статье.</p></body></html>`
    expect(extractArticleText(html)).toEqual({ text: 'Банк России сохранил ключевую ставку «14%». Решение принято единогласно.', method: 'json-ld' })
  })

  it('falls back to article paragraphs and skips scripts, navigation and short lines', () => {
    const html = `<body><nav><p>Главная · Экономика · Финансы · Политика · Спорт</p></nav><article><h1>Заголовок</h1><p>Короткая</p><p>Ввод жилья в России за январь—сентябрь сократился на 13,4% год к году.</p><script>var x = "<p>не текст статьи и не должен попасть в результат</p>"</script><p>Индивидуальное жилищное строительство снизилось на 21% по данным ЦИАН.</p></article></body>`
    expect(extractArticleText(html)).toEqual({
      text: 'Ввод жилья в России за январь—сентябрь сократился на 13,4% год к году.\nИндивидуальное жилищное строительство снизилось на 21% по данным ЦИАН.',
      method: 'paragraphs',
    })
  })

  it('reads text blocks and picks the longest article on the page', () => {
    const html = `<body><article><p>Подписывайтесь на авторов, темы и рубрики, читайте рекомендации</p></article><article><p>Подписывайтесь на наш канал, чтобы следить за главными новостями дня.</p><div class="article__text">Цены на дизельное топливо на бирже выросли на 3% за неделю.</div><div class="article__text">Минфин обсуждает отмену импортного демпфера на дизель.</div><div class="banner">Реклама партнера, которая не относится к тексту статьи.</div></article></body>`
    expect(extractArticleText(html)?.text).toBe('Цены на дизельное топливо на бирже выросли на 3% за неделю.\nМинфин обсуждает отмену импортного демпфера на дизель.')
  })

  it('returns null when there is no article text', () => {
    expect(extractArticleText('<html><body><div>Пусто</div></body></html>')).toBeNull()
  })

  it('allows only https pages of the configured news domains', () => {
    expect(isAllowedArticleUrl(new URL('https://www.kommersant.ru/doc/1'))).toBe(true)
    expect(isAllowedArticleUrl(new URL('https://www.vedomosti.ru/economics/news/x'))).toBe(true)
    expect(isAllowedArticleUrl(new URL('http://www.vedomosti.ru/x'))).toBe(false)
    expect(isAllowedArticleUrl(new URL('https://evil-vedomosti.ru/x'))).toBe(false)
    expect(isAllowedArticleUrl(new URL('https://vedomosti.ru.evil.com/x'))).toBe(false)
    expect(isAllowedArticleUrl(new URL('https://ria.ru/20261020/x.html'))).toBe(false)
    expect(isAllowedArticleUrl(new URL('https://example.com/x'))).toBe(false)
  })
})

describe('хвосты статей', () => {
  it('убирает ссылки на другие материалы, рекламу и блоки «по теме»', () => {
    const text = [
      'Ставка сохранена на уровне 14%. Подробнее — в материале «Ъ» «Ословский торг».',
      'Рынок может удвоиться.',
      'Подробности — в материале «Размах на рубль» .',
      'Подберите вклад под максимальный % на Банки.ру',
      'Подберите вклад под максимальный % на Банки.ру',
      'Открывайте вклады разных банков онлайн на Банки.ру',
      'Читать по теме Россиянам посоветовали зафиксировать доходность Лента новостей 22.10.2026',
    ].join('\n')
    expect(trimArticleText(text)).toBe('Ставка сохранена на уровне 14%.\nРынок может удвоиться.')
  })

  it('не трогает обычный текст', () => {
    const text = 'Банк России сохранил ставку.\nАналитики ждут снижения в 2027 году; подробнее об этом рассказал глава ЦБ.'
    expect(trimArticleText(text)).toBe(text)
  })
})
