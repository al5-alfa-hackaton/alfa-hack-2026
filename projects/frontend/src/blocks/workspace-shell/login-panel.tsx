import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useWorkspace } from '@/entities/workspace'
import { errorMessage } from '@/shared/lib'
import { Brand } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RegistrationForm } from './registration-form'

export function LoginPanel() {
  const { login } = useWorkspace()
  const [tab, setTab] = useState('login')
  const [error, setError] = useState('')
  const form = useForm<{ username: string; password: string }>({
    defaultValues: { username: '', password: '' },
  })
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/25 px-5 py-12">
      <div className={'w-full space-y-8 ' + (tab === 'register' ? 'max-w-2xl' : 'max-w-md')}>
        <Brand />
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-xl">
              <h1>{tab === 'register' ? 'Новый аккаунт и компания' : 'Вход в аналитику'}</h1>
            </CardTitle>
            <CardDescription>События рынка в контексте вашей компании.</CardDescription>
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
                  Войти
                </TabsTrigger>
                <TabsTrigger value="register" className="text-foreground">
                  Создать аккаунт
                </TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form
                  className="space-y-5"
                  onSubmit={form.handleSubmit(async (values) => {
                    setError('')
                    try {
                      await login(values.username, values.password)
                    } catch (cause) {
                      setError(errorMessage(cause))
                    }
                  })}
                >
                  <div className="space-y-2">
                    <Label htmlFor="username">Логин</Label>
                    <Input
                      id="username"
                      autoComplete="username"
                      autoCapitalize="none"
                      required
                      maxLength={64}
                      {...form.register('username', { required: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Пароль</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      maxLength={128}
                      {...form.register('password', { required: true })}
                    />
                  </div>
                  {error && (
                    <p role="alert" className="text-sm text-destructive">
                      {error}
                    </p>
                  )}
                  <Button className="w-full" disabled={form.formState.isSubmitting} type="submit">
                    {form.formState.isSubmitting ? 'Входим…' : 'Войти'}
                  </Button>
                </form>
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
