import type { Metadata } from 'next'
import { ARC_CHAIN_ID, ARC_EXPLORER_URL, ARC_PUBLIC_RPC_URL } from '@/config/wagmi'
import { ChainLogo, TokenLogo } from '@/components/ui/TokenLogos'
import { A, Callout, Card, Cta, DocTitle, H3, InlineCode, LinkCard, Numbered, P, Section } from '../../_components/Doc'

export const metadata: Metadata = {
  title: 'PayX quick start — Docs',
  description: 'Send your first payment to an X handle, or sign in with X and claim what has been sent to you.',
}

export default function PayXQuickStartPage() {
  return (
    <div>
      <DocTitle title="Quick start" lede="Send your first payment, or check and claim payments sent to you. Both take a couple of minutes." />

      <Section title="For creators: claim your payments" className="mt-0">
        <Card>
          <Numbered
            items={[
              <>
                Open the <A href="/pay/creator">creator hub</A>.
              </>,
              <>
                Click <strong className="text-foreground">Sign in with X</strong>. We only read your public profile.
              </>,
              'See your pending balance, straight from the contract.',
              <>
                Connect the wallet you want paid (it becomes your linked wallet) and click <strong className="text-foreground">Claim</strong>.
              </>,
            ]}
          />
        </Card>
        <Callout tone="signal" className="mt-3">
          USDC is paid directly from escrow to your wallet on Arc. No intermediaries, no waiting period.
        </Callout>
      </Section>

      <Section title="For payers: send a payment">
        <div className="grid gap-3">
          <Card>
            <H3 className="mb-3 flex items-center gap-2">
              <TokenLogo symbol="USDC" size={20} />
              Step 1: get USDC on Arc
            </H3>
            <Numbered
              items={[
                <>
                  Bridge USDC from Ethereum, Base, Arbitrum and more with the <A href="/bridge">XyloNet bridge</A> (Circle CCTP).
                </>,
                'Or withdraw USDC to Arc from an exchange that supports it.',
                'Gas is paid in USDC too; a few cents covers many payments.',
              ]}
            />
          </Card>

          <Card>
            <H3 className="mb-3">Step 2: pay from the web</H3>
            <Numbered
              items={[
                <>
                  Go to <A href="/pay">xylonet.xyz/pay</A> (or <InlineCode>xylonet.xyz/to/handle</InlineCode> to prefill the recipient).
                </>,
                'Enter the X username and pick an amount: $1 / $5 / $10 / $25 or custom (minimum 0.1 USDC).',
                'Add an optional message (up to 280 bytes).',
                'Connect your wallet; if it is on another network we ask it to switch to Arc.',
                'Approve exactly the payment amount of USDC, then confirm. Done. Share it on X from the receipt.',
              ]}
            />
          </Card>

          <Card>
            <H3 className="mb-1">Chrome extension</H3>
            <P className="text-[14px]">
              The extension adds a Pay button under every post on x.com and uses the same contract. Everything it does is available from the web while
              the store listing is updated. See <A href="/docs/payx/extension">the extension page</A>.
            </P>
          </Card>
        </div>
      </Section>

      <Section title="Arc setup">
        <Card>
          <P className="mb-4">PayX runs on Arc mainnet. The app offers to add it to your wallet automatically; to add it by hand:</P>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-surface-2 p-4">
              <div className="mb-3 flex items-center gap-2">
                <ChainLogo chainId={ARC_CHAIN_ID} size={20} />
                <span className="font-semibold text-foreground">Arc</span>
              </div>
              <dl className="grid gap-2 text-[14px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-3">Chain ID</dt>
                  <dd className="font-mono text-foreground">{ARC_CHAIN_ID}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-3">RPC URL</dt>
                  <dd className="break-all text-right font-mono text-[12px] text-foreground">{ARC_PUBLIC_RPC_URL}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-3">Currency</dt>
                  <dd className="font-mono text-foreground">USDC</dd>
                </div>
              </dl>
            </div>
            <div className="rounded-lg bg-surface-2 p-4">
              <div className="mb-3 font-semibold text-foreground">Block explorer</div>
              <A href={ARC_EXPLORER_URL} className="break-all font-mono text-[14px]">
                {ARC_EXPLORER_URL.replace(/^https?:\/\//, '')}
              </A>
            </div>
          </div>
        </Card>
      </Section>

      <Section title="What's next">
        <div className="grid gap-3 sm:grid-cols-2">
          <LinkCard href="/docs/payx/tipping" title="How paying works" description="The full flow from payment to claim." />
          <LinkCard href="/docs/payx/claiming" title="Claims and wallet linking" description="X sign-in, oracle signatures, linked wallets." />
          <LinkCard href="/docs/payx/contracts" title="Smart contract" description="Addresses, parameters, events and a viem example." />
          <LinkCard href="/docs/payx/faq" title="FAQ" description="Frequently asked questions about PayX." />
        </div>
      </Section>

      <Cta
        title="Need help?"
        description="Reach us on X or Discord for support and updates."
        primary={{ href: 'https://discord.gg/mcDkHNrFyA', label: 'Discord' }}
        secondary={{ href: 'https://x.com/Xylonet_', label: 'X' }}
      />
    </div>
  )
}
