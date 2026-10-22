import { useState } from 'react'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { toast } from 'sonner'
import { useInsight, useFeedback, type Insight, type UserState } from '@/entities/insight'
import { errorMessage } from '@/shared/lib'
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

export function FeedbackPanel({ item }: { item: Insight }) {
  const detail = useInsight(item.id, item.perspective)
  const feedback = detail.data?.userState.feedback
  const update = useFeedback(item)
  const [open, setOpen] = useState(false)
  const [remark, setRemark] = useState('')
  function submit(next: UserState['feedback'], close = false) {
    update.mutate(next, {
      onSuccess: () => {
        if (close) setOpen(false)
        toast.success('Обратная связь сохранена')
      },
      onError: (error) => toast.error(errorMessage(error)),
    })
  }
  return (
    <section
      className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-5"
      aria-label="Обратная связь"
    >
      <div className="flex items-center gap-3">
        <span className="text-sm">Полезный разбор?</span>
        <ToggleGroup
          type="single"
          value={feedback?.rating ?? ''}
          disabled={!feedback || update.isPending}
          onValueChange={(value) =>
            submit({
              rating: (value || null) as UserState['feedback']['rating'],
              comment: feedback?.comment ?? '',
            })
          }
          aria-label="Оценить полезность"
        >
          <ToggleGroupItem value="useful" aria-label="Полезно">
            <ThumbsUp className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="not_useful" aria-label="Не полезно">
            <ThumbsDown className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (value) setRemark(feedback?.comment ?? '')
          setOpen(value)
        }}
      >
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            disabled={!feedback}
          >
            {feedback?.comment ? 'Изменить замечание' : 'Сообщить об ошибке'}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit({ rating: feedback?.rating ?? null, comment: remark.trim() }, true)
            }}
          >
            <DialogHeader>
              <DialogTitle>Что нужно исправить?</DialogTitle>
              <DialogDescription>
                Замечание сохранится вместе с версией разбора в вашем аккаунте.
              </DialogDescription>
            </DialogHeader>
            <Label htmlFor="remark" className="mb-2 mt-5 block">
              Ваше замечание
            </Label>
            <Textarea
              id="remark"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              maxLength={2000}
              className="min-h-32"
            />
            <DialogFooter className="mt-5">
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? 'Сохраняем…' : 'Сохранить замечание'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
