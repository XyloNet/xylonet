'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useConfig, usePublicClient, useReadContract } from 'wagmi'
import { getWalletClient } from 'wagmi/actions'
import { formatUnits, type Account, type Chain, type PublicClient, type Transport, type WalletClient } from 'viem'
import QRCode from 'qrcode'
import { LogOut, Share2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/xylo/PageHeader'
import { Amount } from '@/components/xylo/Amount'
import { Address } from '@/components/xylo/Address'
import { Identity } from '@/components/xylo/Identity'
import { StatusPill } from '@/components/xylo/StatusPill'
import { Stepper, type Step } from '@/components/xylo/Stepper'
import { SettledStamp } from '@/components/xylo/Stamp'
import { TrustPanel } from '@/components/xylo/TrustPanel'
import { EmptyState } from '@/components/xylo/EmptyState'
import { CopyField } from '@/components/xylo/CopyField'
import { ConnectButton } from '@/components/wallet/ConnectButton'
import { NotifyToggle } from '@/components/pay/NotifyToggle'
import { Identicon } from '@/components/shell/WalletChip'
import { useWallet } from '@/hooks/useWallet'
import { useAuth } from '@/lib/payx/useAuth'
import { PayXTippingABI } from '@/config/abis/PayXTipping'
import { livePayXAssets, type PayXAsset } from '@/config/constants'
import { ARC_CHAIN_ID, arcMainnet } from '@/config/wagmi'
import { friendlyPayXError } from '@/lib/payx/errors'
import { normalizeHandle } from '@/lib/payx/handle'
import { formatAmount, formatDateTime, shortAddress, timeAgo } from '@/lib/format'

const ZERO = '0x0000000000000000000000000000000000000000'
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.xylonet.xyz').replace(/\/$/, '')

const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
)

const AUTH_ERRORS: Record<string, string> = {
  auth_failed: 'X sign-in was cancelled or denied. Try again when you are ready.',
  missing_params: 'X did not return a sign-in code. Try again.',
  callback_failed: 'We could not complete the sign-in with X. Try again.',
  network_error: 'A network error interrupted the sign-in. Try again.',
}

type ClaimStage = 'idle' | 'switching' | 'authorizing' | 'signing' | 'confirming' | 'done'

