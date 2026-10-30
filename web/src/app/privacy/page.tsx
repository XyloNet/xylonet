import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'XyloNet privacy policy: how we handle your data.',
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

export default function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-[1120px] px-4 pb-16 pt-8 sm:px-5 md:pt-10">
      <div className="max-w-[760px]">
        <h1 className="type-display text-[clamp(30px,4.5vw,40px)] text-foreground">Privacy policy</h1>
        <p className="mt-2 text-[13px] text-ink-3">Last updated: September 15, 2026</p>

        <Section title="Introduction">
          <p>
            XyloNet (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is a non-custodial exchange, bridge and payment front-end on Arc, Circle&apos;s Layer 1 where
            USDC is the gas token. This privacy policy explains how we collect, use, and protect your information when you use our services.
          </p>
        </Section>

        <Section title="Information we collect">
          <p>We collect minimal information:</p>
          <ul className="list-disc space-y-2 pl-5 marker:text-ink-3">
            <li>
              <strong className="text-foreground">Wallet address:</strong> your public wallet address when you connect your wallet.
            </li>
            <li>
              <strong className="text-foreground">Transaction data:</strong> onchain transaction data that is publicly available on the blockchain.
            </li>
            <li>
              <strong className="text-foreground">Usage data:</strong> anonymous performance analytics (Vercel Speed Insights) to improve our services.
            </li>
            <li>
              <strong className="text-foreground">X sign-in session:</strong> when you sign in with X in the creator hub to claim PayX payments, we read your
              public profile and keep your verified username in an encrypted, HttpOnly session cookie. We never request posting permissions.
            </li>
          </ul>
          <p>
            The PayX oracle signing service uses your verified X handle and the wallet you connect to produce a claim authorization; it does not store
            anything beyond what is needed to rate-limit and sign. The points indexer reads only public chain data and LI.FI transfer records; it holds
            no personal information.
          </p>
        </Section>

        <Section title="How we use your information">
          <ul className="list-disc space-y-2 pl-5 marker:text-ink-3">
            <li>To provide and maintain the exchange, bridge and PayX services</li>
            <li>To process transactions on the blockchain</li>
            <li>To improve and optimize user experience</li>
            <li>To communicate important updates about our services</li>
          </ul>
        </Section>

        <Section title="Data security">
          <p>
            We implement industry-standard security measures to protect your information. However, please note that blockchain transactions are
            public and immutable by design. We do not store private keys or sensitive wallet information.
          </p>
        </Section>

        <Section title="Third-party services">
          <p>
            We may use third-party services such as wallet providers (MetaMask, OKX Wallet, etc.), routing and bridge protocols (LI.FI, Circle CCTP),
            analytics services, and RPC providers. These services have their own privacy policies.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You have the right to disconnect your wallet or sign out of X at any time. Onchain data cannot be deleted due to the immutable nature of
            blockchain technology.
          </p>
        </Section>

        <Section title="Contact us">
          <p>
            If you have questions about this privacy policy, please contact us at{' '}
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
