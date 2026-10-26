import { useDeferredValue, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, LoaderCircle, UserRound } from 'lucide-react'
import { useWorkspace } from '@/entities/workspace'
import { api, errorMessage, unwrap, type operations } from '@/shared/lib'
import { Brand } from '@/components/brand'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RegistrationForm } from './registration-form'

type Account =
  operations['searchAccounts']['responses'][200]['content']['application/json']['items'][number]

export function LoginPanel() {
  const { login } = useWorkspace()
  const [tab, setTab] = useState('login')
  const [search, setSearch] = useState('')
  const [opening, setOpening] = useState('')
  const [error, setError] = useState('')
  const query = useDeferredValue(search)
  const accounts = useQuery({
    queryKey: ['account-search', query],
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/v1/accounts', { params: { query: { q: query } }, signal })).items,
    retry: false,
  })

  async function open(account: Account) {
    setError('')
    setOpening(account.id)
    try {
      await login(account.id)
    } catch (cause) {
      setError(errorMessage(cause))
      setOpening('')
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/25 px-5 py-12">
      <div className="w-full max-w-2xl space-y-8">
        <Brand />
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-xl">
              <h1>{tab === 'register' ? 'Новый профиль компании' : 'Выберите компанию'}</h1>
            </CardTitle>
            <CardDescription>Откройте персональную ленту без логина, пароля и SSO.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={tab}
              onValueChange={(value) => {
                setTab(value)
                setError('')
              }}
            >
              <TabsList className="mb-6 grid w-full grid-cols-2" aria-label="Доступ к сервису">
                <TabsTrigger value="login" className="text-foreground">
                  Готовый профиль
                </TabsTrigger>
                <TabsTrigger value="register" className="text-foreground">
                  Новая компания
                </TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <Command shouldFilter={false} className="rounded-lg border" loop>
                  <CommandInput
                    value={search}
                    onValueChange={setSearch}
                    placeholder="Компания, ID или имя профиля"
                    aria-label="Поиск аккаунта"
                  />
                  <CommandList className="max-h-80">
                    {accounts.isPending ? (
                      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Загружаем профили…
                      </div>
                    ) : accounts.data?.length ? (
                      accounts.data.map((account) => (
                        <CommandItem
                          key={account.id}
                          value={account.id}
                          disabled={!!opening}
                          onSelect={() => void open(account)}
                          className="items-start gap-3 px-3 py-3"
                        >
                          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                            {account.source === 'custom' ? (
                              <UserRound className="size-4" />
                            ) : (
                              <Building2 className="size-4" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">
                              {account.companyName}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {account.username} · {account.companyId}
                            </span>
                          </span>
                          {account.source === 'custom' && (
                            <Badge variant="secondary">Создан в сервисе</Badge>
                          )}
                          {opening === account.id && (
                            <LoaderCircle className="mt-2 size-4 animate-spin" />
                          )}
                        </CommandItem>
                      ))
                    ) : (
                      <CommandEmpty>
                        Профиль не найден. Создайте новую компанию на соседней вкладке.
                      </CommandEmpty>
                    )}
                  </CommandList>
                </Command>
                {accounts.error && (
                  <p role="alert" className="mt-4 text-sm text-destructive">
                    {errorMessage(accounts.error)}
                  </p>
                )}
                {error && (
                  <p role="alert" className="mt-4 text-sm text-destructive">
                    {error}
                  </p>
                )}
                <p className="mt-4 text-xs leading-5 text-muted-foreground">
                  В списке — отдельные профили CLIENT из набора и компании, созданные в сервисе.
                  Каждый профиль видит только свои данные.
                </p>
              </TabsContent>
              <TabsContent value="register">
                <RegistrationForm />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
