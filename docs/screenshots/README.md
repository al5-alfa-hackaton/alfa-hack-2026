# Снимки рабочего пространства

Сняты Playwright/Chromium с реальным набором организаторов, без дорисовки. Компания — обезличенный CLIENT из CSV. Генерация отключена до настройки LLM; предупреждение на экране соответствует конфигурации сервиса.

login.png — вход без SSO; company-desktop.png — реальный профиль; feed-desktop.png/feed-dark.png/feed-tablet.png/feed-mobile.png — рабочая область в разных размерах/темах.

Из корня при работающем frontend/API:

```sh
SCREENSHOT_ACCOUNT_ID=dataset:U_1595 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium pnpm --filter @alfa/frontend screenshots
```

Скрипт открывает passwordless-сессию выбранного `SCREENSHOT_ACCOUNT_ID` и не сохраняет cookies/storage в репозиторий. Для другого инстанса задайте `SCREENSHOT_BASE_URL`. Снимки источников/вопросов следует снимать с подтверждённых реальных результатов после настройки LLM.
