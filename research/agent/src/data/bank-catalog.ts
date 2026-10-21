export type BankCatalogEntry = { title: string; publishedAt: string; note?: string }

export const BANK_CATALOG: Record<string, BankCatalogEntry> = {
  'ALFA-Macro_Insights-Policy_Rate_11Sep.pdf': {
    title: 'Ключевая ставка ЦБ РФ: ставка без изменения на 14,0%, риторика стала жестче',
    publishedAt: '2026-09-11',
  },
  'Бонд_Бриф_14092026.pdf': { title: 'Бонд Бриф: итоги недели', publishedAt: '2026-09-14' },
  'ALFA-7M26.pdf': {
    title: 'Макростатистика 7М26: данные по рынку труда не подтверждают охлаждения экономики',
    publishedAt: '2026-09-07',
  },
  'Inflation_tracker_02.pdf': { title: 'Инфляция 25–31 августа: основные выводы', publishedAt: '2026-09-02' },
  'Gold_digest_August26.pdf': { title: 'Обзор рынка золота, август 2026', publishedAt: '2026-08' },
  'ALFA-consumption.pdf': { title: 'Потребление на пике', publishedAt: '2026-08-05' },
  'ALFA-macro_stat1H26.pdf': {
    title: 'Макростатистика 1П26: слабый рост 1П26 смещает прогноз роста ВВП на 0,1% за год',
    publishedAt: '2026-07-31',
  },
  'FI_Strategy_3Q26_22072026.pdf': {
    title: 'Тактический взгляд на 3-й квартал 2026 года: время собирать камни',
    publishedAt: '2026-07-22',
  },
  'ALFA_Russian_Steels_1К21PreviewUpdate_15Apr2021.pdf': {
    title: 'Российская сталь: ралли цен продолжается; прогноз результатов за 1К21',
    publishedAt: '2021-04-15',
    note: 'Материал 2021 года, нет в списке материалов кейса; оценки устарели',
  },
}
