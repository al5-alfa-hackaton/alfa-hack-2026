import type { ReactNode } from 'react'
import { ThemeProvider } from 'next-themes'
import { WorkspaceProvider } from '@/entities/workspace'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <WorkspaceProvider>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </WorkspaceProvider>
    </ThemeProvider>
  )
}
