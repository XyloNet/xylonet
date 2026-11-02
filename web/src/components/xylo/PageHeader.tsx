import { cn } from '@/lib/utils'

/** Page title in the display face, one line of description, optional actions. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  align = 'left',
  className,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  /** 'center-lg' centres only from lg up (the gated pages' "door"). */
  align?: 'left' | 'center' | 'center-lg'
  className?: string
}) {
  return (
    <header
      className={cn(
        'flex flex-col gap-3 md:flex-row md:items-end md:justify-between',
        align === 'center' && 'items-center text-center md:flex-col md:items-center',
        align === 'center-lg' && 'lg:flex-col lg:items-center lg:text-center',
        className,
      )}
    >
      <div className={cn('min-w-0', align === 'center' && 'flex flex-col items-center', align === 'center-lg' && 'lg:flex lg:flex-col lg:items-center')}>
        {eyebrow && <div className="type-eyebrow mb-2">{eyebrow}</div>}
        <h1 className="type-display text-[clamp(30px,4.5vw,42px)] text-foreground lg:text-[48px] lg:leading-[1.02]">{title}</h1>
        {description && <p className="mt-2 max-w-[60ch] text-[15px] text-ink-2 lg:mt-3 lg:text-[17px] lg:leading-[1.5]">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
