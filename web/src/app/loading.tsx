import { Skeleton } from '@/components/ui/skeleton'

/** Route-level loading: a quiet layout skeleton, never a full-screen spinner. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-5" aria-busy="true" aria-live="polite">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-10 w-72 max-w-full" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  )
}
