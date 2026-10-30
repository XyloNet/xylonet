import type { Metadata } from 'next'
import { CONTRACTS, SUPPORTED_CHAINS } from '@/config/constants'
import { explorerAddressUrl } from '@/config/wagmi'
import { ChainLogo } from '@/components/ui/TokenLogos'
import { AddressLink, Bullets, Card, Cta, DocTable, DocTitle, H3, Note, P, Section, Steps } from '../_components/Doc'

export const metadata: Metadata = {
  title: 'Bridge — Docs',
  description: 'How native USDC moves to and from Arc with Circle CCTP v2, and how any-token routes work through LI.FI.',
}

export default function BridgeDocsPage() {
  return (
    <div>
      <DocTitle title="Bridge" lede="Move USDC to and from Arc with Circle CCTP v2, or bring any other token in through LI.FI routes." />

      <Section title="Two ways to bridge" className="mt-0">
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <H3 className="mb-1">USDC: Circle CCTP v2</H3>
            <P className="text-[14px]">
              Native USDC, burn-and-mint. No wrapped tokens, no liquidity pools, no slippage. This is the default for USDC between Arc and any other
              CCTP chain.
            </P>
          </Card>
          <Card>
            <H3 className="mb-1">Any token: LI.FI</H3>
            <P className="text-[14px]">
              For non-USDC assets (or a swap-and-bridge in one step) the card asks LI.FI for a route across third-party bridges and DEXs and executes
              it through the LI.FI Diamond.
            </P>
          </Card>
        </div>
      </Section>

      <Section title="How CCTP v2 works">
        <P className="mb-4">
          Arc is CCTP domain <strong className="text-foreground">26</strong>. A transfer into Arc looks like this:
        </P>
        <Steps
          items={[
            { title: 'Approve', body: 'Allow TokenMessengerV2 on the source chain to spend your USDC.' },
            { title: 'Burn', body: 'Call depositForBurn with the amount, destination domain 26 and your Arc address. The USDC is burned on the source chain.' },
            {
              title: 'Attest',
              body: 'Circle’s attestation service observes the burn and signs an attestation. Fast Transfer settles in seconds on supported chains; Standard Transfer waits for source-chain finality.',
            },
            { title: 'Mint', body: 'receiveMessage is submitted to MessageTransmitterV2 on Arc with the attestation; TokenMinterV2 mints native USDC to your address.' },
          ]}
        />
        <Note>Bridging out of Arc is the same flow in reverse: burn on Arc (domain 26), mint on the destination domain.</Note>
      </Section>

      <Section title="CCTP v2 contracts on Arc">
        <DocTable
          head={['Contract', 'Address']}
          rows={[
            ['TokenMessengerV2', CONTRACTS.TOKEN_MESSENGER_V2],
            ['MessageTransmitterV2', CONTRACTS.MESSAGE_TRANSMITTER_V2],
            ['TokenMinterV2', CONTRACTS.TOKEN_MINTER_V2],
            ['USDC (ERC-20)', CONTRACTS.USDC],
          ].map(([name, addr]) => [<span key="n" className="whitespace-nowrap">{name}</span>, <AddressLink key="a" address={addr} href={explorerAddressUrl(addr)} />])}
        />
      </Section>

      <Section title="Supported CCTP domains">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SUPPORTED_CHAINS.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <ChainLogo chainId={c.id} size={28} name={c.name} />
              <div className="min-w-0">
                <div className="truncate text-[14px] font-medium text-foreground">{c.name}</div>
                <div className="font-mono text-[12px] text-ink-3">Domain {c.domain}</div>
              </div>
            </div>
          ))}
        </div>
        <Note>The bridge card lists every chain it can route from; LI.FI covers additional chains beyond the CCTP set.</Note>
      </Section>

      <Section title="Fees and timing">
        <Bullets
          items={[
            'CCTP charges the source-chain gas for the burn plus, on Fast Transfer routes, a small Circle fee shown in the quote.',
            'LI.FI routes show the bridge fee, DEX fees and gas up front; XyloNet may add an integrator fee that is displayed in the quote before you sign.',
            'Minting on Arc costs a fraction of a cent in USDC.',
          ]}
        />
      </Section>

      <Cta title="Ready to bridge?" description="Native USDC into Arc in a couple of clicks." primary={{ href: '/bridge', label: 'Open Bridge' }} />
    </div>
  )
}
