export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false,
    public readonly resetAt?: string,
  ) {
    super(message)
  }
}
export type Principal = { id: string; companyIds: readonly string[] }
export function requireCompany(principal: Principal, companyId: string) {
  if (!principal.companyIds.includes(companyId))
    throw new AppError('not_found', 'Компания недоступна')
}
