# Скриншоты frontend

Сняты с работающего приложения через Playwright/Chromium. Только synthetic fixtures; никакие реальные CSV, банковские документы и пользовательские данные не загружаются. Чистый browser context, light по умолчанию, reduced motion, ожидание document.fonts.ready. Reader/sources/conversation — crop реального Sheet, не дорисованный макет.

| Файл                | Размер viewport / объект               |
| ------------------- | -------------------------------------- |
| feed-desktop.png    | 1440×1000, персональная лента          |
| insight-reader.png  | Sheet внутри 1440×1000                 |
| sources.png         | Sheet, раскрытый источник              |
| conversation.png    | Sheet, реальный сценарный вопрос/ответ |
| company-desktop.png | 1440×1000, профиль                     |
| feed-dark.png       | 1440×1000, темная тема                 |
| feed-tablet.png     | 768×1024                               |
| feed-mobile.png     | 390×844                                |

Из корня, при запущенном frontend:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium pnpm --filter @alfa/frontend screenshots
```

Для bundled Chromium сначала `pnpm --filter @alfa/frontend exec playwright install chromium`, затем команду без переменной executable. По умолчанию цель — локальный порт 3000; для другого тестового инстанса `SCREENSHOT_BASE_URL`. Скрипт падает при pageerror, не сохраняет localStorage в репозиторий и не меняет приложение ради съемки.
