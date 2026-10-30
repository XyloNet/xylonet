import type { Metadata } from 'next'
import { ARC_NETWORK, CONTRACTS, SUPPORTED_CHAINS } from '@/config/constants'
import { ARC_CHAIN_ID, ARC_PUBLIC_RPC_URL, explorerAddressUrl } from '@/config/wagmi'
import { ChainLogo, TokenLogo } from '@/components/ui/TokenLogos'
import { A, AddressLink, Callout, Card, DocTitle, InlineCode, LinkCard, P, Section } from '../_components/Doc'
import { AddArcButton } from './AddArcButton'

export const metadata: Metadata = {
  title: 'Network setup — Docs',
  description: 'Arc mainnet details for XyloNet: chain ID 5042, USDC as gas, explorer, RPC, CCTP v2 domains and how to add Arc to your wallet.',
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <div className="type-eyebrow mb-1">{label}</div>
      <div className="text-[15px] text-foreground">{children}</div>
    </div>
  )
}

export default function NetworkPage() {
  return (
    <div>
      <DocTitle title="Network setup" lede="XyloNet runs on Arc mainnet, Circle's Layer 1 for stablecoin finance, where USDC is the gas token." />

      <Section title="What is Arc?" className="mt-0">
        <Card>
          <div className="mb-3 flex items-center gap-3">
            <ChainLogo chainId={ARC_CHAIN_ID} size={28} />
            <span className="font-semibold text-foreground">Arc</span>
          </div>
          <P>
            Arc is an EVM-compatible Layer 1 built by Circle. Instead of a separate gas token, transaction fees are paid in{' '}
            <strong className="text-foreground">USDC</strong>, which keeps costs predictable and lets anyone holding stablecoins transact without
            acquiring anything else first.
          </P>
          <P className="mt-3">Circle&apos;s stablecoins (USDC, EURC), CCTP v2 and Gateway are deployed natively, and finality is sub-second.</P>
        </Card>
      </Section>

      <Section title="Network configuration">
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Network name">
              <span className="font-mono">{ARC_NETWORK.name}</span>
            </Field>
            <Field label="Chain ID">
              <span className="font-mono">
                {ARC_NETWORK.chainId} <span className="text-ink-3">(0x{ARC_NETWORK.chainId.toString(16)})</span>
              </span>
            </Field>
            <Field label="Currency symbol">
              <span className="font-mono">USDC</span>
            </Field>
            <Field label="Block explorer">
              <A href={ARC_NETWORK.explorer} className="break-all font-mono text-[14px]">
                {ARC_NETWORK.explorer}
              </A>
            </Field>
            <Field label="RPC URL" wide>
              <P className="text-[14px]">
                Public RPC: use the URL published by Circle in the <A href={ARC_NETWORK.docs}>Arc docs</A>. The XyloNet app proxies its own reads and
                broadcasts through <InlineCode>/api/rpc</InlineCode>.
              </P>
              <p className="mt-2 break-all font-mono text-[13px] text-ink-3">App endpoint: {ARC_PUBLIC_RPC_URL}</p>
            </Field>
          </div>
          <Callout tone="info" className="mt-5" title="Decimals note">
            The native USDC balance the wallet shows uses 18 decimals; the ERC-20 interface at <InlineCode>{CONTRACTS.USDC}</InlineCode> uses 6
            decimals. Both are the same USDC.
          </Callout>
        </Card>
      </Section>

      <Section title="Add Arc to your wallet">
        <Card>
          <P className="mb-4">
            Click below to add Arc mainnet to an injected wallet (MetaMask, Rabby, Coinbase Wallet and others). The Connect button in the app header
            does the same thing automatically when you switch networks.
          </P>
          <AddArcButton />
        </Card>
      </Section>

      <Section title="CCTP v2 domains">
        <P className="mb-4">
          Arc is CCTP domain <strong className="text-foreground">26</strong>. Native USDC moves between Arc and these chains by burn-and-mint, with no
          wrapped assets.
        </P>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SUPPORTED_CHAINS.map((chain) => (
            <div key={chain.id} className={`flex items-center gap-3 rounded-xl border p-3 ${chain.id === ARC_CHAIN_ID ? 'border-signal-deep/30 bg-signal-tint' : 'border-border bg-card'}`}>
              <ChainLogo chainId={chain.id} size={28} name={chain.name} />
              <div className="min-w-0">
                <div className="truncate text-[14px] font-medium text-foreground">{chain.name}</div>
                <div className="font-mono text-[12px] text-ink-3">
                  Domain {chain.domain} · chain {chain.id}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Stablecoins on Arc">
        <div className="grid gap-3">
          {[
            { symbol: 'USDC', name: 'USD Coin by Circle, gas token', address: CONTRACTS.USDC },
            { symbol: 'EURC', name: 'Euro Coin by Circle', address: CONTRACTS.EURC },
          ].map((t) => (
            <Card key={t.symbol}>
              <div className="mb-3 flex items-center gap-3">
                <TokenLogo symbol={t.symbol} size={36} />
                <div>
                  <div className="font-semibold text-foreground">{t.symbol}</div>
                  <div className="text-[13px] text-ink-3">{t.name}</div>
                </div>
              </div>
              <div className="rounded-lg bg-surface-2 p-3 text-[13px]">
                <span className="text-ink-3">ERC-20: </span>
                <AddressLink address={t.address} href={explorerAddressUrl(t.address)} />
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Resources">
        <div className="grid gap-3 sm:grid-cols-2">
          <LinkCard href="https://www.arc.network" title="Arc website" description="Learn more about Arc and its roadmap." />
          <LinkCard href={ARC_NETWORK.explorer} title="Block explorer" description="Transactions, contracts and network activity." />
          <LinkCard href={ARC_NETWORK.docs} title="Arc documentation" description="Official RPC endpoints, contract addresses and developer guides." />
          <LinkCard href="https://developers.circle.com/cctp" title="CCTP v2 docs" description="How burn-and-mint USDC transfers work across chains." />
        </div>
      </Section>
    </div>
  )
}
