import createClient from 'openapi-fetch'
import type { paths, operations } from './schema.js'
export type { paths, operations }
export function createApiClient(
  options: {
    baseUrl?: string
    fetch?: typeof globalThis.fetch
    token?: () => string | undefined
  } = {},
) {
  const client = createClient<paths>({
    baseUrl: options.baseUrl ?? '/api',
    ...(options.fetch ? { fetch: options.fetch } : {}),
    credentials: 'same-origin',
  })
  if (options.token)
    client.use({
      onRequest({ request }) {
        const token = options.token?.()
        if (token) request.headers.set('Authorization', `Bearer ${token}`)
        return request
      },
    })
  return client
}
export type ApiClient = ReturnType<typeof createApiClient>
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly requestId?: string,
  ) {
    super(message)
  }
}
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error || !result.response.ok) {
    const error = result.error as
      { code?: string; message?: string; requestId?: string } | undefined
    throw new ApiError(
      error?.code ?? 'unavailable',
      error?.message ?? 'Сервис временно недоступен',
      result.response.status,
      error?.requestId,
    )
  }
  return result.data as T
}
