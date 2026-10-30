import type { Metadata } from 'next'
import { CONTRACTS, LIFI } from '@/config/constants'
import { explorerAddressUrl } from '@/config/wagmi'
import { AddressLink, Bullets, Cta, DocTable, DocTitle, InlineCode, P, Section, Steps } from '../_components/Doc'

export const metadata: Metadata = {
  title: 'Exchange — Docs',
  description: 'How XyloNet Exchange quotes and executes routes through LI.FI on Arc mainnet: fees, slippage and contract addresses.',
}

export default function ExchangeDocsPage() {
  return (
    <div>
      <DocTitle title="Exchange" lede="Any token, any chain. XyloNet Exchange is routed by LI.FI and settles in your own wallet." />

      <Section title="How it works" className="mt-0">
        <P className="mb-4">
          XyloNet does not run its own AMM on mainnet. When you request an exchange, the card asks LI.FI for a route across the DEXs and bridges it
          aggregates, shows you the expected output, fees and time, and then executes that route through the LI.FI Diamond contract. Same-chain
          swaps on Arc and cross-chain swaps (for example ETH on Base to USDC on Arc) use the same flow.
        </P>
        <Steps
          items={[
            { title: 'Quote', body: 'Pick source and destination tokens (and chains) and an amount. LI.FI returns one or more routes.' },
            { title: 'Approve', body: 'If the source token is an ERC-20, approve the LI.FI Diamond (or Permit2) for the amount.' },
            { title: 'Execute', body: 'Sign one transaction. Single-chain swaps complete in the same block on Arc; cross-chain routes complete once the bridge leg settles.' },
            { title: 'Receive', body: 'Tokens land in the receiving address you chose, by default your connected wallet.' },
          ]}
        />
      </Section>

      <Section title="Fees">
        <Bullets
          items={[
            'DEX and bridge fees are set by the venues in the route and are shown in the quote.',
            <>
              XyloNet is registered with LI.FI as integrator <InlineCode>{LIFI.integrator}</InlineCode>.
              {LIFI.fee ? ` An integrator fee of ${(LIFI.fee * 100).toFixed(2)}% is added to routes that start on Arc and displayed before you sign.` : ' No integrator fee is currently applied.'}{' '}
              Any integrator fee is collected by the LI.FI FeeForwarder and routed to the XyloNet Treasury Safe.
            </>,
            'Gas on Arc is paid in USDC and typically costs a fraction of a cent.',
          ]}
        />
      </Section>

      <Section title="Slippage and safety">
        <Bullets
          items={[
            'The quote includes a minimum received amount. If the market moves beyond your slippage tolerance the transaction reverts.',
            'Verify the destination token address in the quote; LI.FI lists tokens by symbol and address.',
            'Approvals are granted to the LI.FI Diamond at the address below. Revoke them any time from your wallet.',
          ]}
        />
      </Section>

      <Section title="Contracts">
        <DocTable
          head={['Contract', 'Address']}
          rows={[
            ['LI.FI Diamond', CONTRACTS.LIFI_DIAMOND],
            ['LI.FI FeeForwarder', CONTRACTS.LIFI_FEE_FORWARDER],
            ['Permit2', CONTRACTS.PERMIT2],
            ['USDC (ERC-20)', CONTRACTS.USDC],
            ['EURC', CONTRACTS.EURC],
          ].map(([name, addr]) => [<span key="n" className="whitespace-nowrap">{name}</span>, <AddressLink key="a" address={addr} href={explorerAddressUrl(addr)} />])}
        />
      </Section>

      <Cta title="Try it" description="Get a live quote. No wallet is needed until you execute." primary={{ href: '/exchange', label: 'Open Exchange' }} />
    </div>
  )
}