export function CreatorClient({ tab, authError, authReason }: { tab: 'claim' | 'history' | 'share'; authError: string | null; authReason: string | null }) {
  const router = useRouter()
  const auth = useAuth()
  const [signInError, setSignInError] = useState<string | null>(null)

  useEffect(() => {
    if (authError) {
      toast.error(AUTH_ERRORS[authError] ?? 'Sign-in failed.', { description: authReason ?? undefined })
      router.replace('/pay/creator')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authError])

  const handle = auth.user ? (normalizeHandle(auth.user.handle) ?? auth.user.handle.toLowerCase()) : null

  if (auth.status === 'loading') {
    return (
      <div className="mx-auto max-w-[1120px] px-4 pt-10 sm:px-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-3 h-10 w-72" />
        <Skeleton className="mt-8 h-64 max-w-[560px] rounded-2xl" />
      </div>
    )
  }

  if (auth.status === 'signed-out' || !handle) {
    return (
      <div className="mx-auto max-w-[1120px] px-4 pb-16 pt-8 sm:px-5 md:pt-10 lg:max-w-[640px] lg:pt-28 lg:pb-32">
        <PageHeader align="center-lg" eyebrow="Your tips · Arc" title="Someone may have paid you already." description="Sign in with X to see what was sent to your handle, claim it to any wallet, and get your pay link." />
        <div className="mt-8 max-w-[480px] overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-card lg:mx-auto lg:overflow-visible lg:flex lg:max-w-none lg:flex-col lg:items-center lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          <Button
            size="lg"
            className="h-11 w-full text-[15px] font-semibold lg:w-auto lg:px-6"
            disabled={auth.busy}
            onClick={() => auth.signIn().catch((e) => setSignInError((e as Error).message))}
          >
            <XIcon className="size-4" />
            {auth.busy ? 'Opening X…' : 'Sign in with X'}
          </Button>
          {signInError && (
            <p className="mt-3 text-[13.5px] text-bad lg:text-center" role="alert">
              {signInError}
            </p>
          )}
          <p className="mt-3 text-[13px] text-ink-3 lg:mt-5 lg:text-center">We read your public profile only. No posting permission, no wallet needed to sign in.</p>
        </div>
      </div>
    )
  }

  return <Hub handle={handle} user={auth.user!} tab={tab} onTab={(t) => router.replace(`/pay/creator?tab=${t}`)} signOut={auth.signOut} />
}

function Hub({ handle, user, tab, onTab, signOut }: { handle: string; user: { handle: string; name: string; profileImage?: string }; tab: 'claim' | 'history' | 'share'; onTab: (t: string) => void; signOut: () => Promise<void> }) {
  const assets = livePayXAssets()

  return (
    <div className="mx-auto max-w-[1120px] px-4 pb-16 pt-8 sm:px-5 md:pt-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-3">
          {user.profileImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.profileImage} alt="" className="size-12 rounded-full ring-1 ring-border" />
          ) : (
            <span className="grid size-12 place-items-center rounded-full bg-secondary text-ink-2">
              <XIcon className="size-5" />
            </span>
          )}
          <div>
            <div className="type-eyebrow">Signed in with X</div>
            <h1 className="type-display mt-0.5 text-[clamp(28px,4vw,38px)]">@{handle}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="lg" className="h-9" render={<Link href={`/to/${handle}`} />}>
            View my page
          </Button>
          <Button variant="ghost" size="lg" className="h-9" onClick={() => void signOut()}>
            <LogOut data-icon="inline-start" />
            Sign out
          </Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(v) => onTab(String(v))} className="mt-8">
        <TabsList>
          <TabsTrigger value="claim">Claim</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="share">Share</TabsTrigger>
        </TabsList>
        <TabsContent value="claim" className="grid gap-8 pt-4">
          {assets.map((a, i) => (
            <AssetClaim key={a.key} asset={a} handle={handle} primary={i === 0} multi={assets.length > 1} />
          ))}
        </TabsContent>
        <TabsContent value="history" className="grid gap-6 pt-4">
          {assets.map((a, i) => (
            <HistoryPanel key={a.key} asset={a} handle={handle} primary={i === 0} multi={assets.length > 1} />
          ))}
        </TabsContent>
        <TabsContent value="share" className="pt-4">
          <SharePanel handle={handle} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** One tipping asset's balances and claim card. Assets other than the first stay hidden until the handle has received some. */
