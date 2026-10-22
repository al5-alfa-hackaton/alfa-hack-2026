import { useState } from 'react'
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
  const page = evidence.page ?? 1
  const document = useDocument(evidence.documentId, page, offset)
  const data = document.data
  const external = data?.externalUrl?.startsWith('https://') ? data.externalUrl : null
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {evidence.sourceKind === 'bank' ? 'Материал банка' : 'Новость'} ·{' '}
        {evidence.contentExtent === 'lead' ? 'Доступен лид публикации' : 'Страница ' + page}
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
      {data && (
        <>
          <h4 className="text-sm font-medium">{data.title}</h4>
          <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
            {data.text || 'Текст страницы недоступен.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {offset > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset(Math.max(0, offset - 4000))}
              >
                Предыдущий фрагмент
              </Button>
            )}
            {offset + data.text.length < data.totalLength && (
              <Button variant="outline" size="sm" onClick={() => setOffset(offset + 4000)}>
                Следующий фрагмент
              </Button>
            )}
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
export function SourcesPanel({ item }: { item: Insight }) {
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
      <Accordion type="multiple">
        {item.evidence.map((evidence) => (
          <AccordionItem key={evidence.id} value={evidence.id}>
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
