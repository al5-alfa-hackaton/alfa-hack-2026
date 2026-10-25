import type { ReactNode } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { Bookmark, Building2, LogOut, History, ListFilter, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useWorkspace } from '@/entities/workspace'
import { useEffect, useRef, useState } from 'react'
import { errorMessage } from '@/shared/lib'
import { toast } from 'sonner'
import { EmptyState } from '@/components/empty-state'
import { RequestError, RequestSkeleton } from '@/components/request-state'
import { LoginPanel } from './login-panel'
import { Skeleton } from '@/components/ui/skeleton'
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
          <SidebarMenuButton
            asChild
            isActive={pathname === to}
            className="h-auto min-h-10 items-start py-2.5 text-sm [&>svg]:mt-0.5"
          >
            <Link
              to={to}
              search={{}}
              onClick={() => setOpenMobile(false)}
              aria-current={pathname === to ? 'page' : undefined}
            >
              <Icon />
              <span className="whitespace-normal! break-words leading-5">{label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = useLocation({ select: (location) => location.pathname })
  const workspace = useWorkspace()
  const { company, ready, unauthorized, error, loading } = workspace
  const [leaving, setLeaving] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  const themeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(
    () => () => {
      clearTimeout(themeTimer.current)
      document.documentElement.classList.remove('theme-changing')
    },
    [],
  )
  function toggleTheme() {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      clearTimeout(themeTimer.current)
      document.documentElement.classList.add('theme-changing')
      // Commit the transition styles before next-themes changes the palette.
      void getComputedStyle(document.documentElement).backgroundColor
      themeTimer.current = setTimeout(
        () => document.documentElement.classList.remove('theme-changing'),
        450,
      )
    }
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }
  if (unauthorized) return <LoginPanel />
  return (
    <SidebarProvider style={{ '--sidebar-width': '280px' } as React.CSSProperties}>
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
          {ready ? (
            <ContextSwitcher />
          ) : (
            <div aria-hidden="true" className="space-y-2 px-2 py-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-28" />
            </div>
          )}
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Новостная аналитика</SidebarGroupLabel>
            <SidebarGroupContent>
              {ready ? (
                <Navigation />
              ) : (
                <div aria-hidden="true" className="space-y-2">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              )}
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
            disabled={leaving || !ready}
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
              onClick={toggleTheme}
            >
              <Sun className="hidden size-4 dark:block" />
              <Moon className="size-4 dark:hidden" />
            </Button>
          </div>
        </header>
        <div id="main" className="flex min-w-0 flex-1 flex-col px-4 py-6 sm:px-7 lg:px-9 lg:py-8">
          {!ready ? (
            loading ? (
              <RequestSkeleton />
            ) : (
              <RequestError message={errorMessage(error)} onRetry={workspace.retry} />
            )
          ) : company ? (
            <div key={pathname} className="screen-enter flex flex-1 flex-col">
              {children}
            </div>
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
