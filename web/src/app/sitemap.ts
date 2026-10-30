import { MetadataRoute } from 'next'

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.xylonet.xyz').replace(/\/$/, '')

const routes: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
  { path: '', priority: 1, changeFrequency: 'weekly' },
  { path: '/exchange', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/bridge', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/pay', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/points', priority: 0.8, changeFrequency: 'daily' },
  { path: '/trust', priority: 0.7, changeFrequency: 'daily' },
  { path: '/pay/creator', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/docs', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/docs/quickstart', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/docs/network', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/docs/swap', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/docs/bridge', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/docs/architecture', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/docs/contracts', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/docs/integration', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/docs/security', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/docs/faq', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/whats-new', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/docs/points', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/docs/payx', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/docs/payx/quickstart', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/docs/payx/tipping', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/docs/payx/claiming', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/docs/payx/extension', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/docs/payx/contracts', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/docs/payx/security', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/docs/payx/faq', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return routes.map((r) => ({
    url: `${BASE_URL}${r.path}`,
    lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }))
}
