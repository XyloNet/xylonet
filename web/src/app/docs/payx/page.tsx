import type { Metadata } from 'next'
import { FileText, Puzzle, Send, Wallet } from 'lucide-react'
import { ChainLogo, TokenLogo } from '@/components/ui/TokenLogos'
import { ARC_NETWORK, payXAssetSymbolList, payXMinTipList } from '@/config/constants'
import { Card, Cta, DocTitle, LinkCard, P, Section, Stat, Steps } from '../_components/Doc'

export const metadata: Metadata = {
  title: 'PayX — Docs',
  description: `How PayX payments and claims work on Arc mainnet: ${payXAssetSymbolList('or')}, 1% fee, ${payXMinTipList('or')} minimum, X sign-in to claim, contract and security notes.`,
}

export default function PayXDocsPage() {
  return (
    <div>
      <DocTitle
        eyebrow={`Live on Arc mainnet · chain ${ARC_NETWORK.chainId}`}
        title="Pay with PayX"
        lede={
          <>
            PayX lets anyone pay any X account in {payXAssetSymbolList('or')} on Arc mainnet. Payments wait in an onchain escrow under the handle until
            the creator signs in with X and claims them. No wallet is needed to receive.
          </>
        }
      />

      <Section title="What is PayX?" className="mt-0">
        <P>
          PayX is a payment protocol on Arc, Circle&apos;s stablecoin-native chain. A payer calls a PayXTipping v2 contract with a handle, an amount and an
          optional message. The tokens are escrowed under the lowercase handle. There is one contract per supported asset (currently{' '}
          {payXAssetSymbolList()}), each with its own balances and claims. The creator proves ownership of that handle with X OAuth; our oracle then
          issues an EIP-712 authorization the contract verifies before paying out to the wallet they choose.
        </P>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Card>
            <div className="mb-2 flex items-center gap-3">
              <TokenLogo symbol="USDC" size={28} />
              <span className="font-semibold text-foreground">Native USDC</span>
            </div>
            <P className="text-[14px]">Payments move Circle&apos;s USDC on Arc (6-decimal ERC-20 interface at 0x3600…0000). Gas is paid in USDC too.</P>
          </Card>
          <Card>
            <div className="mb-2 flex items-center gap-3">
              <ChainLogo chainId={ARC_NETWORK.chainId} size={28} />
              <span className="font-semibold text-foreground">Sub-second finality</span>
            </div>
            <P className="text-[14px]">Arc confirms in well under a second. A payment is in escrow before the wallet closes.</P>
          </Card>
        </div>
      </Section>

      <Section title="Key features">
        <div className="grid gap-3">
          <LinkCard
            href="/docs/payx/tipping"
            icon={<Send />}
            title="Pay from the web"
            description="Enter any X username on the Pay page, pick an amount from 0.1 USDC, add a message and confirm in your wallet."
          />
          <LinkCard
            href="/docs/payx/claiming"
            icon={<Wallet />}
            title="No wallet needed to receive"
            description="Recipients don't need a wallet to get paid. They sign in with X to prove ownership and claim to any wallet later."
          />
          <LinkCard
            href="/docs/payx/extension"
            icon={<Puzzle />}
            title="Chrome extension"
            description="Adds a Pay button under every post on x.com. Everything it does is available from the web while the store listing is updated."
          />
          <LinkCard
            href="/docs/payx/contracts"
            icon={<FileText />}
            title="Open, hardened smart contract"
            description="PayXTipping v2: EIP-712 claims, pausable, Ownable2Step owned by a 2-of-3 Safe, and no owner path to user escrow."
          />
        </div>
      </Section>

      <Section title="How it works">
        <Steps
          items={[
            { title: 'Enter a handle', body: 'On the web Pay page or via the extension.' },
            { title: 'Send USDC', body: 'Approve, then pay; 1% fee.' },
            { title: 'Held in escrow', body: 'Under the lowercase handle, onchain.' },
            { title: 'Creator claims', body: 'Sign in with X, withdraw to any wallet.' },
          ]}
        />
      </Section>

      <Section title="Protocol parameters">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat value="<1s" label="Finality" />
          <Stat value="1%" label="Platform fee (100 bps)" />
          <Stat value="~$0.01" label="Gas per tx (USDC)" />
          <Stat value="0.1 USDC" label="Minimum payment" />
        </div>
      </Section>

      <Cta
        title="Get started"
        description="Ready to send or receive? The quick start covers both sides in a couple of minutes."
        primary={{ href: '/pay', label: 'Pay someone now' }}
        secondary={{ href: '/docs/payx/quickstart', label: 'Quick start' }}
      />
    </div>
  )
}
