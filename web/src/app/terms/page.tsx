import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of service',
  description: 'XyloNet terms of service: rules and guidelines for using the platform.',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-2 text-[22px] font-semibold text-foreground">{title}</h2>
      <div className="grid gap-3 text-[15px] leading-relaxed text-ink-2">{children}</div>
    </section>
  )
}

const link = 'text-signal-deep underline underline-offset-4'

export default function TermsOfService() {
  return (
    <div className="mx-auto max-w-[1120px] px-4 pb-16 pt-8 sm:px-5 md:pt-10">
      <div className="max-w-[760px]">
        <h1 className="type-display text-[clamp(30px,4.5vw,40px)] text-foreground">Terms of service</h1>
        <p className="mt-2 text-[13px] text-ink-3">Last updated: September 15, 2026</p>

        <Section title="1. Acceptance of terms">
          <p>
            By accessing or using XyloNet (&quot;the Platform&quot;), you agree to be bound by these terms of service. If you do not agree to these terms,
            please do not use our services.
          </p>
        </Section>

        <Section title="2. Description of service">
          <p>
            XyloNet is a stablecoin exchange, bridge and payment front-end built on Arc, Circle&apos;s Layer 1 blockchain. Our services include token
            exchange and cross-chain bridging (routed through third-party protocols such as LI.FI and Circle CCTP) and the PayX payment system, all on
            Arc mainnet.
          </p>
        </Section>

        <Section title="3. Eligibility">
          <p>
            You must be at least 18 years old and legally able to enter into contracts to use our services. You are responsible for ensuring that your
            use of the Platform complies with applicable laws in your jurisdiction.
          </p>
        </Section>

        <Section title="4. Wallet connection">
          <p>
            To use our services, you must connect a compatible cryptocurrency wallet. You are solely responsible for the security of your wallet and
            private keys. We never have access to your private keys or seed phrases.
          </p>
        </Section>

        <Section title="5. Risks">
          <p>Using decentralized finance (DeFi) protocols involves significant risks:</p>
          <ul className="list-disc space-y-2 pl-5 marker:text-ink-3">
            <li>Smart contract risks and potential vulnerabilities</li>
            <li>Price volatility of digital assets</li>
            <li>Third-party routing and bridge protocol risks</li>
            <li>Network congestion and transaction failures</li>
            <li>Regulatory uncertainty</li>
          </ul>
        </Section>

        <Section title="6. No financial advice">
          <p>
            Nothing on this Platform constitutes financial, investment, legal, or tax advice. You should consult with qualified professionals before
            making any financial decisions.
          </p>
        </Section>

        <Section title="7. Limitation of liability">
          <p>
            XyloNet is provided &quot;as is&quot; without warranties of any kind. We are not liable for any losses resulting from your use of the Platform,
            including but not limited to trading losses, smart contract failures, or wallet compromises.
          </p>
        </Section>

        <Section title="8. Prohibited activities">
          <ul className="list-disc space-y-2 pl-5 marker:text-ink-3">
            <li>Using the Platform for illegal activities</li>
            <li>Attempting to exploit or manipulate smart contracts</li>
            <li>Interfering with the Platform&apos;s operation</li>
            <li>Impersonating other users or entities</li>
          </ul>
        </Section>

        <Section title="9. Changes to terms">
          <p>We may update these terms at any time. Continued use of the Platform after changes constitutes acceptance of the new terms.</p>
        </Section>

        <Section title="10. Contact">
          <p>
            For questions about these terms, contact us at{' '}
            <a href="mailto:forgelabs@xylonet.xyz" className={link}>
              forgelabs@xylonet.xyz
            </a>
            .
          </p>
        </Section>

        <Section title="Official links">
          <p>
            Official website:{' '}
            <a href="https://www.xylonet.xyz" className={link}>
              https://www.xylonet.xyz
            </a>
          </p>
        </Section>
      </div>
    </div>
  )
}
