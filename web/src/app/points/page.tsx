import type { Metadata } from 'next'
import { PointsView } from './PointsView'

export const metadata: Metadata = {
  title: 'Points',
  description: 'XyloNet Points, Season 1. One point for every dollar you exchange, bridge or pay on Arc, plus activity and first-time bonuses, computed from public onchain data.',
  alternates: { canonical: '/points' },
}

export default function PointsPage() {
  return <PointsView />
}
