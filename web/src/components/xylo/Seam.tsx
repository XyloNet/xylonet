import { cn } from '@/lib/utils'

/** The one decorative device: a hairline with the mark's 22-degree cut. */
export function Seam({ className }: { className?: string }) {
  return <div className={cn('seam my-10', className)} aria-hidden />
}
