import type { Metadata } from 'next'
import Link from 'next/link'
import { ARC_NETWORK } from '@/config/constants'
import { Button } from '@/components/ui/button'
import { Bullets, Card, Code, DocTitle, H3, P, Section } from '../_components/Doc'

export const metadata: Metadata = {
  title: 'Architecture — Docs',
  description: 'How XyloNet is put together: a non-custodial front-end on Circle rails and LI.FI routing, plus the PayX contract.',
}

const layers = [
  {
    title: 'Front-end (this app)',
    body: 'Next.js App Router, wagmi + viem, RainbowKit. Runs entirely in your browser; it never holds keys or funds. Reads and broadcasts to Arc go through a same-origin JSON-RPC proxy (/api/rpc) so provider credentials stay server-side.',
  },
  {
    title: 'Routing: LI.FI',
    body: 'Exchange and any-token bridge quotes come from the LI.FI API. Execution is a single transaction to the LI.FI Diamond on the source chain, which calls the selected DEXs and bridges. XyloNet is registered as an integrator so optional fees flow through the FeeForwarder.',
  },
  {
    title: 'Settlement: Circle CCTP v2',
    body: 'Native USDC moves between Arc (domain 26) and other chains by burn-and-mint through TokenMessengerV2, MessageTransmitterV2 and TokenMinterV2. Circle attests every burn; no wrapped assets, no pooled liquidity.',
  },
  {
    title: 'PayX contract',
    body: 'A single payment contract on Arc holds USDC keyed by X handle. A claim requires an authorization signed by the XyloNet oracle after the recipient authenticates with X; the contract verifies the signature and releases the funds to the wallet the recipient chose.',
  },
  {
    title: 'Governance: Safes',
    body: 'Protocol admin rights and the fee treasury sit behind two 2-of-3 Gnosis Safes (v1.4.1). No single key can upgrade, pause or move treasury funds.',
  },
]

export default function ArchitecturePage() {
  return (
    <div>
      <DocTitle
        title="Architecture"
        lede="XyloNet is deliberately thin: a non-custodial front-end on top of Circle's rails and LI.FI's routing, plus one small contract for PayX."
      />

      <Section title="Request flow" className="mt-0">
        <Code>{`Browser (wagmi/viem)
   │
   ├─ reads / eth_sendRawTransaction ──► /api/rpc ──► Arc RPC (chain ${ARC_NETWORK.chainId})
   │
   ├─ Exchange / any-token bridge ─────► LI.FI API (quote) ──► LI.FI Diamond (execute)
   │
   ├─ USDC bridge ─────────────────────► TokenMessengerV2 (burn) ──► Circle attestation ──► MessageTransmitterV2 (mint on Arc)
   │
   └─ PayX pay / claim ────────────────► PayX contract on Arc  ◄── claim authorization signed after X sign-in`}</Code>
      </Section>

      <Section title="Components">
        <div className="grid gap-3">
          {layers.map((l) => (
            <Card key={l.title}>
              <H3 className="mb-1">{l.title}</H3>
              <P className="text-[14px]">{l.body}</P>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Design choices">
        <Bullets
          items={[
            <>
              <strong className="text-foreground">No custody.</strong> Every transaction is signed in the user&apos;s wallet. XyloNet servers only proxy RPC and sign
              PayX claim authorizations.
            </>,
            <>
              <strong className="text-foreground">No proprietary AMM.</strong> Liquidity is where it already is; LI.FI finds it. This removes an entire class of
              contract and liquidity risk from the protocol.
            </>,
            <>
              <strong className="text-foreground">Native USDC only.</strong> Bridged USDC arrives as the real asset via CCTP, so there is nothing to unwrap and no
              bridge-token depeg risk.
            </>,
            <>
              <strong className="text-foreground">Chain hygiene.</strong> The app is configured for Arc mainnet ({ARC_NETWORK.chainId}) only; testnet endpoints and
              addresses are not present in the build.
            </>,
          ]}
        />
      </Section>

      <div className="mt-10 flex flex-wrap gap-2">
        <Button variant="outline" size="lg" render={<Link href="/docs/contracts" />}>
          Contract addresses
        </Button>
        <Button variant="outline" size="lg" render={<Link href="/docs/security" />}>
          Security
        </Button>
        <Button variant="outline" size="lg" render={<Link href="/docs/integration" />}>
          Integration guide
        </Button>
      </div>
    </div>
  )
}
