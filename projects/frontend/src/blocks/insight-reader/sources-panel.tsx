import { useEffect, useRef, useState } from 'react'
import { ExternalLink, FileText } from 'lucide-react'
import { useDocument, type Insight } from '@/entities/insight'
import { errorMessage } from '@/shared/lib'
import { RequestError, RequestSkeleton } from '@/components/request-state'
import { Button } from '@/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

function DocumentFragment({ evidence }: { evidence: Insight['evidence'][number] }) {
  const [offset, setOffset] = useState(0)
  const [image, setImage] = useState(false)
  const fragment = useRef<HTMLParagraphElement>(null)
  const page = evidence.page ?? 1
  const document = useDocument(evidence.documentId, page, offset)
  const data = document.data
  useEffect(() => {
    if (!document.isPlaceholderData && data && fragment.current) fragment.current.scrollTop = 0
  }, [data, document.isPlaceholderData])
  const hasPrevious = offset > 0
  const hasNext = !!data && offset + 4000 < data.totalLength
  const paginated = hasPrevious || (data?.totalLength ?? 0) > 4000
  const external = data?.externalUrl?.startsWith('https://') ? data.externalUrl : null
  return (
    <div className="space-y-4" aria-busy={document.isFetching}>
      <p className="text-xs text-muted-foreground">
        {evidence.sourceKind === 'bank' ? 'Материал банка' : 'Новость'} ·{' '}
        {evidence.contentExtent === 'lead'
          ? 'Доступен лид публикации'
          : evidence.contentExtent === 'full_text'
            ? 'Полный текст публикации'
            : 'Страница ' + page}
        {evidence.publishedAt && ' · ' + new Date(evidence.publishedAt).toLocaleDateString('ru-RU')}
      </p>
      <blockquote className="border-l-2 pl-4 text-sm leading-7">{evidence.quote}</blockquote>
      {document.isPending && <RequestSkeleton />}
      {document.error && (
        <RequestError
          message={errorMessage(document.error)}
          onRetry={() => void document.refetch()}
        />
      )}
      {paginated && (
        <nav aria-label="Фрагменты документа" className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasPrevious || document.isFetching}
            onClick={() => setOffset((current) => Math.max(0, current - 4000))}
          >
            Предыдущий фрагмент
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasNext || document.isFetching || !!document.error}
            onClick={() => setOffset((current) => current + 4000)}
          >
            Следующий фрагмент
          </Button>
          <span role="status" className="text-xs text-muted-foreground">
            {document.isFetching
              ? 'Загружаем фрагмент…'
              : document.error
                ? 'Фрагмент не загружен'
                : `Фрагмент ${Math.floor(offset / 4000) + 1} из ${Math.ceil((data?.totalLength ?? 0) / 4000)}`}
          </span>
        </nav>
      )}
      {data && (
        <>
          <h4 className="text-sm font-medium">{data.title}</h4>
          <div className={paginated ? 'relative' : ''}>
            <p
              className={
                'whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground ' +
                (paginated
                  ? 'h-[min(40dvh,360px)] overflow-y-auto overscroll-contain rounded-lg bg-muted/20 p-4 focus-visible:ring-2 focus-visible:ring-ring'
                  : '')
              }
              ref={fragment}
              role={paginated ? 'region' : undefined}
              tabIndex={paginated ? 0 : undefined}
              aria-label={paginated ? 'Текст фрагмента' : undefined}
            >
              {data.text || 'Текст страницы недоступен.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {external && (
              <Button variant="outline" size="sm" asChild>
                <a href={external} target="_blank" rel="noopener noreferrer">
                  Публикация
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            )}
            {evidence.sourceKind === 'bank' && (
              <Button variant="outline" size="sm" onClick={() => setImage(!image)}>
                {image ? 'Скрыть страницу' : 'Открыть страницу PDF'}
              </Button>
            )}
          </div>
          {image && (
            <img
              loading="lazy"
              src={
                '/api/v1/documents/' +
                encodeURIComponent(evidence.documentId) +
                '/pages/' +
                page +
                '/image'
              }
              alt={'Страница ' + page + ' — ' + data.title}
              className="w-full rounded-md border"
              onError={() => {
                setImage(false)
              }}
            />
          )}
        </>
      )}
    </div>
  )
}
export function SourcesPanel({ item, selectedSource }: { item: Insight; selectedSource?: string }) {
  const [expanded, setExpanded] = useState<string[]>(selectedSource ? [selectedSource] : [])
  const selected = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (selectedSource) {
      setExpanded((current) => [...new Set([...current, selectedSource])])
      selected.current?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedSource])
  return (
    <section>
      <p className="mb-4 text-sm leading-6 text-muted-foreground">
        Цитаты, прошедшие проверку по доступному тексту источника. Наличие цитаты само по себе не
        подтверждает интерпретацию.
      </p>
      {!item.evidence.length && (
        <p className="text-sm text-muted-foreground">
          Подтверждённых источников для этого разбора нет.
        </p>
      )}
      <Accordion type="multiple" value={expanded} onValueChange={setExpanded}>
        {item.evidence.map((evidence) => (
          <AccordionItem
            key={evidence.id}
            value={evidence.id}
            ref={evidence.id === selectedSource ? selected : undefined}
          >
            <AccordionTrigger className="gap-3 py-5 text-left text-sm">
              <span className="flex items-center gap-3">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span>
                  [{evidence.id}]{' '}
                  {evidence.sourceKind === 'bank' ? 'Материал банка' : 'Новостная публикация'}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <DocumentFragment evidence={evidence} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
