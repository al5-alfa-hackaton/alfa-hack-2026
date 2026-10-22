import { Bookmark } from 'lucide-react'
import { toast } from 'sonner'
import { useInsight, useSaveInsight, type Insight } from '@/entities/insight'
import { errorMessage } from '@/shared/lib'
import { Button } from '@/components/ui/button'

export function SaveButton({ item, compact = false }: { item: Insight; compact?: boolean }) {
  const detail = useInsight(item.id, item.perspective)
  const save = useSaveInsight(item, detail.data?.userState)
  const saved = !!detail.data?.userState.savedAt
  return (
    <Button
      variant={compact ? 'ghost' : 'outline'}
      size={compact ? 'icon-sm' : 'default'}
      aria-label={(saved ? 'Убрать из сохранённого: ' : 'Сохранить: ') + item.event.title}
      aria-pressed={saved}
      disabled={!detail.data || save.isPending}
      onClick={() =>
        save.mutate(undefined, {
          onError: (error) => toast.error(errorMessage(error)),
          onSuccess: () => toast(saved ? 'Событие убрано из сохранённого' : 'Событие сохранено'),
        })
      }
    >
      <Bookmark className={'size-4 ' + (saved ? 'fill-current' : '')} />
      {!compact && (saved ? 'Сохранено' : 'Сохранить')}
    </Button>
  )
}
