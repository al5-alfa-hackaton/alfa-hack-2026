import { createFileRoute } from '@tanstack/react-router'
import { CompanyPage } from '@/pages/company'

export const Route = createFileRoute('/company')({ component: () => <CompanyPage /> })
