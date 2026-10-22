import { createFileRoute } from '@tanstack/react-router'
import { FeedPage } from '@/pages/feed'

export const Route = createFileRoute('/')({ component: () => <FeedPage /> })
