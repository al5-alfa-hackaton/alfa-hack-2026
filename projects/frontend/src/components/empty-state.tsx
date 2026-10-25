import type { ReactNode } from 'react'
import { cn } from 'cn'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string
  description: string
  action?: ReactNode
  className?: string
}) {
  return (
    <Empty className={cn('min-h-60 border bg-card', className)}>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  )
}
