import type { ReactNode } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { Bookmark, Building2, LogOut, History, ListFilter, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useWorkspace } from '@/entities/workspace'
import { useState } from 'react'
import { errorMessage } from '@/shared/lib'
import { toast } from 'sonner'
import { EmptyState } from '@/components/empty-state'
import { RequestError, RequestSkeleton } from '@/components/request-state'
import { LoginPanel } from './login-panel'
import { Brand } from '@/components/brand'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { ContextSwitcher } from '@/blocks/context-switcher'

const destinations = [
  { to: '/', label: 'События для вас', icon: ListFilter },
  { to: '/saved', label: 'Сохранённое', icon: Bookmark },
  { to: '/company', label: 'Контекст компании', icon: Building2 },
  { to: '/history', label: 'История анализа', icon: History },
] as const

function Navigation() {
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()
  return (
    <SidebarMenu>
      {destinations.map(({ to, label, icon: Icon }) => (
        <SidebarMenuItem key={to}>
          <SidebarMenuButton asChild isActive={pathname === to} className="h-10 text-sm">
            <Link
              to={to}
              search={{}}
              onClick={() => setOpenMobile(false)}
              aria-current={pathname === to ? 'page' : undefined}
            >
              <Icon />
              <span>{label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const workspace = useWorkspace()
  const { company, ready, unauthorized, error, loading } = workspace
  const [leaving, setLeaving] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  if (unauthorized) return <LoginPanel />
  if (!ready)
    return (
      <main className="mx-auto max-w-xl px-5 py-20">
        <Brand />
        {loading ? (
          <RequestSkeleton />
        ) : (
          <RequestError message={errorMessage(error)} onRetry={workspace.retry} />
        )}
      </main>
    )
  return (
    <SidebarProvider style={{ '--sidebar-width': '224px' } as React.CSSProperties}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:p-3"
      >
        К содержимому
      </a>
      <Sidebar variant="inset" className="border-none">
        <SidebarHeader className="gap-5 px-4 pt-6">
          <Link to="/" search={{}} aria-label="Альфа Бизнес — главная">
            <Brand />
          </Link>
          <ContextSwitcher />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Новостная аналитика</SidebarGroupLabel>
            <SidebarGroupContent>
              <Navigation />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="gap-4 px-5 pb-5">
          <p className="border-t pt-4 text-xs leading-5 text-muted-foreground">
            Данные и выводы доступны только в рамках вашей организации.
          </p>
          <Button
            variant="ghost"
            className="h-8 justify-start px-0 text-xs text-muted-foreground"
            disabled={leaving}
            onClick={async () => {
              setLeaving(true)
              try {
                await workspace.logout()
              } catch (cause) {
                toast.error(errorMessage(cause))
              } finally {
                setLeaving(false)
              }
            }}
          >
            <LogOut className="size-3.5" />
            Выйти
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0 overflow-hidden border border-border shadow-none md:rounded-2xl">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4 md:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger aria-label="Открыть навигацию" />
            <span className="hidden truncate text-sm text-muted-foreground md:inline">
              Новостная аналитика
            </span>
            <span className="truncate text-sm font-medium md:hidden">
              {company?.displayName ?? 'Новостная аналитика'}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Переключить тему"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            >
              <Sun className="hidden size-4 dark:block" />
              <Moon className="size-4 dark:hidden" />
            </Button>
          </div>
        </header>
        <div id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-7 lg:px-9 lg:py-8">
          {company ? (
            children
          ) : (
            <EmptyState
              title="Нет доступных компаний"
              description="Администратор может предоставить доступ к профилю компании."
            />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
