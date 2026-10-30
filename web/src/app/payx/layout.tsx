import type { Metadata } from 'next';
import Script from 'next/script';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.xylonet.xyz').replace(/\/$/, '');

// The root layout's template appends " | XyloNet" to this default.
const PAYX_TITLE = 'PayX — Tip anyone on X in USDC';

export const metadata: Metadata = {
  title: {
    // /payx itself; child pages (tip, claim, dashboard, docs) set their own title and get the template.
    default: PAYX_TITLE,
    template: '%s | PayX by XyloNet',
  },
  description:
    'Tip any X account in USDC on Arc mainnet. Tips wait in escrow until the creator signs in with X to claim — no wallet needed to receive.',
  keywords: ['tipping', 'X', 'Twitter', 'USDC', 'Arc', 'Arc mainnet', 'crypto', 'PayX', 'XyloNet', 'stablecoin'],
  authors: [{ name: 'XyloNet', url: APP_URL }],
  creator: 'XyloNet',
  publisher: 'XyloNet',
  robots: 'index, follow',
  openGraph: {
    title: PAYX_TITLE,
    description: 'Tip any X account in USDC on Arc mainnet. 1% fee, 0.1 USDC minimum, sub-second finality.',
    url: `${APP_URL}/payx`,
    siteName: 'XyloNet',
    type: 'website',
    locale: 'en_US',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'PayX by XyloNet' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PayX — Tip anyone on X in USDC',
    description: 'Tip any X account in USDC on Arc mainnet. Sign in with X to claim.',
    creator: '@Xylonet_',
    site: '@Xylonet_',
    images: ['/og.png'],
  },
  verification: {
    google: 'googleacc01605102cb694',
  },
};

// JSON-LD Structured Data for trust signals
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'PayX by XyloNet',
  description: 'Tip any X account in USDC on Arc mainnet',
  url: `${APP_URL}/payx`,
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  author: {
    '@type': 'Organization',
    name: 'XyloNet',
    url: APP_URL,
  },
  provider: {
    '@type': 'Organization',
    name: 'XyloNet',
    url: APP_URL,
  },
};

export default function PayXLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Script
        id="payx-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </div>
  );
}
