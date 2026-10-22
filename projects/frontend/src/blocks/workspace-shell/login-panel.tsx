import { useState } from 'react'
import { useWorkspace } from '@/entities/workspace'
import { errorMessage } from '@/shared/lib'
import { Brand } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export function LoginPanel() {
  const { login } = useWorkspace()
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/25 px-5 py-12">
      <div className="w-full max-w-md space-y-9">
        <Brand />
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-xl">
              <h1>Вход в аналитику</h1>
            </CardTitle>
            <CardDescription>События рынка в контексте вашей компании.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-5"
              onSubmit={async (event) => {
                event.preventDefault()
                setBusy(true)
                setError('')
                try {
                  await login(token)
                  setToken('')
                } catch (cause) {
                  setError(errorMessage(cause))
                } finally {
                  setBusy(false)
                }
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="access-key">Ключ доступа</Label>
                <Input
                  id="access-key"
                  type="password"
                  autoComplete="current-password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                  minLength={32}
                  maxLength={4096}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Ключ выдаёт администратор вашей организации.
                </p>
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button className="w-full" disabled={busy || token.length < 32} type="submit">
                {busy ? 'Входим…' : 'Войти'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
