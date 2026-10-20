import { createFileRoute } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl items-center px-6 py-16">
      <Card className="w-full">
        <CardHeader>
          <Badge variant="secondary" className="mb-3">Шаблон проекта</Badge>
          <CardTitle className="text-2xl">Новостная аналитика</CardTitle>
          <CardDescription>React · TanStack Start · shadcn/ui</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Основа для будущего сервиса персонализированных бизнес-инсайтов.
        </CardContent>
      </Card>
    </main>
  )
}
