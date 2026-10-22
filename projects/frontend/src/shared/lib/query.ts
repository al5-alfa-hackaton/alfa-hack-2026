import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from './api'

export function createQueryClient() {
  const expired = (error: unknown) => {
    if (error instanceof ApiError && error.status === 401)
      void client.invalidateQueries({ queryKey: ['me'] })
  }
  const client = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.queryKey[0] !== 'me') expired(error)
      },
    }),
    mutationCache: new MutationCache({ onError: expired }),
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        retry: (count, error) => count < 1 && !(error instanceof ApiError && error.status < 500),
        refetchOnWindowFocus: true,
      },
    },
  })
  return client
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Сервис недоступен. Повторите попытку.'
}
