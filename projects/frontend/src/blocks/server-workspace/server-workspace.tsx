import { useEffect, useRef, useState } from 'react'
import {
  loadServerCompanies,
  loadServerContext,
  type ServerCompany,
  type ServerCompanyContext,
} from '@/entities/company'
import {
  startServerAnalysis,
  loadServerRun,
  cancelServerRun,
  loadServerInsights,
  type ServerRun,
  type ServerInsight,
} from '@/entities/analysis'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { ApiError } from '@/shared/lib'
const isTerminal = (status: ServerRun['status']) =>
  ['completed', 'partial', 'failed', 'cancelled'].includes(status)
export function ServerWorkspace() {
  const [companies, setCompanies] = useState<ServerCompany[]>([])
  const [companyId, setCompanyId] = useState('')
  const [perspective, setPerspective] = useState<'cfo' | 'ceo'>('cfo')
  const [context, setContext] = useState<ServerCompanyContext>()
  const [items, setItems] = useState<ServerInsight[]>([])
  const [run, setRun] = useState<ServerRun>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const scope = useRef<AbortController | null>(null)
  const describeError = (e: unknown) =>
    e instanceof ApiError ? e.message : 'Не удалось связаться с сервисом. Повторите попытку.'
  useEffect(() => {
    const abort = new AbortController()
    setError('')
    loadServerCompanies(abort.signal)
      .then((data) => {
        setCompanies(data)
        setCompanyId(data[0]?.id ?? '')
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(describeError(e))
      })
    return () => abort.abort()
  }, [revision])
  useEffect(() => {
    const abort = new AbortController()
    scope.current = abort
    setError('')
    setContext(undefined)
    setItems([])
    setRun(undefined)
    setBusy(false)
    if (companyId)
      Promise.all([
        loadServerContext(companyId, abort.signal),
        loadServerInsights(companyId, perspective, abort.signal),
      ])
        .then(([profile, feed]) => {
          setContext(profile)
          setItems(feed)
        })
        .catch((e) => {
          if (!abort.signal.aborted) setError(describeError(e))
        })
    return () => abort.abort()
  }, [companyId, perspective, revision])
  async function refresh() {
    const signal = scope.current?.signal
    if (!signal || !companyId || busy) return
    setBusy(true)
    setError('')
    try {
      const accepted = await startServerAnalysis(
        companyId,
        perspective,
        crypto.randomUUID(),
        signal,
      )
      let current = await loadServerRun(accepted.runId, signal)
      setRun(current)
      while (!isTerminal(current.status)) {
        await new Promise<void>((resolve, reject) => {
          const abort = () => {
            clearTimeout(timer)
            reject(signal.reason)
          }
          const timer = setTimeout(() => {
            signal.removeEventListener('abort', abort)
            resolve()
          }, 750)
          signal.addEventListener('abort', abort, { once: true })
          if (signal.aborted) abort()
        })
        current = await loadServerRun(accepted.runId, signal)
        setRun(current)
      }
      if (current.status === 'failed') throw new Error('analysis_failed')
      if (current.status === 'completed' || current.status === 'partial')
        setItems(await loadServerInsights(companyId, perspective, signal))
    } catch (e) {
      if (!signal.aborted) setError(describeError(e))
    } finally {
      if (!signal.aborted) setBusy(false)
    }
  }
  return (
    <section className="space-y-6 pt-5" aria-label="Данные сервиса">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={companyId} onValueChange={setCompanyId} disabled={busy || !companies.length}>
          <SelectTrigger className="w-60" aria-label="Компания в сервисе">
            <SelectValue placeholder="Выберите компанию" />
          </SelectTrigger>
          <SelectContent>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={perspective}
          onValueChange={(v) => setPerspective(v as 'cfo' | 'ceo')}
          disabled={busy}
        >
          <SelectTrigger className="w-56" aria-label="Ракурс анализа">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cfo">Финансовый директор</SelectItem>
            <SelectItem value="ceo">Генеральный директор</SelectItem>
          </SelectContent>
        </Select>
        {context && (
          <Badge variant="outline">
            {context.dataMode === 'fixture' ? 'Учебный набор' : 'Research-данные'}
          </Badge>
        )}
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Данные недоступны</AlertTitle>
          <AlertDescription>
            {error}
            <Button variant="outline" size="sm" onClick={() => setRevision((v) => v + 1)}>
              Повторить
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {context && (
        <>
          <h2 className="text-xl font-semibold">{context.company.displayName}</h2>
          <Table>
            <TableBody>
              {context.features.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{f.label}</TableCell>
                  <TableCell>{f.value ?? 'Нет данных'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-sm leading-6 text-muted-foreground">{context.limitations.join(' ')}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={busy} onClick={() => void refresh()}>
              {busy ? 'Анализируем…' : 'Сформировать сводку'}
            </Button>
            {busy && run && (
              <Button
                variant="outline"
                disabled={run.status === 'cancelling'}
                onClick={() =>
                  void cancelServerRun(run.id)
                    .then(setRun)
                    .catch((e) => setError(describeError(e)))
                }
              >
                Отменить
              </Button>
            )}
            {run && (
              <span role="status" className="text-sm text-muted-foreground">
                {
                  {
                    queued: 'В очереди',
                    running: 'Анализ выполняется',
                    cancelling: 'Отменяем',
                    cancelled: 'Отменён',
                    partial: 'Готово с ограничениями',
                    completed: 'Готово',
                    failed: 'Не удалось завершить',
                  }[run.status]
                }
              </span>
            )}
          </div>
          {!items.length && !busy && (
            <p className="text-sm text-muted-foreground">Сводка ещё не сформирована.</p>
          )}
          {items.map((i) => (
            <article key={i.id} className="space-y-3 border-t pt-5">
              <h3 className="font-semibold">{i.event.title}</h3>
              <p className="whitespace-pre-line text-sm leading-7">{i.summary}</p>
              <p className="text-xs leading-5 text-muted-foreground">{i.limitations.join(' ')}</p>
            </article>
          ))}
        </>
      )}
    </section>
  )
}
