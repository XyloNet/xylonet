import type { Metadata } from 'next'
import { Database, Globe, MousePointerClick, Wallet } from 'lucide-react'
import { ARC_CHAIN_ID } from '@/config/wagmi'
import { StatusPill } from '@/components/xylo/StatusPill'
import { Bullets, Callout, Card, Cta, DocTitle, H3, InlineCode, P, Section } from '../../_components/Doc'

export const metadata: Metadata = {
  title: 'Chrome extension — Docs',
  description: 'The PayX Chrome extension adds a Pay button under every post on x.com. What it does, its permissions and troubleshooting.',
}

export default function ExtensionPage() {
  return (
    <div>
      <DocTitle
        title="Chrome extension"
        lede="The PayX extension adds a Pay button under every post on x.com. Everything it does is available from the web while the store listing is updated."
      />

      <Callout tone="info" title="Availability">
        The mainnet build (v2.0.0, chain {ARC_CHAIN_ID}) is available from the web while the Chrome Web Store listing is updated. We will link the
        listing here as soon as it is live. Payment links work today: <InlineCode>xylonet.xyz/to/handle</InlineCode> prefills the recipient.
      </Callout>

      <Section title="What it does">
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <MousePointerClick className="mb-3 size-5 text-signal-deep" aria-hidden />
            <H3 className="mb-1">Pay buttons</H3>
            <P className="text-[14px]">Adds a Pay button below every post on x.com: timeline, profiles and single posts.</P>
          </Card>
          <Card>
            <Wallet className="mb-3 size-5 text-signal-deep" aria-hidden />
            <H3 className="mb-1">Your wallet, your keys</H3>
            <P className="text-[14px]">Connects to MetaMask, Rabby or any injected EVM wallet; every transaction is signed by you.</P>
          </Card>
          <Card>
            <Database className="mb-3 size-5 text-signal-deep" aria-hidden />
            <H3 className="mb-1">Balance at a glance</H3>
            <P className="text-[14px]">See your USDC on Arc and jump to the creator hub from the popup.</P>
          </Card>
        </div>
      </Section>

      <Section title="Same contract as the web">
        <Card>
          <P className="mb-4 text-[14px]">
            The extension and the web Pay page call the same PayXTipping v2 contract on Arc mainnet. A payment sent from either place lands in the same
            escrow, shows up in the same hub and is claimed the same way.
          </P>
          <dl className="grid gap-3">
            {[
              ['Amount selection', 'Presets ($1, $5, $10, $25) or any custom amount from 0.1 USDC'],
              ['Optional message', 'Up to 280 bytes, stored onchain with the payment'],
              ['Exact-amount approval', 'The extension approves only the amount being paid, never unlimited'],
              ['Fee preview', 'Shows the 1% platform fee and what the creator receives before you confirm'],
            ].map(([t, d]) => (
              <div key={t}>
                <dt className="text-[14px] font-semibold text-foreground">{t}</dt>
                <dd className="text-[13px] text-ink-3">{d}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </Section>

      <Section title="Permissions">
        <Card>
          <P className="mb-3 text-[14px]">The extension requests only:</P>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 p-3">
              <span className="flex items-center gap-2 text-[14px] text-foreground">
                <Globe className="size-4 text-ink-3" aria-hidden />
                x.com / twitter.com
              </span>
              <span className="text-[12px] text-ink-3">Content script for the Pay button</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 p-3">
              <span className="flex items-center gap-2 text-[14px] text-foreground">
                <Database className="size-4 text-ink-3" aria-hidden />
                Storage
              </span>
              <span className="text-[12px] text-ink-3">Remember your wallet connection</span>
            </div>
          </div>
          <Callout tone="signal" className="mt-3">
            PayX never sees your private keys. All transactions are signed by your wallet.
          </Callout>
        </Card>
      </Section>

      <Section title="Troubleshooting">
        <div className="grid gap-3">
          <Card>
            <H3 className="mb-2">Pay button not appearing?</H3>
            <Bullets className="text-[14px]" items={['Refresh the x.com page.', 'Make sure the extension is enabled in chrome://extensions.', 'Try disabling and re-enabling the extension.']} />
          </Card>
          <Card>
            <H3 className="mb-2">Wallet not connecting?</H3>
            <Bullets
              className="text-[14px]"
              items={[
                'Make sure your wallet is installed and unlocked.',
                `Check that you are on Arc (chain ID ${ARC_CHAIN_ID}); the extension offers to add it.`,
                'Click "Connect wallet" in the extension popup first.',
              ]}
            />
          </Card>
          <Card>
            <H3 className="mb-2">Transaction failing?</H3>
            <Bullets
              className="text-[14px]"
              items={[
                'Ensure you have enough USDC on Arc for the payment plus about $0.01 gas.',
                'Confirm the USDC approval first, then the payment.',
                <>
                  Payments below 0.1 USDC are rejected (<InlineCode>InvalidAmount</InlineCode>).
                </>,
              ]}
            />
          </Card>
        </div>
      </Section>

      <Section title="Version">
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <H3>PayX extension</H3>
            <div className="text-[14px] text-ink-2">Mainnet build, built by XyloNet on Arc</div>
          </div>
          <StatusPill tone="signal" dot={false}>
            <span className="font-mono">v2.0.0</span>
          </StatusPill>
        </Card>
      </Section>

      <Cta title="Pay from the web today" description="Everything the extension does, without installing anything." primary={{ href: '/pay', label: 'Open Pay' }} />
    </div>
  )
}
