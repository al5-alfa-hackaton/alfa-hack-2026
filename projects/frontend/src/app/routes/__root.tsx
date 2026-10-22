import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Providers } from '../providers'
import { WorkspaceShell } from '@/blocks/workspace-shell'
import { Button } from '@/components/ui/button'
import styles from '../styles.css?url'

export const Route = createRootRoute({
  validateSearch: (search: Record<string, unknown>): { insight?: string } => ({
    insight:
      typeof search.insight === 'string' && search.insight.length <= 80
        ? search.insight
        : undefined,
  }),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Альфа Бизнес — Новостная аналитика' },
      {
        name: 'description',
        content:
          'События рынка в контексте вашей компании. Интерактивная демонстрация новостной аналитики.',
      },
    ],
    links: [{ rel: 'stylesheet', href: styles }],
  }),
  shellComponent: RootDocument,
  component: () => (
    <WorkspaceShell>
      <Outlet />
    </WorkspaceShell>
  ),
  notFoundComponent: () => (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Страница не найдена</h1>
      <p className="text-sm text-muted-foreground">
        Возможно, адрес изменился. Вернитесь к сводке событий.
      </p>
      <Button asChild variant="outline">
        <a href="/">К событиям</a>
      </Button>
    </section>
  ),
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <Providers>{children}</Providers>
        <Scripts />
      </body>
    </html>
  )
}
