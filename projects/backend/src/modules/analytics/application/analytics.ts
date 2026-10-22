import { createHash } from 'node:crypto'
import { AppError, requireCompany, type Principal } from '../../../shared/kernel/errors.js'
import type { Companies } from '../../companies/index.js'
import type { AnalyticsStore } from './ports.js'
import type { Feedback, Perspective, RunInput } from '../domain/model.js'
export class Analytics {
  constructor(
    readonly store: AnalyticsStore,
    private readonly companies: Companies,
    private readonly options: {
      reservation: number
      limit: number
      mode: 'fixture' | 'research'
      available?: boolean
    },
  ) {}
  get analysisAvailable() {
    return this.options.available !== false
  }
  get dataMode() {
    return this.options.mode
  }
  async start(p: Principal, input: RunInput, key: string) {
    this.companies.context(p, input.companyId)
    if (!this.analysisAvailable)
      throw new AppError(
        'unavailable',
        'Сервис анализа ещё не подключён. Обратитесь к администратору.',
        false,
      )
    if (input.kind === 'question') {
      if (!input.insightId || !input.question || !input.insightVersion)
        throw new AppError('invalid_request', 'Вопрос требует версии разбора')
      const insight = await this.detail(p, input.insightId, input.perspective)
      if (insight.companyId !== input.companyId || insight.version !== input.insightVersion)
        throw new AppError('version_conflict', 'Версия разбора изменилась')
    }
    if (input.timeRange && input.timeRange.since > input.timeRange.until)
      throw new AppError('invalid_request', 'Начало периода позже окончания')
    const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex')
    return this.store.createRun(
      p,
      input,
      key,
      fingerprint,
      this.options.reservation,
      this.options.limit,
      this.options.mode,
    )
  }
  async feed(p: Principal, companyId: string, perspective: Perspective) {
    this.companies.context(p, companyId)
    return (await this.store.insights(companyId, perspective)).filter(
      (i) => i.dataMode === this.dataMode,
    )
  }
  async detail(p: Principal, id: string, perspective: Perspective) {
    const insight = await this.store.insight(p, id, perspective)
    if (insight.dataMode !== this.dataMode) throw new AppError('not_found', 'Разбор не найден')
    requireCompany(p, insight.companyId)
    this.companies.context(p, insight.companyId)
    return insight
  }
  async state(
    p: Principal,
    id: string,
    perspective: Perspective,
    version?: string,
    patch?: { saved?: boolean; feedback?: Feedback },
  ) {
    const insight = await this.detail(p, id, perspective)
    if (version && version !== insight.version)
      throw new AppError('version_conflict', 'Версия разбора изменилась')
    return patch ? this.store.saveState(p, insight, patch) : this.store.userState(p, insight)
  }
}
