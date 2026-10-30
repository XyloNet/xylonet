import { Amount } from '@/components/xylo/Amount'
import { TrustPanel } from '@/components/xylo/TrustPanel'

/** A worked example of a receipt, marked as such. Static, so the hero paints with the HTML. */
export function ExampleReceipt() {
  return (
    <div className="w-full max-w-[400px] overflow-hidden rounded-2xl border border-border bg-card shadow-card" aria-label="Example receipt">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <span className="type-eyebrow">Receipt · example</span>
        <span className="inline-flex -rotate-2 items-center gap-1.5 rounded-md border-[1.5px] border-signal-deep px-2.5 py-1 text-[12px] font-bold uppercase tracking-[0.06em] text-signal-deep">
          Settled <span className="font-mono font-medium normal-case tracking-normal">0.41 s</span>
        </span>
      </div>
      <div className="px-5 py-5">
        <Amount value={25} size="hero" dollar currency="USDC" />
        <div className="mt-1 text-[14px] text-ink-2">
          to <span className="font-medium text-foreground">@samconnerone</span>
        </div>
        <p className="mt-3 border-l-2 border-signal pl-3 text-[14px] italic text-ink-2">“Thanks for the thread.”</p>
        <div className="mt-4">
          <TrustPanel
            rows={[
              { label: '@samconnerone receives', value: '24.75 USDC', strong: true },
              { label: 'XyloNet fee · 1%', value: '0.25 USDC' },
              { label: 'Network', value: '$0.004' },
              { label: 'Signatures', value: '1' },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
