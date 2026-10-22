import { useState } from 'react'
import { Settings2 } from 'lucide-react'
import type { Scenario } from '@/entities/analysis'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

const scenarios: [Scenario, string, string][] = [
  ['normal', 'Полный результат', 'Все учебные источники доступны'],
  ['partial', 'Частичный результат', 'Один из источников не отвечает'],
  ['empty', 'Нет новых событий', 'По заданным условиям ничего не найдено'],
  ['error', 'Ошибка сервиса', 'Проверка восстановления после сбоя'],
  ['budget', 'Лимит анализа', 'Дневной бюджет исчерпан'],
  ['denied', 'Нет доступа', 'Источник недоступен для текущего контекста'],
]

export function DemoScenarios({
  value,
  onChange,
  onRun,
  disabled,
}: {
  value: Scenario
  onChange: (value: Scenario) => void
  onRun: (value: Scenario) => void
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Сценарии демо">
          <Settings2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Проверить сценарий</DialogTitle>
          <DialogDescription>
            Состояния моделируются в браузере. Внешние сервисы и платные модели не вызываются.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup
          value={value}
          onValueChange={(v) => onChange(v as Scenario)}
          className="my-2 gap-1"
        >
          {scenarios.map(([id, title, description]) => (
            <Label
              key={id}
              htmlFor={`scenario-${id}`}
              className="flex cursor-pointer items-center gap-3 rounded-md p-3 hover:bg-muted"
            >
              <RadioGroupItem id={`scenario-${id}`} value={id} />
              <span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">
                  {description}
                </span>
              </span>
            </Label>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button
            disabled={disabled}
            onClick={() => {
              setOpen(false)
              onRun(value)
            }}
          >
            Запустить сценарий
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
