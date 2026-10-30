import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Names what will appear here and how to make it appear. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center rounded-xl border border-dashed border-line-2 px-6 py-10 text-center', className)}>
      {Icon && (
        <span className="mb-3 grid size-10 place-items-center rounded-lg bg-secondary text-ink-2">
          <Icon className="size-5" />
        </span>
      )}
      <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-[42ch] text-[13.5px] text-ink-3">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
