import { describe, expect, it } from 'vitest'
import { extractArticleText, isAllowedArticleUrl } from '../src/news/fulltext.js'

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
    expect(isAllowedArticleUrl(new URL('https://ria.ru/20261020/x.html'))).toBe(true)
    expect(isAllowedArticleUrl(new URL('http://ria.ru/x'))).toBe(false)
    expect(isAllowedArticleUrl(new URL('https://evil-ria.ru/x'))).toBe(false)
    expect(isAllowedArticleUrl(new URL('https://ria.ru.evil.com/x'))).toBe(false)
    expect(isAllowedArticleUrl(new URL('https://example.com/x'))).toBe(false)
  })
})
