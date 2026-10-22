import { FileText, Link2 } from 'lucide-react'
import { companies } from '@/entities/company'
import { useWorkspace } from '@/entities/workspace'
import type { News } from '@/entities/insight'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

export function SourcesPanel({ item }: { item: News }) {
  const { session } = useWorkspace()
  const sources = [
    {
      id: 'news',
      title: item.source,
      label: 'Учебная новость · фрагмент 1 · 21.10.2026',
      text: item.fact,
    },
    {
      id: 'profile',
      title: `Профиль «${companies[session.company].name}»`,
      label: 'Синтетический профиль · версия 1',
      text: item.context[session.company].reason,
    },
    ...(item.bank
      ? [
          {
            id: 'bank',
            title: 'Учебная аналитическая записка',
            label: 'Смоделированный материал · не позиция банка',
            text: item.bank,
          },
        ]
      : []),
  ]
  return (
    <section>
      <p className="mb-4 text-sm leading-6 text-muted-foreground">
        Встроенные учебные документы. Реальные публикации и материалы банка в демо не подключены.
      </p>
      <Accordion type="multiple" defaultValue={['news']}>
        {sources.map((source, index) => (
          <AccordionItem key={source.id} value={source.id}>
            <AccordionTrigger className="gap-3 py-5 text-left text-sm">
              <span className="flex items-center gap-3">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span>
                  <span className="mr-2 tabular-nums text-muted-foreground">[{index + 1}]</span>
                  {source.title}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <p className="mb-4 text-xs text-muted-foreground">{source.label}</p>
              <blockquote className="border-l-2 pl-4 text-sm leading-7">{source.text}</blockquote>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
        <Link2 className="mt-0.5 size-3.5 shrink-0" />В рабочем сервисе здесь появятся ссылки на
        публикации и страницы PDF. Учебные документы доступны только как фрагменты выше.
      </p>
    </section>
  )
}