function AssetClaim({ asset, handle, primary, multi }: { asset: PayXAsset; handle: string; primary: boolean; multi: boolean }) {
  const { data: info, refetch } = useReadContract({
    address: asset.contract,
    abi: PayXTippingABI,
    functionName: 'getHandleInfo',
    args: [handle],
    chainId: ARC_CHAIN_ID,
    query: { refetchInterval: 15_000 },
  })
  const pending = info?.pendingBalance ?? 0n
  const received = info?.totalReceived ?? 0n
  const claimed = info?.totalClaimed ?? 0n
  const linked = (info?.linkedWallet ?? ZERO) as `0x${string}`
  const isRegistered = info?.isRegistered ?? false
  if (!primary && received === 0n) return null

  return (
    <section aria-label={`${asset.token.symbol} payments`}>
      {multi && <div className="type-eyebrow mb-3">{asset.token.symbol}</div>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat asset={asset} label="Waiting to claim" value={pending} strong />
        <Stat asset={asset} label="Received, after fees" value={received} />
        <Stat asset={asset} label="Claimed so far" value={claimed} />
      </div>
      <div className="mt-4">
        <ClaimPanel asset={asset} handle={handle} pending={pending} linked={linked} isRegistered={isRegistered} showNotify={primary} onClaimed={() => void refetch()} />
      </div>
    </section>
  )
}

function Stat({ asset, label, value, strong }: { asset: PayXAsset; label: string; value: bigint; strong?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3.5">
      <div className="text-[12.5px] text-ink-3">{label}</div>
      <div className="mt-1">
        <Amount value={Number(formatUnits(value, asset.token.decimals))} size={strong ? 'xl' : 'lg'} dollar={asset.currencyPrefix === '$'} currency={asset.token.symbol} format={asset.fractionDigits} />
      </div>
    </div>
  )
}

function ClaimPanel({ asset, handle, pending, linked, isRegistered, showNotify, onClaimed }: { asset: PayXAsset; handle: string; pending: bigint; linked: `0x${string}`; isRegistered: boolean; showNotify: boolean; onClaimed: () => void }) {
  const ASSET = asset
  const sym = asset.token.symbol
  const dec = asset.token.decimals
  const isDollar = asset.currencyPrefix === '$'
  const { address, isConnected, onArc, ensureArc } = useWallet()
  const publicClient = usePublicClient({ chainId: ARC_CHAIN_ID }) as PublicClient | undefined
  const config = useConfig()
  const [stage, setStage] = useState<ClaimStage>('idle')
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [settleMs, setSettleMs] = useState<number | null>(null)
  const [claimedAmount, setClaimedAmount] = useState<bigint>(0n)
  const { data: paused } = useReadContract({ address: ASSET.contract, abi: PayXTippingABI, functionName: 'paused', chainId: ARC_CHAIN_ID, query: { refetchInterval: 30_000 } })

  const mismatch = isConnected && !!address && isRegistered && linked.toLowerCase() !== address.toLowerCase()
  const busy = stage !== 'idle' && stage !== 'done'

  const claim = useCallback(async () => {
    if (!address || !publicClient) return
    setError(null)
    setTxHash(null)
    try {
      if (!onArc) {
        setStage('switching')
        const ok = await ensureArc()
        if (!ok) throw new Error('Please switch your wallet to Arc to continue.')
      }
      setStage('authorizing')
      const res = await fetch('/api/payx/claim/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ walletAddress: address, asset: ASSET.key }) })
      const data = (await res.json()) as { handle?: string; walletAddress?: `0x${string}`; nonce?: `0x${string}`; signature?: `0x${string}`; contract?: string; error?: string }
      if (!res.ok || !data.signature || !data.nonce || !data.handle || !data.walletAddress) throw new Error(data.error || 'Could not get a claim authorisation.')
      if (data.contract && data.contract.toLowerCase() !== ASSET.contract.toLowerCase()) throw new Error('The authorisation was issued for a different contract. Retry.')
      const args = [data.handle, data.walletAddress, data.nonce, data.signature] as const
      await publicClient.simulateContract({ address: ASSET.contract, abi: PayXTippingABI, functionName: 'claimTips', args, account: address })
      setStage('signing')
      const walletClient = (await getWalletClient(config, { chainId: ARC_CHAIN_ID })) as unknown as WalletClient<Transport, Chain, Account>
      const hash = await walletClient.writeContract({ address: ASSET.contract, abi: PayXTippingABI, functionName: 'claimTips', args, account: address, chain: arcMainnet })
      const signedAt = Date.now()
      setTxHash(hash)
      setStage('confirming')
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') throw new Error('The claim reverted onchain.')
      setSettleMs(Date.now() - signedAt)
      setClaimedAmount(pending)
      setStage('done')
      onClaimed()
    } catch (err) {
      setError(friendlyPayXError(err, { symbol: sym, minTipHuman: ASSET.minTipHuman }).message)
      setStage('idle')
    }
  }, [address, publicClient, onArc, ensureArc, config, pending, onClaimed, ASSET, sym])

  const start = () => {
    if (!isRegistered) setConfirmOpen(true)
    else void claim()
  }

  if (stage === 'done') {
    return (
      <div className="max-w-[560px] rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-center justify-between">
          <div className="type-eyebrow">Claimed</div>
          <SettledStamp ms={settleMs ?? undefined} />
        </div>
        <div className="mt-2">
          <Amount value={Number(formatUnits(claimedAmount, dec))} size="hero" dollar={isDollar} currency={sym} format={ASSET.fractionDigits} />
        </div>
        <p className="mt-2 text-[14px] text-ink-2">
          Paid to <Address value={address!} /> on Arc.
        </p>
        {txHash && (
          <div className="mt-4">
            <TrustPanel rows={[{ label: 'Transaction', value: <Address value={txHash} kind="tx" /> }]} />
          </div>
        )}
        <div className="mt-5 flex gap-2">
          <Button size="lg" className="h-10" onClick={() => setStage('idle')}>
            Done
          </Button>
        </div>
      </div>
    )
  }

  if (busy) {
    const steps: Step[] = [
      { id: 'auth', label: 'Authorise the claim', state: stage === 'authorizing' ? 'active' : 'done', meta: stage === 'authorizing' ? 'signing on our side' : '' },
      { id: 'claim', label: `Claim to ${address ? shortAddress(address) : 'your wallet'}`, state: stage === 'signing' || stage === 'confirming' ? 'active' : 'pending', meta: stage === 'signing' ? 'in your wallet' : stage === 'confirming' ? 'settling' : '', txHash: txHash ?? undefined },
    ]
    return (
      <div className="max-w-[560px] rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-center justify-between">
          <div className="type-eyebrow">Claiming</div>
          <StatusPill tone="info" pulse>
            {stage === 'switching' ? 'switching to Arc' : stage === 'confirming' ? 'settling' : 'in progress'}
          </StatusPill>
        </div>
        <div className="mt-2">
          <Amount value={Number(formatUnits(pending, dec))} size="xl" dollar={isDollar} currency={sym} format={ASSET.fractionDigits} />
        </div>
        <div className="mt-5">
          <Stepper steps={steps} />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[560px] rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="type-eyebrow">Waiting for you</div>
      <div className="mt-2">
        <Amount value={Number(formatUnits(pending, dec))} size="hero" dollar={isDollar} currency={sym} format={ASSET.fractionDigits} />
      </div>

      {isRegistered && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-[13.5px] text-ink-2">
          Pays out to your linked wallet <Address value={linked} />
        </p>
      )}
      {showNotify && (
        <div className="mt-4">
          <NotifyToggle handle={handle} />
        </div>
      )}

      {paused && (
        <div className="mt-4 rounded-lg border border-warn/30 bg-warn-tint px-4 py-3 text-[14px]" role="status">
          Claims are paused by the guardian. Your balance is safe and will be claimable when they resume.
        </div>
      )}

      {pending === 0n ? (
        <div className="mt-5">
          <EmptyState title="Nothing waiting right now" description="Share your pay link and new payments will show here the moment they settle." action={<Button size="sm" variant="outline" onClick={() => document.querySelector<HTMLButtonElement>('[data-slot=tabs-trigger][value=share]')?.click()}><Share2 data-icon="inline-start" />Share my link</Button>} />
        </div>
      ) : !isConnected ? (
        <div className="mt-5 grid gap-3">
          <p className="text-[14px] text-ink-2">{isRegistered ? `Connect the wallet ending in ${linked.slice(-4)} to claim.` : 'Connect the wallet you want to be paid to. Your first claim links it to @' + handle + ' permanently.'}</p>
          <ConnectButton label="Connect a wallet" />
        </div>
      ) : mismatch ? (
        <div className="mt-5 rounded-lg border border-warn/30 bg-warn-tint px-4 py-3 text-[14px]" role="alert">
          @{handle} is linked to <Address value={linked} copy={false} />. Claims only pay out there. Connect that wallet, or contact @Xylonet_ to relink.
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          <div className="flex items-center gap-2 text-[13.5px] text-ink-2">
            <Identicon address={address!} size={18} /> Paying to <span className="font-mono">{shortAddress(address!)}</span>
            {onArc ? <StatusPill tone="ok" dot={false}>on Arc</StatusPill> : <StatusPill tone="warn" dot={false}>will switch to Arc</StatusPill>}
          </div>
          <Button size="lg" className="h-11 w-full text-[15px] font-semibold" disabled={!!paused} onClick={start}>
            <Wallet data-icon="inline-start" />
            Claim {formatAmount(Number(formatUnits(pending, dec)), ASSET.fractionDigits)} {sym}
          </Button>
          <p className="text-[12.5px] text-ink-3">One transaction. Gas is a fraction of a cent, paid in USDC on Arc.</p>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-bad/30 bg-bad-tint px-4 py-3 text-[14px]" role="alert">
          {error}
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link this wallet to @{handle} permanently?</DialogTitle>
            <DialogDescription>
              Your first claim links <span className="font-mono">{address ? shortAddress(address) : ''}</span> to @{handle}. Every future {sym} claim for this handle pays out to this wallet and only this wallet. Choose a wallet you control and will keep.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Not this wallet
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false)
                void claim()
              }}
            >
              Link and claim
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function HistoryPanel({ asset, handle, primary, multi }: { asset: PayXAsset; handle: string; primary: boolean; multi: boolean }) {
  const ASSET = asset
  const limit = 50n
  const { data: tipCountRaw } = useReadContract({ address: ASSET.contract, abi: PayXTippingABI, functionName: 'getTipCount', args: [handle], chainId: ARC_CHAIN_ID })
  const tipCount = (tipCountRaw as bigint | undefined) ?? 0n
  const { data, isLoading } = useReadContract({
    address: ASSET.contract,
    abi: PayXTippingABI,
    functionName: 'getTipHistory',
    args: [handle, 0n, limit],
    chainId: ARC_CHAIN_ID,
    query: { refetchInterval: 20_000 },
  })
  const tips = useMemo(() => {
    const raw = (data as unknown as { tipper: `0x${string}`; amount: bigint; timestamp: bigint; message: string }[] | [{ tipper: `0x${string}`; amount: bigint; timestamp: bigint; message: string }[], bigint] | undefined)
    const list = Array.isArray(raw) && raw.length && Array.isArray(raw[0]) ? (raw[0] as { tipper: `0x${string}`; amount: bigint; timestamp: bigint; message: string }[]) : ((raw as { tipper: `0x${string}`; amount: bigint; timestamp: bigint; message: string }[] | undefined) ?? [])
    return [...list].sort((a, b) => Number(b.timestamp - a.timestamp))
  }, [data])

  if (isLoading) {
    return (
      <div className="grid max-w-[720px] gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    )
  }
  if (tips.length === 0) {
    if (!primary) return null
    return <EmptyState title="No payments yet" description="Payments to your handle appear here the moment they settle, with the note the sender attached." />
  }
  return (
    <div className="max-w-[720px]">
      {multi && <div className="type-eyebrow mb-3">{ASSET.token.symbol}</div>}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
      <ul className="divide-y divide-border">
        {tips.map((t, i) => (
          <li key={`${t.timestamp}-${i}`} className="flex items-start justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <Identity address={t.tipper} size="sm" />
              {t.message && <p className="mt-1 text-[14px] text-ink-2">“{t.message}”</p>}
              <div className="mt-1 text-[12px] text-ink-3" title={formatDateTime(Number(t.timestamp) * 1000)}>
                {timeAgo(Number(t.timestamp) * 1000)}
              </div>
            </div>
            <Amount value={Number(formatUnits(t.amount, ASSET.token.decimals))} size="md" dollar={ASSET.currencyPrefix === '$'} currency={ASSET.currencyPrefix === '$' ? undefined : ASSET.token.symbol} format={ASSET.fractionDigits} signed />
          </li>
        ))}
      </ul>
      {tipCount > limit && <p className="border-t border-border px-4 py-2 text-[12.5px] text-ink-3">Showing the latest {limit.toString()} of {tipCount.toString()}.</p>}
      </div>
    </div>
  )
}

function SharePanel({ handle }: { handle: string }) {
  const url = `${APP_URL}/to/${handle}`
  const [qr, setQr] = useState<string | null>(null)
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 320 }).then(setQr).catch(() => setQr(null))
  }, [url])
  const post = `You can pay me in USDC on Arc via @Xylonet_: ${url}`
  const embed = `<a href="${url}" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#01c38d;color:#191e29;font:600 14px sans-serif;text-decoration:none">Pay me in USDC</a>` // token-exempt: embed snippet ships brand colours (Neo Mint fill, Midnight Navy type) to other sites
  return (
    <div className="grid max-w-[720px] gap-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="type-eyebrow">Your pay link</div>
        <div className="mt-3 grid gap-4 sm:grid-cols-[160px_1fr]">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`QR code for ${url}`} width={160} height={160} className="rounded-lg border border-border bg-card" />
          ) : (
            <Skeleton className="size-40 rounded-lg" />
          )}
          <div className="grid content-start gap-3">
            <CopyField value={url} label="Link" />
            <CopyField value={`${url}?amount=5`} label="With a preset amount" />
            <Button size="lg" className="h-10 w-fit" render={<a href={`https://x.com/intent/post?text=${encodeURIComponent(post)}`} target="_blank" rel="noopener noreferrer" />}>
              <Share2 data-icon="inline-start" />
              Post it on X
            </Button>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="type-eyebrow">Button for your site or bio</div>
        <div className="mt-3">
          <CopyField value={embed} label="HTML" />
        </div>
        <p className="mt-2 text-[13px] text-ink-3">Paste it anywhere HTML is allowed. It opens your pay page.</p>
      </div>
    </div>
  )
}
