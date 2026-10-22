import { createFileRoute, notFound } from '@tanstack/react-router'
import { UIKitPage } from '@/pages/ui-kit'

export const Route = createFileRoute('/ui-kit')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: () => <UIKitPage />,
})
