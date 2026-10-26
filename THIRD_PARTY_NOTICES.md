# Third-party notices

Шаблон использует следующие прямые зависимости. Транзитивные версии и integrity hashes зафиксированы в `pnpm-lock.yaml`; тексты лицензий находятся в установленных пакетах. Этот файл не заменяет обязательные license notices при дальнейшей дистрибуции.

## Прямые зависимости

| Компонент                    | Версия          | Лицензия   |
| ---------------------------- | --------------- | ---------- |
| @axe-core/playwright         | 4.14.0          | MPL-2.0    |
| @base-ui/react               | 1.9.0           | MIT        |
| @fastify/cookie              | 11.1.3          | MIT        |
| @fastify/cors                | 11.3.1          | MIT        |
| @fontsource-variable/manrope | 5.3.0           | OFL-1.1    |
| @hookform/resolvers          | 6.0.0           | MIT        |
| @langchain/core              | 1.2.13          | MIT        |
| @langchain/langgraph         | 1.4.18          | MIT        |
| @langchain/openai            | 1.6.0           | MIT        |
| @playwright/test             | 1.64.1          | Apache-2.0 |
| @shadcn/react                | 0.3.1           | MIT        |
| @tailwindcss/vite            | 4.3.3           | MIT        |
| @tanstack/react-query        | 5.104.5         | MIT        |
| @tanstack/react-router       | 1.170.45        | MIT        |
| @tanstack/react-start        | 1.169.3         | MIT        |
| @tanstack/router-cli         | 1.167.45        | MIT        |
| @types/node                  | 26.6.5          | MIT        |
| @types/pg                    | 8.23.1          | MIT        |
| @types/react                 | 19.3.0          | MIT        |
| @types/react-dom             | 19.3.0          | MIT        |
| @vitejs/plugin-react         | 6.1.2           | MIT        |
| class-variance-authority     | 0.7.1           | Apache-2.0 |
| cmdk                         | 1.1.1           | MIT        |
| cn                           | 0.5.0           | MIT        |
| csv-parse                    | 7.0.3           | MIT        |
| date-fns                     | 4.4.0           | MIT        |
| drizzle-kit                  | 0.31.11         | MIT        |
| drizzle-orm                  | 0.45.4          | Apache-2.0 |
| embla-carousel-react         | 8.6.0           | MIT        |
| fast-xml-parser              | 5.11.2          | MIT        |
| fastify                      | 5.12.7          | MIT        |
| input-otp                    | 1.5.0           | MIT        |
| lucide-react                 | 1.59.0          | ISC        |
| next-themes                  | 0.4.6           | MIT        |
| nitro                        | 3.0.260903-beta | MIT        |
| pg                           | 8.23.1          | MIT        |
| prettier                     | 3.9.10          | MIT        |
| radix-ui                     | 1.8.1           | MIT        |
| react                        | 19.3.1          | MIT        |
| react-day-picker             | 10.0.2          | MIT        |
| react-dom                    | 19.3.1          | MIT        |
| react-hook-form              | 7.90.0          | MIT        |
| react-resizable-panels       | 4.14.6          | MIT        |
| recharts                     | 3.8.0           | MIT        |
| shadcn                       | 4.22.1          | MIT        |
| snowball-stemmers            | 0.6.0           | ISC        |
| sonner                       | 2.0.8           | MIT        |
| tailwindcss                  | 4.3.3           | MIT        |
| tsx                          | 4.23.15         | MIT        |
| tw-animate-css               | 1.4.0           | MIT        |
| typescript                   | 5.9.3           | Apache-2.0 |
| unpdf                        | 1.8.1           | MIT        |
| vaul                         | 1.1.2           | MIT        |
| vite                         | 8.3.4           | MIT        |
| vitest                       | 5.0.5           | MIT        |
| zod                          | 4.6.7           | MIT        |

## Исходники UI

Компоненты `projects/frontend/src/components/ui/` и helper/hook импортированы официальным CLI shadcn/ui (MIT), стиль new-york-v4. Upstream: https://github.com/shadcn-ui/ui.

Copyright (c) 2023 shadcn.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Инфраструктура и материалы

- PostgreSQL 17: PostgreSQL License; Docker image postgres основан на Alpine, содержит компоненты с собственными лицензиями.
- Node.js 24: MIT и bundled third-party licenses; dev image основан на Debian. pnpm: MIT.
- `specs/source/brief.pdf`: предоставленный пользователем кейс Changellenge / Альфа-Банк, источник требований; права принадлежат соответствующим правообладателям, открытая лицензия на документ не заявляется.

## Модели, данные и интеграции

Research и backend используют LangChain/LangGraph, CSV/RSS/PDF/OCR, BullMQ/Redis и gateway разрешённых моделей. Источники и исторические результаты — packages/agent/README.md. Исходные CSV, PDF банка, OCR/run outputs исключены из Git. SSO и банковские операции не реализованы. Redis 7.4 имеет собственные условия лицензирования (RSALv2/SSPLv1); проверьте их при deployment. BullMQ — MIT.

Локальный OCR использует установленный Tesseract (Apache-2.0). Языковые файлы rus/eng в этой среде — tessdata_fast / системная поставка; загрузка rus: https://github.com/tesseract-ocr/tessdata_fast (Apache-2.0). Бинарники и обученные данные в репозиторий не включены.


## prompt-kit chat components

Adapted chat-container and scroll-button from https://github.com/ibelick/prompt-kit.

MIT License

Copyright (c) 2025 Julien Thibeaut

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. app/page.tsx


## News loading animation

News by Priyanshu Rijhwani; illustration credited to Freepik by the author.
Source: https://lottiefiles.com/free-animation/news-CSx8aXz0pk
License: Lottie Simple License, https://lottiefiles.com/page/license
Local adaptation: colored accents changed to Alfa red; JSON extracted from dotLottie.
