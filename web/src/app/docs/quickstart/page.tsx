import type { Metadata } from 'next'
import { ARC_NETWORK } from '@/config/constants'
import { A, Cta, DocTitle, Numbered, Section, Steps } from '../_components/Doc'

export const metadata: Metadata = {
  title: 'Quick start — Docs',
  description: 'Connect a wallet, add Arc mainnet, get USDC on Arc and make your first exchange, bridge or payment.',
}

export default function QuickStartPage() {
  return (
    <div>
      <DocTitle title="Quick start" lede="From zero to your first transaction on Arc mainnet in a few minutes." />

      <Steps
        items={[
          {
            title: 'Connect a wallet',
            body: 'Click Connect in the header. RainbowKit supports MetaMask, Rabby, Coinbase Wallet, WalletConnect and more. XyloNet never holds your keys.',
          },
          {
            title: 'Add Arc mainnet',
            body: (
              <>
                When you switch networks the app asks your wallet to add Arc (chain {ARC_NETWORK.chainId}, currency USDC). You can also add it
                manually from the <A href="/docs/network">network setup</A> page.
              </>
            ),
          },
          {
            title: 'Get USDC on Arc',
            body: (
              <>
                Gas on Arc is paid in USDC. If your USDC lives on another chain, <A href="/bridge">bridge it in</A> with CCTP v2: the bridge
                burns on the source chain and mints native USDC on Arc.
              </>
            ),
          },
          {
            title: 'Exchange, bridge or pay',
            body: (
              <>
                <A href="/exchange">Exchange</A> any token via LI.FI routes, move USDC in or out with CCTP v2, or{' '}
                <A href="/pay">pay</A> any X handle in USDC with PayX.
              </>
            ),
          },
        ]}
      />

      <Section title="Your first exchange">
        <Numbered
          items={[
            <>
              Open <A href="/exchange">Exchange</A> and pick the token you have and the token you want. Source and destination can be on different chains.
            </>,
            'Enter an amount. LI.FI returns a route with the expected output, fees and estimated time.',
            'Approve the token if asked, then confirm the transaction in your wallet.',
            <>
              Track the transaction on the <A href={ARC_NETWORK.explorer}>Arc explorer</A>. It is final in under a second once it lands on Arc.
            </>,
          ]}
        />
      </Section>

      <Section title="Your first bridge">
        <Numbered
          items={[
            <>
              Open <A href="/bridge">Bridge</A>, choose the source chain and Arc as destination (or the reverse).
            </>,
            'For USDC, the CCTP v2 route burns on the source chain and mints native USDC on Arc after Circle attests the burn.',
            'Confirm the burn in your wallet. The mint completes automatically once the attestation is available.',
          ]}
        />
      </Section>

      <Section title="Your first payment">
        <Numbered
          items={[
            <>
              Open <A href="/pay">Pay</A>, type an X handle and a USDC amount.
            </>,
            'Confirm in your wallet. The USDC is held by the PayX contract on Arc under that handle.',
            <>
              The recipient visits the <A href="/pay/creator">creator hub</A>, signs in with X, connects any wallet and claims.
            </>,
          ]}
        />
      </Section>

      <Cta
        title="Need help?"
        description="Check the FAQ, or reach us on Discord and X."
        primary={{ href: '/docs/faq', label: 'FAQ' }}
        secondary={{ href: 'https://discord.gg/mcDkHNrFyA', label: 'Discord' }}
      />
    </div>
  )
}
