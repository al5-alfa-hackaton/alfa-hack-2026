import { useNavigate } from '@tanstack/react-router'
import { ChevronsUpDown } from 'lucide-react'
import { companies, roles, type CompanyId, type Role } from '@/entities/company'
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
  const { session, setSession } = useWorkspace()
  const navigate = useNavigate()
  function change(value: { company?: CompanyId; role?: Role }) {
    setSession((s) => ({ ...s, ...value, entered: true }))
    void navigate({ to: '/', search: {} })
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto w-full justify-start gap-3 px-2 py-3 text-left"
          aria-label="Выбрать компанию и роль"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              {companies[session.company].name}
            </span>
            <span className="mt-1 block truncate text-xs font-normal text-muted-foreground">
              {roles[session.role]}
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" className="w-72">
        <DropdownMenuLabel>Учебная компания</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={session.company}
          onValueChange={(v) => change({ company: v as CompanyId })}
        >
          {Object.entries(companies).map(([id, c]) => (
            <DropdownMenuRadioItem key={id} value={id}>
              <span>
                {c.name}
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
          onValueChange={(v) => change({ role: v as Role })}
        >
          {Object.entries(roles).map(([id, label]) => (
            <DropdownMenuRadioItem key={id} value={id}>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
