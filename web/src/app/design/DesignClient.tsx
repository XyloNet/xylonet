'use client'

import { useState } from 'react'
import { ArrowLeftRight, Inbox, Send, Waypoints } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Amount } from '@/components/xylo/Amount'
import { Address } from '@/components/xylo/Address'
import { SettledStamp } from '@/components/xylo/Stamp'
import { StatusPill } from '@/components/xylo/StatusPill'
import { Stepper, type Step } from '@/components/xylo/Stepper'
import { TrustPanel } from '@/components/xylo/TrustPanel'
import { PageHeader } from '@/components/xylo/PageHeader'
import { EmptyState } from '@/components/xylo/EmptyState'
import { Seam } from '@/components/xylo/Seam'
import { Identity } from '@/components/xylo/Identity'
import { Mark } from '@/components/shell/Logo'

const TOKENS = [
  ['background', 'Ground'], ['card', 'Surface'], ['surface-2', 'Surface 2'], ['foreground', 'Ink'], ['ink-2', 'Ink 2'], ['ink-3', 'Ink 3'],
  ['signal', 'Mint'], ['mint-deep', 'Mint deep'], ['teal', 'Teal'], ['ocean', 'Ocean'], ['warn', 'Warning'], ['bad', 'Danger'], ['info', 'Info'],
]

const STEPS: Step[] = [
  { id: 'a', label: 'Approve USDC on Base', state: 'done', txHash: '0x8a2e0f3c9b1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d41c0', meta: '3 s' },
  { id: 'b', label: 'Burn 250.00 USDC on Base', state: 'done', txHash: '0x19f7a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1ab3d2', meta: '11 s' },
  { id: 'c', label: 'Circle attestation · Fast', state: 'active', meta: '18 s' },
  { id: 'd', label: 'Mint on Arc', state: 'pending', meta: 'Instant' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-3">{title}</h2>
      {children}
    </section>
  )
}

