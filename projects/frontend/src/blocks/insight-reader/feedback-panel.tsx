import { useState } from 'react'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { toast } from 'sonner'
import { scopeKey, useWorkspace } from '@/entities/workspace'
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
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export function FeedbackPanel({ insightId }: { insightId: string }) {
  const { session, setSession } = useWorkspace()
  const key = scopeKey(session.company, session.role, insightId)
  const [open, setOpen] = useState(false)
  const [remark, setRemark] = useState(session.remarks[key] ?? '')
  return (
    <section
      className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-5"
      aria-label="Обратная связь"
    >
      <div className="flex items-center gap-3">
        <span className="text-sm">Полезный разбор?</span>
        <ToggleGroup
          type="single"
          value={session.feedback[key] ?? ''}
          onValueChange={(v) => {
            setSession((s) => ({ ...s, feedback: { ...s.feedback, [key]: v } }))
            if (v) toast('Оценка сохранена в этом браузере')
          }}
          aria-label="Оценить полезность"
        >
          <ToggleGroupItem value="useful" aria-label="Полезно">
            <ThumbsUp className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="not-useful" aria-label="Не полезно">
            <ThumbsDown className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
            {session.remarks[key] ? 'Изменить замечание' : 'Сообщить об ошибке'}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!remark.trim()) return
              setSession((s) => ({ ...s, remarks: { ...s.remarks, [key]: remark.trim() } }))
              setOpen(false)
              toast.success('Замечание сохранено в этом браузере')
            }}
          >
            <DialogHeader>
              <DialogTitle>Что нужно исправить?</DialogTitle>
              <DialogDescription>
                Замечание сохранится локально вместе с этим событием. Отправки в банк нет.
              </DialogDescription>
            </DialogHeader>
            <Label htmlFor="remark" className="mb-2 mt-5 block">
              Ваше замечание
            </Label>
            <Textarea
              id="remark"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              maxLength={1000}
              required
              className="min-h-32"
            />
            <DialogFooter className="mt-5">
              <Button type="submit" disabled={!remark.trim()}>
                Сохранить замечание
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
