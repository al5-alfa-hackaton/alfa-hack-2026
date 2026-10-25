// Adapted from prompt-kit (MIT). See THIRD_PARTY_NOTICES.md.
'use client'

import { cn } from 'cn'
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom'

export type ChatContainerRootProps = {
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>

export type ChatContainerContentProps = {
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>

export type ChatContainerScrollAnchorProps = {
  className?: string
  ref?: React.RefObject<HTMLDivElement>
} & React.HTMLAttributes<HTMLDivElement>

function ChatContainerRoot({ children, className, ...props }: ChatContainerRootProps) {
  return (
    <StickToBottom
      className={cn(
        'relative flex min-h-0 flex-1 overflow-hidden [&>div]:overscroll-contain',
        className,
      )}
      resize="instant"
      initial="instant"
      role="log"
      {...props}
    >
      {children}
    </StickToBottom>
  )
}

function ChatContainerContent({ children, className, ...props }: ChatContainerContentProps) {
  const { scrollRef, contentRef } = useStickToBottomContext()
  return (
    <div
      ref={scrollRef}
      tabIndex={0}
      aria-label="История сообщений"
      role="region"
      className="h-full w-full overflow-y-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      style={{ scrollbarGutter: 'stable both-edges' }}
    >
      <div ref={contentRef} className={cn('flex w-full flex-col', className)} {...props}>
        {children}
      </div>
    </div>
  )
}

function ChatContainerScrollAnchor({ className, ...props }: ChatContainerScrollAnchorProps) {
  return (
    <div
      className={cn('h-px w-full shrink-0 scroll-mt-4', className)}
      aria-hidden="true"
      {...props}
    />
  )
}

export { ChatContainerRoot, ChatContainerContent, ChatContainerScrollAnchor }
