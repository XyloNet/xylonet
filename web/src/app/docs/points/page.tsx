import type { Metadata } from 'next'
import { RULES, SEASON, TIERS } from '@/lib/points/rules'
import { CONTRACTS, LIFI } from '@/config/constants'
import { explorerAddressUrl } from '@/config/wagmi'
import { A, AddressLink, Bullets, Card, DocTable, DocTitle, InlineCode, Note, P, Section } from '../_components/Doc'

export const metadata: Metadata = {
  title: 'Points — Docs',
  description: 'How XyloNet Points work: Season 1 rules, what counts, how points are computed from onchain data, and the public API.',
}

const fmtDate = (unix: number) => new Date(unix * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export default function PointsDocsPage() {
  const boost = RULES.boosts[0]
  return (
    <div>
      <DocTitle
        eyebrow={`${SEASON.name} · rules v${SEASON.rulesVersion}`}
        title="Points"
        lede={
          <>
            A transparent loyalty programme for using XyloNet on Arc mainnet. One point per dollar of activity, computed entirely from public data and
            counted from launch. Check yours on the <A href="/points">Points page</A>.
          </>
        }
      />

      <Section title="What earns points" className="mt-0">
        <DocTable
          head={['Action', 'Points', 'Notes']}
          rows={[
            ['Exchange', `${RULES.volumePointsPerUsd} per $1`, 'Any LI.FI route started from the XyloNet Exchange page, on any chain. Valued at the USD amount you sent.'],
            ['Bridge', `${RULES.volumePointsPerUsd} per $1 (×${RULES.bridgeToArcMultiplier} when the destination is Arc)`, 'Cross-chain LI.FI routes. Bridging into Arc earns the multiplier.'],
            ['PayX payment sent', `${RULES.volumePointsPerUsd} per $1`, 'The gross amount (including the 1% platform fee).'],
            ['PayX payment claimed', `${RULES.volumePointsPerUsd} per $1`, 'Credited to the wallet that claims, so creators earn too. Claiming also links your X handle to your wallet on the leaderboard.'],
            ['Activity', `+${RULES.activityPointsPerTx} per transaction`, `Transactions of at least $${RULES.activityMinUsd}; at most ${RULES.activityMaxTxPerDay} per UTC day earn activity points.`],
            [
              'First-time bonuses',
              `+${RULES.firstTimeBonus.swap} / +${RULES.firstTimeBonus.bridge} / +${RULES.firstTimeBonus.tip_sent} / +${RULES.firstTimeBonus.tip_received}`,
              `First exchange, first bridge, first payment sent, first payment claimed of at least $${RULES.firstTimeBonusMinUsd}. Once per wallet.`,
            ],
            [boost.name, `×${boost.multiplier}`, `Applied to everything earned between ${fmtDate(boost.from)} and ${fmtDate(boost.to)} (UTC).`],
          ]}
        />
        <P className="mt-4 text-[14px]">
          For one action: <InlineCode>points = (volume × multiplier + activity + first-time bonus) × boost</InlineCode>. Events worth less than $
          {RULES.minEventUsd} are ignored.
        </P>
      </Section>

      <Section title="Tiers">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {TIERS.map((t) => (
            <Card key={t.name} className="p-4 text-center">
              <div className="text-[14px] font-semibold text-foreground">{t.name}</div>
              <div className="mt-1 font-mono text-[12px] text-ink-3">{t.min.toLocaleString('en-US')}+ pts</div>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Where the data comes from">
        <P className="mb-3">
          Points are not stored in a database you have to trust. They are recomputed from two public sources, and the whole ledger can be rebuilt
          from scratch at any time:
        </P>
        <Bullets
          items={[
            <>
              <span className="text-foreground">Exchanges and bridges</span>: LI.FI&apos;s transfer records for the <InlineCode>{LIFI.integrator}</InlineCode>{' '}
              integrator. Every route executed through the XyloNet card carries that tag, on every chain, with a USD value at execution time. Only
              completed transfers count.
            </>,
            <>
              <span className="text-foreground">PayX</span>: the <InlineCode>TipSent</InlineCode> and <InlineCode>TipsClaimed</InlineCode> events of the PayX
              contract on Arc (<AddressLink address={CONTRACTS.PAYX} href={explorerAddressUrl(CONTRACTS.PAYX)} />), read from block{' '}
              {process.env.NEXT_PUBLIC_PAYX_DEPLOYMENT_BLOCK ?? '20936229'} onward. USDC is valued at $1.
            </>,
          ]}
        />
        <P className="mt-3">
          The season started on <span className="text-foreground">{fmtDate(SEASON.startsAt)}</span> (mainnet go-live), so everything you did since launch is
          already counted. Points refresh about once a minute. Bridges that take a while to settle appear once LI.FI marks them complete.
        </P>
        <P className="mt-3">XyloNet&apos;s own operational wallets (deployer, oracle, Safes, LI.FI fee contracts) are excluded from the leaderboard.</P>
      </Section>

      <Section title="Public API">
        <div className="grid gap-2">
          {[
            ['GET /api/points/leaderboard?limit=100&offset=0&wallet=0x…', "Ranked wallets, season totals and (optionally) the given wallet's row."],
            ['GET /api/points/wallet/0x…', 'One wallet: points, rank, tier progress, breakdown and recent scored activity.'],
            ['GET /api/points/rules', 'The published rules for the current season.'],
          ].map(([sig, desc]) => (
            <Card key={sig} className="p-4">
              <code className="break-all font-mono text-[13px] text-foreground">{sig}</code>
              <p className="mt-1 text-[14px] text-ink-2">{desc}</p>
            </Card>
          ))}
        </div>
        <Note>Rate limited per IP. Responses are never cached.</Note>
      </Section>

      <Section title="Fine print">
        <P className="text-[14px]">
          Points have no monetary value and are not a promise of any token, airdrop or reward. Rules are versioned; a rule change re-scores every
          wallet from the same underlying data so nobody is treated differently by when they acted. Wallets that game the programme (wash trading,
          self-payment loops, dust spam) may be excluded in a future rules version.
        </P>
      </Section>
    </div>
  )
}
