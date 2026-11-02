import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'XyloNet: the money app on Arc',
    short_name: 'XyloNet',
    description: 'Pay anyone on X, exchange USDC and EURC, and move dollars between chains on Arc.',
    start_url: '/',
    display: 'standalone',
    background_color: '#191e29', // token-exempt: manifest, mirrors --background
    theme_color: '#191e29', // token-exempt: manifest, mirrors --background
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
