import type { Metadata } from 'next'
import { ARC_NETWORK, CONTRACTS } from '@/config/constants'
import { explorerAddressUrl } from '@/config/wagmi'
import { A, AddressLink, Bullets, Callout, Card, DocTitle, H3, Section } from '../_components/Doc'

export const metadata: Metadata = {
  title: 'Security — Docs',
  description: 'What XyloNet controls, what it does not, key management with 2-of-3 Safes, and how to report a vulnerability.',
}

export default function SecurityPage() {
  return (
    <div>
      <DocTitle title="Security" lede="What XyloNet controls, what it does not, and how to keep yourself safe." />

      <Section title="Trust model" className="mt-0">
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <H3 className="mb-2">XyloNet never has</H3>
            <Bullets
              className="text-[14px]"
              items={[
                'Your private keys or seed phrase',
                'Custody of tokens during an exchange or bridge',
                'The ability to move funds out of the PayX contract without a valid claim signature and the recipient’s own transaction',
              ]}
            />
          </Card>
          <Card>
            <H3 className="mb-2">XyloNet does operate</H3>
            <Bullets
              className="text-[14px]"
              items={[
                'The website and its same-origin RPC proxy',
                'The PayX claim oracle that signs authorizations after X sign-in',
                'Two 2-of-3 Safes that hold admin rights and the treasury',
              ]}
            />
          </Card>
        </div>
      </Section>

      <Section title="Key management">
        <Bullets
          items={[
            <>
              Admin Safe <AddressLink address={CONTRACTS.ADMIN_SAFE} href={explorerAddressUrl(CONTRACTS.ADMIN_SAFE)} />: 2-of-3, Safe v1.4.1. Owns any
              upgradeable or pausable XyloNet contract.
            </>,
            <>
              Treasury Safe <AddressLink address={CONTRACTS.TREASURY_SAFE} href={explorerAddressUrl(CONTRACTS.TREASURY_SAFE)} />: 2-of-3. Receives
              integrator fees from the LI.FI FeeForwarder.
            </>,
            'The PayX oracle key is a dedicated server-side key with no other permissions; it can only authorize claims for a handle that has just authenticated with X.',
            'Provider RPC credentials live in server environment variables and are never shipped to the browser.',
          ]}
        />
      </Section>

      <Section title="Third-party components">
        <Bullets
          items={[
            <>
              <strong className="text-foreground">Circle CCTP v2</strong>: Circle-operated contracts and attestation service. Security posture documented by
              Circle.
            </>,
            <>
              <strong className="text-foreground">LI.FI</strong>: routing API and Diamond contract; venue risk depends on the DEXs and bridges in each route,
              which are shown in the quote.
            </>,
            <>
              <strong className="text-foreground">Wallets</strong>: RainbowKit / WalletConnect. Always confirm the chain and the contract you are approving
              inside the wallet.
            </>,
          ]}
        />
      </Section>

      <Section title="Staying safe">
        <Bullets
          items={[
            <>
              Only use <span className="text-foreground">xylonet.xyz</span>. We will never DM you first or ask for your seed phrase.
            </>,
            <>
              Check that approvals target the LI.FI Diamond or PayX addresses listed on the <A href="/docs/contracts">contracts page</A>.
            </>,
            'Revoke token approvals you no longer need from your wallet.',
            `Verify the chain ID is ${ARC_NETWORK.chainId} before signing.`,
          ]}
        />
      </Section>

      <Section title="Report a vulnerability">
        <Callout tone="signal">
          Email <A href="mailto:forgelabs@xylonet.xyz" external>forgelabs@xylonet.xyz</A> with details and reproduction steps. Please give us time to
          fix before public disclosure.
        </Callout>
      </Section>
    </div>
  )
}
