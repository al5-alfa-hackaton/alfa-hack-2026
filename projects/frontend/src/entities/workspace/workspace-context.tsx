import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { loadServerCompanies, loadServerContext, type Role } from '@/entities/company'
import { api, ApiError, unwrap } from '@/shared/lib'

function useWorkspaceState() {
  const cache = useQueryClient()
  const [companyId, setCompanyId] = useState('')
  const [role, setRole] = useState<Role>('cfo')
  const [preferencesUser, setPreferencesUser] = useState<string | null>(null)
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async ({ signal }) => unwrap(await api.GET('/v1/me', { signal })),
    refetchInterval: 60_000,
    retry: false,
  })
  const unauthorized = me.error instanceof ApiError && me.error.status === 401
  const user = unauthorized ? undefined : me.data
  const companies = useQuery({
    queryKey: ['companies', user?.id],
    queryFn: ({ signal }) => loadServerCompanies(signal),
    enabled: !!user,
  })
  const company = companies.data?.find((c) => c.id === companyId) ?? companies.data?.[0]
  const session = { company: company?.id ?? '', role }
  useEffect(() => {
    if (!user || preferencesUser === user.id) return
    try {
      const saved: unknown = JSON.parse(
        sessionStorage.getItem('alfa-workspace:' + user.id) ?? 'null',
      )
      if (
        saved &&
        typeof saved === 'object' &&
        'company' in saved &&
        'role' in saved &&
        typeof saved.company === 'string' &&
        saved.company.length <= 100 &&
        (saved.role === 'cfo' || saved.role === 'ceo')
      ) {
        setCompanyId(saved.company)
        setRole(saved.role)
      }
    } catch {
      /* Preferences are optional; server data never depends on browser storage. */
    }
    setPreferencesUser(user.id)
  }, [user?.id, preferencesUser])
  useEffect(() => {
    if (!user || preferencesUser !== user.id || !company) return
    try {
      sessionStorage.setItem('alfa-workspace:' + user.id, JSON.stringify(session))
    } catch {
      /* A storage restriction must not block the workspace. */
    }
  }, [user?.id, preferencesUser, session.company, session.role])
  const context = useQuery({
    queryKey: ['context', user?.id, session.company],
    queryFn: ({ signal }) => loadServerContext(session.company, signal),
    enabled: !!user && !!company,
  })
  return {
    user,
    unauthorized,
    session,
    company,
    companies: companies.data ?? [],
    context,
    ready: !!user && companies.isSuccess && preferencesUser === user.id,
    loading: me.isPending || (!!user && (companies.isPending || preferencesUser !== user.id)),
    error: unauthorized ? null : (me.error ?? companies.error),
    retry: () => {
      void me.refetch()
      void companies.refetch()
    },
    setScope: (scope: { company?: string; role?: Role }) => {
      if (scope.company !== undefined) setCompanyId(scope.company)
      if (scope.role) setRole(scope.role)
    },
    login: async (token: string) => {
      unwrap(await api.POST('/v1/session', { body: { token } }))
      cache.clear()
      setCompanyId('')
      setRole('cfo')
      setPreferencesUser(null)
      await me.refetch()
    },
    logout: async () => {
      unwrap(await api.DELETE('/v1/session'))
      cache.clear()
      setCompanyId('')
      setRole('cfo')
      setPreferencesUser(null)
      await me.refetch()
    },
  }
}
const WorkspaceContext = createContext<ReturnType<typeof useWorkspaceState> | null>(null)
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const value = useWorkspaceState()
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('WorkspaceProvider is required')
  return context
}
