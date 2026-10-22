import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

export function RequestError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert variant="destructive" className="my-5">
      <AlertTitle>Не удалось загрузить данные</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        {onRetry && (
          <Button variant="outline" className="mt-3 w-fit" onClick={onRetry}>
            Повторить
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}
export function RequestSkeleton() {
  return (
    <div role="status" aria-label="Загрузка данных" className="space-y-5 py-5">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-36 w-full" />
    </div>
  )
}
