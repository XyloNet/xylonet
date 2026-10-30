'use client'

import { useEffect, useMemo, useState } from 'react'
import { useEnsAddress } from 'wagmi'
import { isAddress, type Address } from 'viem'
import { AtSign, Check, TriangleAlert } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusPill } from '@/components/xylo/StatusPill'
import { HANDLE_RE, normalizeHandle, stripHandle } from '@/lib/payx/handle'
import { cn } from '@/lib/utils'

export type Recipient =
  | { kind: 'handle'; handle: string; raw: string }
  | { kind: 'address'; address: Address; raw: string; ens?: string }
  | { kind: 'ens'; raw: string; resolving: true }
  | { kind: 'invalid'; raw: string; reason: string }
  | { kind: 'empty'; raw: string }

/** Classifies what the person typed: an X handle, an address, or an ENS name. */
export function parseRecipient(raw: string): Recipient {
  const v = raw.trim()
  if (!v) return { kind: 'empty', raw }
  if (v.startsWith('@') || (!v.includes('.') && !v.startsWith('0x'))) {
    const h = stripHandle(v)
    if (HANDLE_RE.test(h)) return { kind: 'handle', handle: normalizeHandle(h) ?? h.toLowerCase(), raw }
    return { kind: 'invalid', raw, reason: 'X handles are 1 to 15 letters, numbers or underscores.' }
  }
  if (v.startsWith('0x')) {
    if (isAddress(v)) return { kind: 'address', address: v as Address, raw }
    return { kind: 'invalid', raw, reason: 'That is not a valid address.' }
  }
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/i.test(v)) return { kind: 'ens', raw, resolving: true }
  return { kind: 'invalid', raw, reason: 'Enter an X handle, a 0x address or an ENS name.' }
}

export function RecipientInput({
  value,
  onChange,
  onResolved,
  locked,
  info,
  className,
}: {
  value: string
  onChange: (v: string) => void
  onResolved: (r: Recipient) => void
  /** Creator page: the handle is fixed. */
  locked?: boolean
  /** Live contract info for a handle (from usePayX). */
  info?: { pendingBalance: bigint; isRegistered: boolean; tipCount: bigint } | null
  className?: string
}) {
  const parsed = useMemo(() => parseRecipient(value), [value])
  const ensName = parsed.kind === 'ens' ? parsed.raw.trim().toLowerCase() : undefined
  const ens = useEnsAddress({ name: ensName, chainId: 1, query: { enabled: !!ensName } })
  const [touched, setTouched] = useState(false)

  const resolved: Recipient = useMemo(() => {
    if (parsed.kind !== 'ens') return parsed
    if (ens.isLoading) return parsed
    if (ens.data) return { kind: 'address', address: ens.data, raw: parsed.raw, ens: ensName }
    return { kind: 'invalid', raw: parsed.raw, reason: 'That ENS name does not resolve to an address.' }
  }, [parsed, ens.isLoading, ens.data, ensName])

  const resolvedKey = `${resolved.kind}:${(resolved as { handle?: string }).handle ?? ''}:${(resolved as { address?: string }).address ?? ''}`
  useEffect(() => {
    onResolved(resolved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedKey])

  const showError = touched && resolved.kind === 'invalid'

  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor="pay-to" className="text-[13px] text-ink-3">
        To
      </Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3">
          <AtSign className="size-4" />
        </span>
        <Input
          id="pay-to"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          readOnly={locked}
          placeholder="X handle, 0x address or name.eth"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={showError || undefined}
          aria-describedby="pay-to-status"
          className={cn('h-12 pl-9 text-[16px]', locked && 'bg-secondary text-foreground')}
        />
      </div>
      <div id="pay-to-status" className="min-h-6 text-[12.5px]" aria-live="polite">
        {showError && <span className="text-bad">{resolved.reason}</span>}
        {resolved.kind === 'ens' && <span className="text-ink-3">Resolving name…</span>}
        {resolved.kind === 'address' && (
          <span className="inline-flex flex-wrap items-center gap-1.5 text-ink-2">
            <Check className="size-3.5 text-signal-deep" />
            {resolved.ens ? `${resolved.ens} resolves to ${resolved.address.slice(0, 6)}…${resolved.address.slice(-4)}.` : 'Address on Arc.'} Sent directly, no escrow, no fee.
          </span>
        )}
        {resolved.kind === 'handle' && info && (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            {info.isRegistered ? (
              <StatusPill tone="ok" dot={false}>has claimed before</StatusPill>
            ) : info.tipCount > 0n ? (
              <StatusPill tone="info" dot={false}>{info.tipCount.toString()} tip{info.tipCount === 1n ? '' : 's'} waiting</StatusPill>
            ) : (
              <span className="inline-flex items-center gap-1 text-ink-2">
                <TriangleAlert className="size-3.5 text-warn" />
                New to PayX. We cannot check X for this handle, so check the spelling: tips stay in escrow until this exact handle claims.
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  )
}
