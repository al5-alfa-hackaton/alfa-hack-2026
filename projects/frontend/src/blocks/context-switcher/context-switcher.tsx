import { useNavigate } from '@tanstack/react-router'
import { ChevronsUpDown } from 'lucide-react'
import { roles, type Role } from '@/entities/company'
import { useWorkspace } from '@/entities/workspace'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function ContextSwitcher() {
  const { session, setScope, companies, company } = useWorkspace()
  const navigate = useNavigate()
  function change(value: { company?: string; role?: Role }) {
    setScope(value)
    void navigate({ to: '/', search: {} })
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto w-full justify-start gap-3 px-2 py-3 text-left"
          aria-label="Выбрать компанию и роль"
          disabled={!companies.length}
        >
          <span className="min-w-0 flex-1">
            <span className="block whitespace-normal break-words text-sm font-semibold leading-5">
              {company?.displayName ?? 'Нет компаний'}
            </span>
            <span className="mt-1 block whitespace-normal break-words text-xs font-normal leading-5 text-muted-foreground">
              {roles[session.role]}
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" className="w-80 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel>Компания</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={session.company}
          onValueChange={(company) => change({ company })}
        >
          {companies.map((c) => (
            <DropdownMenuRadioItem key={c.id} value={c.id}>
              <span className="min-w-0 whitespace-normal break-words">
                {c.displayName}
                <span className="block text-xs font-normal text-muted-foreground">
                  {c.industry}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Ваша роль</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={session.role}
          onValueChange={(role) => change({ role: role as Role })}
        >
          {Object.entries(roles).map(([id, label]) => (
            <DropdownMenuRadioItem key={id} value={id} className="whitespace-normal">
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
