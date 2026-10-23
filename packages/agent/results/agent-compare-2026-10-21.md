# Сравнение моделей агента — 2026-10-21

Промпт: stage1-2026-10-21.8. reasoning_effort: none. Лимиты: 12 шагов, 20 вызовов.
Полные ответы сохранены вне git (`data/processed/runs/`): содержат цитаты материалов банка.

## Итого по моделям

| Модель | Ответил сам | Шагов в среднем | Время в среднем, с | Токенов в среднем | Стоимость всего |
| --- | --- | --- | --- | --- | --- |
| deepseek/deepseek-v4.1-flash | 5/5 | 5.0 | 19.9 | 72833 | 1.784 |

## По вопросам

- **U_9250**: Доходности ОФЗ выросли после заседания ЦБ 11 сентября. Как это влияет на стоимость финансирования компании?
- **U_1595**: Банк ожидает охлаждения потребительского спроса. Что это значит для компании?
- **U_57706**: Цены на бензин продолжают расти, инфляция ускорилась. Как это влияет на компанию?
- **U_68157**: Как рост льготного кредитования и кредитов застройщикам влияет на компанию?
- **U_3263**: Рынок труда остается напряженным, зарплаты растут. Что это значит для компании?

| Компания | Модель | Остановка | Шагов | Вызовов | Инструменты | Фрагментов банка найдено | Источников: банк / новости | Не сопоставлены с документом | Время, с | Токены | Стоимость |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| U_9250 | deepseek/deepseek-v4.1-flash | answered | 5 | 10 | company_profile, bank_search, news_search, company_counterparties, company_group, document_read, evidence_verify | 5 | 1 / 1 | — | 19.1 | 69075 | 0.332 |
| U_1595 | deepseek/deepseek-v4.1-flash | answered | 6 | 12 | company_profile, bank_search, company_counterparties, document_read, news_search, evidence_verify | 20 | 2 / 1 | — | 22.4 | 96942 | 0.401 |
| U_57706 | deepseek/deepseek-v4.1-flash | answered | 5 | 10 | company_profile, bank_search, news_search, company_counterparties, document_read, evidence_verify | 15 | 3 / 0 | — | 20.0 | 72770 | 0.339 |
| U_68157 | deepseek/deepseek-v4.1-flash | answered | 5 | 12 | company_profile, bank_search, news_search, company_counterparties, company_group, document_read, evidence_verify | 10 | 2 / 2 | — | 21.7 | 70302 | 0.392 |
| U_3263 | deepseek/deepseek-v4.1-flash | answered | 4 | 7 | company_profile, bank_search, news_search, company_counterparties, evidence_verify | 15 | 3 / 1 | — | 16.1 | 55077 | 0.319 |
