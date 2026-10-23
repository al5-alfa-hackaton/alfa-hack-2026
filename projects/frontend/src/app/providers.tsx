import { useState, type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from '@/shared/lib'
import { ThemeProvider } from 'next-themes'
import { WorkspaceProvider } from '@/entities/workspace'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient)
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <WorkspaceProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </WorkspaceProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
