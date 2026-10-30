import type { Metadata } from 'next'
import { CONTRACTS, PAYX_ASSETS, PAYX_ASSET_KEYS, isPayXAssetLive, isPayXDeployed, payXAssetSymbolList } from '@/config/constants'
import { explorerAddressUrl } from '@/config/wagmi'
import { TokenLogo } from '@/components/ui/TokenLogos'
import { StatusPill } from '@/components/xylo/StatusPill'
import { A, Bullets, Card, Code, DocTitle, H3, InlineCode, Note, Numbered, P, Section, Steps } from '../../_components/Doc'

export const metadata: Metadata = {
  title: 'How paying works — Docs',
  description: 'The complete PayX flow: approve, pay, escrow under the handle, and the creator claiming. Assets, fees, messages and onchain events.',
}

export default function TippingPage() {
  const deployed = isPayXDeployed()
  return (
    <div>
      <DocTitle title="How paying works" lede="The complete flow, from sending a payment to the creator claiming it." />

      <Section title="Overview" className="mt-0">
        <Card>
          <P className="mb-3">
            PayX is an <strong className="text-foreground">escrow-based payment system</strong>. You can pay in {payXAssetSymbolList('or')}; each supported
            asset has its own PayX contract and its own claims. When you pay a handle:
          </P>
          <Numbered
            items={[
              'You approve exactly the payment amount of the chosen token for that asset’s PayX contract (one wallet prompt).',
              <>
                <InlineCode>tip(handle, amount, message)</InlineCode> moves the tokens into the contract; 1% is set aside as the platform fee.
              </>,
              <>
                The net amount is credited to the normalized (lowercase) handle and a <InlineCode>TipSent</InlineCode> event is emitted.
              </>,
              'The creator signs in with X and claims the whole balance to their wallet.',
            ]}
          />
        </Card>
      </Section>

      <Section title="Payment flow">
        <Steps
          items={[
            { title: 'Enter a handle', body: 'On the web Pay page (or the extension).' },
            { title: 'Approve and pay', body: 'Two wallet prompts the first time, one afterwards.' },
            { title: 'USDC escrowed', body: 'Credited to the handle in under a second.' },
            { title: 'Recorded onchain', body: 'TipSent event with amount, fee and message.' },
          ]}
        />
      </Section>

      <Section title="Payment assets">
        <div className="grid gap-3 md:grid-cols-2">
          {PAYX_ASSET_KEYS.map((key) => {
            const a = PAYX_ASSETS[key]
            const live = isPayXAssetLive(key)
            return (
              <Card key={key}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <TokenLogo symbol={a.token.symbol} size={32} />
                    <div>
                      <div className="font-semibold text-foreground">{a.token.symbol}</div>
                      <div className="text-[12px] text-ink-3">
                        {a.token.name} · {a.token.decimals} decimals
                      </div>
                    </div>
                  </div>
                  {live ? <StatusPill tone="ok">Live</StatusPill> : <StatusPill tone="warn">Not yet deployed</StatusPill>}
                </div>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {a.quickPicks.map((pick) => (
                    <span key={pick} className="rounded-sm bg-signal-tint px-2.5 py-1 font-mono text-[13px] font-semibold text-signal-deep">
                      {a.currencyPrefix}
                      {Number(pick).toLocaleString('en-US')}
                    </span>
                  ))}
                </div>
                <P className="text-[14px]">
                  Min {a.minTipHuman} {a.token.symbol} · fee 1% · max: your {a.token.symbol} balance. Escrowed by its own PayX contract
                  {live ? (
                    <>
                      {' '}
                      (<A href={explorerAddressUrl(a.contract)}>explorer</A>)
                    </>
                  ) : (
                    <> (address published once deployed)</>
                  )}
                  .
                </P>
              </Card>
            )
          })}
        </div>
        <Note>Each asset has its own escrow contract, its own per-handle balances and its own claims. Payments in different assets never mix.</Note>
      </Section>

      <Section title="Fees">
        <div className="grid gap-3">
          <Card>
            <div className="mb-2 flex items-center justify-between gap-4">
              <div>
                <H3>Platform fee</H3>
                <div className="text-[14px] text-ink-2">Taken from each payment, sent to the XyloNet Treasury Safe</div>
              </div>
              <div className="font-mono text-[22px] font-semibold text-foreground">1%</div>
            </div>
            <P className="text-[14px]">Example: on a $10 USDC payment, $0.10 is the fee and $9.90 is credited to the creator. The fee is capped at 5% in the contract.</P>
          </Card>
          <Card>
            <div className="mb-2 flex items-center justify-between gap-4">
              <div>
                <H3>Gas</H3>
                <div className="text-[14px] text-ink-2">Arc network cost, paid in USDC</div>
              </div>
              <div className="font-mono text-[22px] font-semibold text-foreground">~$0.01</div>
            </div>
            <P className="text-[14px]">No separate gas token needed; USDC is native on Arc.</P>
          </Card>
        </div>
      </Section>

      <Section title="Messages">
        <Card>
          <P className="mb-3">Add an optional message of up to 280 bytes. It is stored onchain with the payment and shown to the creator in their hub.</P>
          <div className="rounded-lg bg-surface-2 p-4">
            <p className="text-[14px] text-foreground">&quot;Great thread! Really helped me understand the concept.&quot;</p>
            <p className="mt-1 text-[12px] text-ink-3">Example message</p>
          </div>
        </Card>
      </Section>

      <Section title="Onchain events">
        <P className="mb-3">
          Every payment emits a <InlineCode>TipSent</InlineCode> event:
        </P>
        <Code>{`event TipSent(
    string indexed handleHash,  // keccak256 of the normalized handle
    string handle,              // "username" (lowercase, no @)
    address indexed tipper,     // sender wallet
    uint256 amount,             // NET amount credited (units of the instance's escrow token, e.g. USDC 6dp)
    uint256 fee,                // platform fee (same units)
    string message,             // optional message
    uint256 timestamp           // block timestamp
);`}</Code>
        <Note>
          {deployed ? (
            <>
              All USDC payments are queryable on the <A href={explorerAddressUrl(CONTRACTS.PAYX)}>Arc explorer</A>; each additional asset&apos;s instance emits
              the same event.
            </>
          ) : (
            <>All payments will be queryable on the Arc explorer once the contract is deployed.</>
          )}
        </Note>
      </Section>

      <Section title="Best practices">
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <H3 className="mb-2">Do</H3>
            <Bullets
              className="text-[14px]"
              items={[
                'Double-check the handle; payments go to whoever owns that username.',
                'Include a message to make it personal.',
                <>
                  Share your <InlineCode>xylonet.xyz/to/handle</InlineCode> link so others can pay you too.
                </>,
              ]}
            />
          </Card>
          <Card>
            <H3 className="mb-2">Don&apos;t</H3>
            <Bullets
              className="text-[14px]"
              items={['Pay impersonator accounts.', 'Put sensitive information in messages (they are public and permanent).', 'Approve more than the amount you are sending.']}
            />
          </Card>
        </div>
      </Section>
    </div>
  )
}