export function DesignClient() {
  const [on, setOn] = useState(true)
  const [stampKey, setStampKey] = useState(0)
  return (
    <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-5">
      <PageHeader
        eyebrow="Internal · design system v2"
        title="Every token and component, in every state."
        description="Light-first, one accent, numbers first. Toggle the theme from the header to check both."
        actions={<Mark className="h-8 text-signal" />}
      />

      <Section title="Colour">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
          {TOKENS.map(([t, label]) => (
            <div key={t} className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="h-12" style={{ background: `var(--${t})` }} />
              <div className="px-2.5 py-1.5 text-[12px]">
                <div className="font-semibold">{label}</div>
                <div className="font-mono text-ink-3">--{t}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type">
        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <div className="type-display text-[clamp(40px,6vw,64px)]">Make money feel <em className="text-signal-deep">instant.</em></div>
          <p className="mt-3 max-w-[64ch] text-ink-2">Interface in Instrument Sans at 15 px. Headings balance-wrapped, paragraphs pretty-wrapped. Sentence case everywhere, including buttons.</p>
          <p className="mt-2 font-mono text-[14px]">250.00 USDC → 229.70 EURC · fee $0.004 · 0x47d4…af0a · settled in 0.41 s</p>
          <div className="type-eyebrow mt-4">Eyebrow · mono uppercase</div>
        </div>
      </Section>

      <Section title="Amounts">
        <div className="flex flex-wrap items-end gap-8 rounded-xl border border-border bg-card p-6">
          <Amount value={1240} currency="USDC" size="hero" dollar />
          <Amount value={229.7} currency="EURC" size="xl" />
          <Amount value={25} currency="USDC" size="lg" />
          <Amount value={5} signed currency="USDC" size="md" />
          <Amount value={-250} signed currency="USDC" size="md" />
          <Amount value={0.004} dollar size="sm" format={{ min: 3, max: 4 }} />
          <Amount value={null} size="md" />
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="lg">Pay 25.00 USDC</Button>
          <Button size="lg" variant="outline">Bring dollars to Arc</Button>
          <Button size="lg" variant="secondary">Secondary</Button>
          <Button size="lg" variant="ghost">Cancel</Button>
          <Button size="lg" variant="destructive">Sign out</Button>
          <Button size="lg" disabled>Disabled</Button>
          <Button size="default">Default</Button>
          <Button size="sm">Small</Button>
          <Button size="icon-lg" aria-label="Exchange"><ArrowLeftRight /></Button>
          <Button size="lg" onClick={() => toast.success('Tip sent', { description: '25.00 USDC to @samconnerone · settled in 0.41 s' })}>Toast</Button>
          <Button size="lg" variant="outline" onClick={() => toast.error('Could not reach Arc', { description: 'The RPC did not answer in time. Try again.' })}>Error toast</Button>
        </div>
      </Section>

      <Section title="Fields">
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="d-amount">Amount</Label>
            <Input id="d-amount" defaultValue="25.00" className="h-11 font-mono text-[16px]" inputMode="decimal" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="d-handle">To</Label>
            <Input id="d-handle" defaultValue="@samconnerone" className="h-11" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="d-err">With an error</Label>
            <Input id="d-err" defaultValue="0.05" aria-invalid className="h-11 font-mono" />
            <p className="text-[12.5px] text-bad">Minimum tip is 0.10 USDC.</p>
          </div>
          <div className="flex items-center gap-3 self-end">
            <Switch id="d-sw" checked={on} onCheckedChange={setOn} />
            <Label htmlFor="d-sw">Notify me when a tip lands</Label>
          </div>
        </div>
      </Section>

      <Section title="Status">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone="ok">Settled</StatusPill>
          <StatusPill tone="info" pulse>Attesting · 18 s</StatusPill>
          <StatusPill tone="warn">Paused by guardian</StatusPill>
          <StatusPill tone="bad">Failed</StatusPill>
          <StatusPill tone="neutral">Arc · 5042</StatusPill>
          <StatusPill tone="signal" dot={false}>Instant</StatusPill>
          <Badge>Badge</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <span key={stampKey}><SettledStamp ms={410} /></span>
          <Button size="sm" variant="ghost" onClick={() => setStampKey((k) => k + 1)}>Replay stamp</Button>
        </div>
      </Section>

      <Section title="Identity and addresses">
        <div className="flex flex-wrap items-center gap-6 rounded-xl border border-border bg-card p-5">
          <Identity handle="samconnerone" address="0x47d4164F2f65afc00c7ba932cbEC9858b5FDAf0A" size="lg" />
          <Identity address="0xBBAFfA47bB6cD34f0fB91Ed55C1b31e09B7c896a" />
          <Address value="0x47d4164F2f65afc00c7ba932cbEC9858b5FDAf0A" label="Contract" />
          <Address value="0x19f7a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1ab3d2" kind="tx" label="Tx" />
        </div>
      </Section>

      <Section title="Stepper and trust panel">
        <div className="grid gap-4 md:grid-cols-2">
          <Stepper steps={STEPS} />
          <TrustPanel
            rows={[
              { label: 'You send', value: '25.00 USDC' },
              { label: '@samconnerone receives', value: '24.75 USDC', strong: true },
              { label: 'XyloNet fee · 1%', value: '0.25 USDC' },
              { label: 'Network', value: '$0.004' },
              { label: 'Settlement', value: <span className="text-signal-deep">Instant</span> },
            ]}
            note="Held by the PayX contract (owned by a 2-of-3 Safe) until claimed. XyloNet never holds your funds."
          />
        </div>
      </Section>

      <Section title="Overlays">
        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger render={<Button variant="outline" size="lg" />}>Dialog</DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Link this wallet permanently?</DialogTitle>
                <DialogDescription>Your first claim links @samconnerone to this wallet. Future USDC claims pay out here and only here.</DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button variant="ghost">Cancel</Button>
                <Button>Link and claim</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Sheet>
            <SheetTrigger render={<Button variant="outline" size="lg" />}>Sheet</SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetHeader>
                <SheetTitle>Choose a chain</SheetTitle>
                <SheetDescription>Balances shown for the connected wallet.</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
          <Tooltip>
            <TooltipTrigger render={<Button variant="outline" size="lg" />}>Tooltip</TooltipTrigger>
            <TooltipContent>Fees are quoted in USDC before you sign.</TooltipContent>
          </Tooltip>
        </div>
      </Section>

      <Section title="Tabs and table">
        <Tabs defaultValue="claim" className="max-w-2xl">
          <TabsList>
            <TabsTrigger value="claim">Claim</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="share">Share</TabsTrigger>
          </TabsList>
          <TabsContent value="claim" className="pt-3 text-ink-2">Pending balance and one button.</TabsContent>
          <TabsContent value="history" className="pt-3">
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Wallet</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ['1', '0x7fb7…be0a', 'Platinum', '61,702'],
                    ['2', '@likhon_younus', 'Platinum', '15,624'],
                    ['3', '0xcb78…edc1', 'Platinum', '15,610'],
                  ].map((r) => (
                    <TableRow key={r[0]}>
                      <TableCell className="font-mono text-ink-3">{r[0]}</TableCell>
                      <TableCell className="font-mono">{r[1]}</TableCell>
                      <TableCell><StatusPill tone="neutral" dot={false}>{r[2]}</StatusPill></TableCell>
                      <TableCell className="text-right font-mono" data-numeric>{r[3]}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          <TabsContent value="share" className="pt-3 text-ink-2">Link, QR and embed.</TabsContent>
        </Tabs>
      </Section>

      <Section title="States">
        <div className="grid gap-4 md:grid-cols-2">
          <EmptyState icon={Inbox} title="No activity yet" description="Your swaps, bridges and tips will appear here the moment they settle." action={<div className="flex gap-2"><Button size="sm"><Send data-icon="inline-start" />Pay</Button><Button size="sm" variant="outline"><Waypoints data-icon="inline-start" />Bridge</Button></div>} />
          <div className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-9 w-48" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-3/4" />
          </div>
        </div>
      </Section>

      <Seam />
      <p className="text-center text-[13px] text-ink-3">The seam: the only decorative device.</p>
    </div>
  )
}
