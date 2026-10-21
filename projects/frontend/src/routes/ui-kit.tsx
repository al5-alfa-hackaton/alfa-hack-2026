import { createFileRoute, Link } from '@tanstack/react-router'
import { useTheme } from 'next-themes'
import { ArrowUpRight, Check, Moon, Sparkles, Sun } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'

export const Route = createFileRoute('/ui-kit')({ component: UIKit })

function UIKit() {
  const { setTheme } = useTheme()
  return (
    <main className="mx-auto max-w-6xl space-y-10 px-5 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <Link to="/" className="flex items-center gap-3 font-semibold"><span className="flex size-10 items-center justify-center rounded-xl bg-brand text-xl font-bold text-white" aria-hidden="true">А</span>Новостная аналитика</Link>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" aria-label="Светлая тема" onClick={() => setTheme('light')}><Sun /></Button>
          <Button variant="outline" size="icon" aria-label="Тёмная тема" onClick={() => setTheme('dark')}><Moon /></Button>
        </div>
      </header>
      <section className="max-w-2xl space-y-4">
        <Badge variant="insight"><Sparkles /> UI-kit · Альфа</Badge>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Ясность в каждом решении.</h1>
        <p className="text-lg leading-relaxed text-muted-foreground">Красный направляет к действию. Лаймовый отмечает результат. Фиолетовый выделяет аналитические выводы.</p>
      </section>
      <section aria-label="Палитра" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Красный', 'Основные действия', 'bg-brand'],
          ['Белый', 'Чистые поверхности', 'bg-white border'],
          ['Лаймовый', 'Успех и возможности', 'bg-success'],
          ['Фиолетовый', 'AI и аналитика', 'bg-insight'],
        ].map(([name, role, color]) => <Card key={name} className="gap-3 py-4"><CardContent className="space-y-3 px-4"><div className={`h-16 rounded-lg ${color}`} /><div><p className="font-medium">{name}</p><p className="text-xs text-muted-foreground">{role}</p></div></CardContent></Card>)}
      </section>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Действия и состояния</CardTitle><CardDescription>Общие варианты компонентов для всего продукта.</CardDescription></CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => toast.success('Демонстрация: действие выполнено')}>Сформировать сводку <ArrowUpRight /></Button>
              <Button variant="secondary" onClick={() => toast('Демонстрация вторичного действия')}>Подробнее</Button>
              <Button variant="outline" onClick={() => toast('Демонстрация экспорта')}>Экспорт</Button>
              <Button disabled>Недоступно</Button>
            </div>
            <Separator />
            <div className="flex flex-wrap gap-2"><Badge>Важное</Badge><Badge variant="success"><Check /> Возможность</Badge><Badge variant="insight"><Sparkles /> AI-вывод</Badge><Badge variant="destructive">Риск</Badge><Badge variant="secondary">Нейтральное</Badge></div>
            <Dialog><DialogTrigger asChild><Button variant="ghost">Открыть диалог</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Всё важное — в одном месте</DialogTitle><DialogDescription>Пример диалога UI-kit. Поверхности, текст и фокус используют общую тему.</DialogDescription></DialogHeader></DialogContent></Dialog>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Настройки сводки</CardTitle><CardDescription>Демонстрационная форма, данные не отправляются.</CardDescription></CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); toast.success('Демонстрация: настройки сохранены') }}>
              <div className="space-y-2"><Label htmlFor="company">Компания</Label><Input id="company" name="company" placeholder="Название компании" required /></div>
              <div className="space-y-2"><Label htmlFor="email">Рабочая почта</Label><Input id="email" name="email" type="email" placeholder="name@company.ru" required /></div>
              <div className="flex items-center justify-between gap-3"><Label htmlFor="digest">Ежедневная сводка</Label><Switch id="digest" defaultChecked /></div>
              <Button type="submit">Сохранить настройки</Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <section aria-label="Пример аналитики">
        <Tabs defaultValue="insight">
          <TabsList><TabsTrigger value="insight">AI-аналитика</TabsTrigger><TabsTrigger value="sources">Источники</TabsTrigger></TabsList>
          <TabsContent value="insight"><Card className="border-insight bg-insight text-insight-foreground"><CardHeader><div className="mb-2"><Badge variant="insight"><Sparkles /> Пример интерпретации</Badge></div><CardTitle>От события — к его влиянию на бизнес</CardTitle><CardDescription className="text-insight-muted-foreground">Здесь появится персонализированный вывод с объяснением рисков, возможностей и связью с первоисточником.</CardDescription></CardHeader></Card></TabsContent>
          <TabsContent value="sources"><Card><CardContent className="pt-6 text-sm text-muted-foreground">В рабочем продукте здесь будут источники и материалы, на которых основан вывод. Это демонстрация компонентов.</CardContent></Card></TabsContent>
        </Tabs>
      </section>
      <footer className="border-t pt-6 text-sm text-muted-foreground">shadcn/ui · Общие компоненты, единая тема, светлый и тёмный режимы.</footer>
    </main>
  )
}
