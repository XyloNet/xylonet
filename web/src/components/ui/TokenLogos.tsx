'use client'

// Chain / token / partner marks, rendered consistently.
//
// Every chain mark lives at /public/chains/<chainId>.<svg|png>. The LI.FI set
// (https://li.quest/v1/chains) ships 32x32 square tiles that are designed to be
// masked into a circle, so those render edge-to-edge. Transparent marks that are
// not a tile (the approved Arc arch, Circle stablecoin coins) render with
// object-contain inside the same fixed square box, never stretched or cropped.

import { useState } from 'react'

interface LogoBoxProps {
  size?: number
  className?: string
}

interface ChainLogoMeta {
  src: string
  name: string
  /** Square tile artwork meant to be masked to a circle (no inner padding). */
  tile?: boolean
}

/** chainId -> official mark. Keys mirror `bridgeChains` in src/config/wagmi.ts. */
export const CHAIN_LOGOS: Record<number, ChainLogoMeta> = {
  5042: { src: '/chains/5042.png', name: 'Arc' },
  1: { src: '/chains/1.svg', name: 'Ethereum', tile: true },
  42161: { src: '/chains/42161.svg', name: 'Arbitrum', tile: true },
  8453: { src: '/chains/8453.svg', name: 'Base', tile: true },
  10: { src: '/chains/10.svg', name: 'OP Mainnet', tile: true },
  137: { src: '/chains/137.svg', name: 'Polygon', tile: true },
  43114: { src: '/chains/43114.svg', name: 'Avalanche', tile: true },
  59144: { src: '/chains/59144.svg', name: 'Linea', tile: true },
  130: { src: '/chains/130.svg', name: 'Unichain', tile: true },
  480: { src: '/chains/480.svg', name: 'World Chain', tile: true },
  146: { src: '/chains/146.svg', name: 'Sonic', tile: true },
  1329: { src: '/chains/1329.svg', name: 'Sei', tile: true },
  50: { src: '/chains/50.svg', name: 'XDC', tile: true },
  57073: { src: '/chains/57073.svg', name: 'Ink', tile: true },
  98866: { src: '/chains/98866.svg', name: 'Plume', tile: true },
  143: { src: '/chains/143.svg', name: 'Monad', tile: true },
  2818: { src: '/chains/2818.svg', name: 'Morph', tile: true },
  81224: { src: '/chains/81224.png', name: 'Codex', tile: true },
}

/** Token symbol -> mark. Circle stablecoin coins are circular and render edge-to-edge. */
export const TOKEN_LOGOS: Record<string, { src: string; name: string }> = {
  USDC: { src: '/tokens/usdc.svg', name: 'USDC' },
  EURC: { src: '/tokens/eurc.png', name: 'EURC' },
  CIRBTC: { src: '/tokens/cirbtc.svg', name: 'cirBTC' },
}

/**
 * Fixed square, circular-masked frame. `size` is the rendered box in px; the
 * image is contained inside it, so a 40px logo is always 40px wide and tall.
 */
function LogoFrame({
  size,
  className,
  src,
  alt,
  padded,
  fallback,
}: {
  size: number
  className: string
  src: string | null
  alt: string
  padded: boolean
  fallback: string
}) {
  const [failed, setFailed] = useState(false)
  const showImage = !!src && !failed

  return (
    <span
      role="img"
      aria-label={alt}
      className={`inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden bg-white/5 ring-1 ring-white/10 ${className}`}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny inline SVG logos, no optimisation needed
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          draggable={false}
          onError={() => setFailed(true)}
          className={`block w-full h-full object-contain select-none ${padded ? 'p-[2px]' : ''}`}
        />
      ) : (
        <span
          className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0A786A] to-[#01C38E] text-white font-bold leading-none"
          style={{ fontSize: Math.max(8, Math.round(size * 0.42)) }}
        >
          {fallback}
        </span>
      )}
    </span>
  )
}

export function ChainLogo({
  chainId,
  size = 32,
  className = '',
  name,
}: LogoBoxProps & { chainId: number; /** Display name, only used for alt/fallback when the id is unknown. */ name?: string }) {
  const meta = CHAIN_LOGOS[chainId]
  const label = meta?.name ?? name ?? `Chain ${chainId}`
  return (
    <LogoFrame
      size={size}
      className={className}
      src={meta?.src ?? null}
      alt={label}
      padded={!meta?.tile}
      fallback={label.charAt(0).toUpperCase()}
    />
  )
}

export function TokenLogo({ symbol, size = 32, className = '' }: LogoBoxProps & { symbol: string }) {
  const key = symbol.toUpperCase()
  const meta = TOKEN_LOGOS[key]
  return (
    <LogoFrame
      size={size}
      className={className}
      src={meta?.src ?? null}
      alt={meta?.name ?? symbol}
      padded={false}
      fallback={symbol.charAt(0).toUpperCase()}
    />
  )
}

export function USDCLogo(props: LogoBoxProps) {
  return <TokenLogo symbol="USDC" {...props} />
}

export function EURCLogo(props: LogoBoxProps) {
  return <TokenLogo symbol="EURC" {...props} />
}

export function ArcLogo(props: LogoBoxProps) {
  return <ChainLogo chainId={5042} {...props} />
}

// ─── Partner marks ───────────────────────────────────────────────────────────

/**
 * Official LI.FI horizontal lockup (icon + wordmark, white, for dark surfaces).
 * Brand rule: the wordmark is never shown without the icon. Source SVG is
 * 132x48, so `height` drives the width (≈2.75:1).
 */
export function LiFiLockup({ height = 18, className = '' }: { height?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny inline SVG logos, no optimisation needed
    <img
      src="/partners/lifi.svg"
      alt="LI.FI"
      height={height}
      width={Math.round(height * (132 / 48))}
      draggable={false}
      className={`inline-block w-auto select-none ${className}`}
      style={{ height }}
    />
  )
}

/** Official Circle gradient mark (dark-background variant). */
export function CircleMark({ size = 20, className = '' }: LogoBoxProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny inline SVG logos, no optimisation needed
    <img
      src="/partners/circle.png"
      alt="Circle"
      width={size}
      height={size}
      draggable={false}
      className={`inline-block shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
