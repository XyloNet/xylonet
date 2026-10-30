import type { Metadata } from 'next'
import { ArrowLeftRight, Coins, Send, Trophy } from 'lucide-react'
import { ARC_NETWORK } from '@/config/constants'
import { ChainLogo, TokenLogo } from '@/components/ui/TokenLogos'
import { Card, Cta, DocTitle, LinkCard, P, Section, Stat } from './_components/Doc'

export const metadata: Metadata = {
  title: 'Introduction — Docs',
  description: 'XyloNet documentation: exchange, bridge, PayX and points on Arc mainnet, with contract addresses, integration notes and FAQ.',
}

export default function DocsPage() {
  return (
    <div>
      <DocTitle
        eyebrow={`Live on Arc mainnet · chain ${ARC_NETWORK.chainId}`}
        title="Documentation"
        lede="XyloNet is the money app on Arc: exchange any token, bridge USDC with Circle CCTP v2, and pay anyone on X in USDC."
      />

      <Section title="What is XyloNet?" className="mt-0">
        <P>
          XyloNet is a stablecoin front-end for Arc, Circle&apos;s Layer 1 where USDC is the gas token. It does not run its
          own AMM: exchanges and any-token bridges are routed through LI.FI, native USDC bridging uses Circle&apos;s CCTP v2,
          and PayX is a small non-custodial contract that lets you pay an X handle in USDC.
        </P>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Card>
            <div className="mb-2 flex items-center gap-3">
              <TokenLogo symbol="USDC" size={28} />
              <span className="font-semibold text-foreground">USDC-native</span>
            </div>
            <P className="text-[14px]">Gas is paid in USDC. If you hold USDC on Arc you can use everything here; no other token is required.</P>
          </Card>
          <Card>
            <div className="mb-2 flex items-center gap-3">
              <ChainLogo chainId={ARC_NETWORK.chainId} size={28} />
              <span className="font-semibold text-foreground">Sub-second finality</span>
            </div>
            <P className="text-[14px]">Arc finalises blocks in under a second, so exchanges, bridges into Arc and payments settle almost instantly.</P>
          </Card>
        </div>
      </Section>

      <Section title="Products">
        <div className="grid gap-3">
          <LinkCard
            href="/docs/swap"
            icon={<ArrowLeftRight />}
            title="Exchange"
            description="Any token, any chain. Quotes and execution are routed by LI.FI across DEXs and bridges; you sign in your own wallet."
          />
          <LinkCard
            href="/docs/bridge"
            icon={<Coins />}
            title="Bridge"
            description={`Native USDC to and from Arc via Circle CCTP v2 (Arc domain 26). Any other token via LI.FI routes.`}
          />
          <LinkCard
            href="/docs/payx"
            icon={<Send />}
            title="Pay with PayX"
            description="Pay any X handle in USDC. Recipients claim with an X sign-in; no wallet needed up front."
          />
          <LinkCard
            href="/docs/points"
            icon={<Trophy />}
            title="Points"
            description="One point per dollar of activity, computed from public data. Rules, tiers and the public API."
          />
        </div>
      </Section>

      <Section title="Stablecoins on Arc">
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <TokenLogo symbol="USDC" size={40} className="mb-3" />
            <div className="font-semibold text-foreground">USDC</div>
            <div className="mt-0.5 text-[14px] text-ink-2">USD Coin by Circle</div>
            <div className="mt-1 text-[13px] text-ink-3">Native gas token on Arc</div>
          </Card>
          <Card>
            <TokenLogo symbol="EURC" size={40} className="mb-3" />
            <div className="font-semibold text-foreground">EURC</div>
            <div className="mt-0.5 text-[14px] text-ink-2">Euro Coin by Circle</div>
            <div className="mt-1 text-[13px] text-ink-3">EUR-backed stablecoin</div>
          </Card>
        </div>
      </Section>

      <Section title="Network at a glance">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat value={ARC_NETWORK.chainId} label="Chain ID" />
          <Stat value="USDC" label="Gas token" />
          <Stat value="<1s" label="Finality" />
          <Stat value="26" label="CCTP domain" />
        </div>
      </Section>

      <Cta
        title="Get started"
        description="Connect a wallet, add Arc mainnet, and make your first exchange, bridge or payment in a few minutes."
        primary={{ href: '/docs/quickstart', label: 'Quick start' }}
      />
    </div>
  )
}
