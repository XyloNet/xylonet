import type { Metadata, Viewport } from 'next'
import { Fraunces, Geist_Mono, Instrument_Sans } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { Providers } from '@/components/Providers'
import { Header } from '@/components/shell/Header'
import { MobileTabBar } from '@/components/shell/MobileTabBar'
import { Footer } from '@/components/shell/Footer'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { RegisterSW } from '@/components/pwa/RegisterSW'

// Three faces, three jobs. Variables live on <html> so every descendant,
// including portals, inherits them (the v1 bug was a variable set on <body>
// and read at :root).
const sans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-sans-app',
  display: 'swap',
  axes: ['wdth'],
})
const display = Fraunces({
  subsets: ['latin'],
  weight: 'variable',
  style: ['normal', 'italic'],
  axes: ['SOFT', 'WONK', 'opsz'],
  variable: '--font-display-app',
  display: 'swap',
})
const mono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono-app',
  display: 'swap',
})

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.xylonet.xyz').replace(/\/$/, '')
const SITE_TITLE = 'XyloNet'
const SITE_DESCRIPTION =
  'The money app on Arc. Pay anyone on X, exchange USDC and EURC, and move dollars between chains, settled instantly with fees in cents.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_TITLE}: the money app on Arc`,
    template: '%s | XyloNet',
  },
  description: SITE_DESCRIPTION,
  applicationName: 'XyloNet',
  keywords: ['Arc', 'Arc mainnet', 'USDC', 'EURC', 'stablecoin', 'pay', 'exchange', 'bridge', 'CCTP', 'LI.FI', 'PayX', 'Circle'],
  manifest: '/manifest.webmanifest',
  authors: [{ name: 'ForgeLabs', url: SITE_URL }],
  creator: 'ForgeLabs',
  publisher: 'XyloNet',
  robots: 'index, follow',
  openGraph: {
    title: `${SITE_TITLE}: the money app on Arc`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: 'XyloNet',
    type: 'website',
    locale: 'en_US',
    images: [{ url: '/og.png?v=3', width: 1200, height: 630, alt: 'XyloNet on Arc' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_TITLE}: the money app on Arc`,
    description: 'Pay, exchange and move dollars on Arc. Settled instantly.',
    creator: '@Xylonet_',
    site: '@Xylonet_',
    images: ['/og.png?v=3'],
  },
  verification: {
    google: 'googleacc01605102cb694',
  },
  appleWebApp: {
    capable: true,
    title: 'XyloNet',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f1ea' }, // token-exempt: meta tag, mirrors --background
    { media: '(prefers-color-scheme: dark)', color: '#0f0e0c' }, // token-exempt: meta tag, mirrors --background
  ],
}

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'XyloNet',
  alternateName: 'ForgeLabs',
  url: SITE_URL,
  logo: `${SITE_URL}/icon-512.png`,
  description: 'The money app on Arc: pay anyone on X, exchange USDC and EURC, move dollars between chains.',
  foundingDate: '2024',
  sameAs: ['https://x.com/Xylonet_', 'https://discord.gg/mcDkHNrFyA'],
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'forgelabs@xylonet.xyz',
    contactType: 'customer support',
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <Script
          id="organization-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body className="min-h-dvh flex flex-col">
        <Providers>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow-float"
          >
            Skip to content
          </a>
          <Header />
          <main id="main" className="flex-1 pb-[calc(64px+env(safe-area-inset-bottom,0px))] md:pb-0">
            {children}
          </main>
          <Footer />
          <MobileTabBar />
          <SpeedInsights />
          <RegisterSW />
        </Providers>
      </body>
    </html>
  )
}
