import { Identicon } from '@/components/shell/WalletChip'
import { cn } from '@/lib/utils'
import { shortAddress } from '@/lib/format'

/** A person: X handle when known, otherwise the address. Avatar is deterministic, no external service. */
export function Identity({
  address,
  handle,
  avatarUrl,
  size = 'md',
  className,
}: {
  address?: string
  handle?: string | null
  avatarUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const px = size === 'sm' ? 20 : size === 'lg' ? 40 : 28
  const primary = handle ? `@${handle}` : address ? shortAddress(address) : '—'
  const secondary = handle && address ? shortAddress(address) : undefined
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" width={px} height={px} className="shrink-0 rounded-full ring-1 ring-border" />
      ) : address ? (
        <Identicon address={address} size={px} />
      ) : (
        <span className="shrink-0 rounded-full bg-secondary" style={{ width: px, height: px }} aria-hidden />
      )}
      <span className="min-w-0">
        <span className={cn('block truncate font-medium text-foreground', size === 'lg' ? 'text-[15px]' : 'text-[13.5px]', !handle && 'font-mono')}>{primary}</span>
        {secondary && <span className="block truncate font-mono text-[11.5px] text-ink-3">{secondary}</span>}
      </span>
    </span>
  )
}
