# Снимки рабочего пространства

Сняты Playwright/Chromium с реальным набором организаторов, без дорисовки. Компания — обезличенный CLIENT из CSV. Генерация отключена до настройки LLM; предупреждение на экране соответствует конфигурации сервиса.

login.png — вход без SSO; company-desktop.png — реальный профиль; feed-desktop.png/feed-dark.png/feed-tablet.png/feed-mobile.png — рабочая область в разных размерах/темах.

Из корня при работающем frontend/API:

```sh
SCREENSHOT_USERNAME=client_u_1595 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium pnpm --filter @alfa/frontend screenshots
```

Логин и пароль читаются из docs/dataset-accounts.md; значения не выводятся. Скрипт не сохраняет cookies/storage в репозиторий. Для другого инстанса задайте SCREENSHOT_BASE_URL. Снимки источников/вопросов при необходимости следует снимать с подтверждённых реальных результатов после настройки LLM, без подстановки fixtures.
