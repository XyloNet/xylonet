import type { Metadata } from 'next'
import { KeyRound, Pause, ShieldCheck } from 'lucide-react'
import { CONTRACTS } from '@/config/constants'
import { ARC_CHAIN_ID, explorerAddressUrl } from '@/config/wagmi'
import { CircleMark } from '@/components/ui/TokenLogos'
import { A, AddressLink, Callout, Card, Cta, DocTitle, H3, Numbered, P, Section, Steps } from '../../_components/Doc'

export const metadata: Metadata = {
  title: 'PayX security — Docs',
  description: 'How PayXTipping v2 protects funds in escrow, who can do what, claim security, dependencies and risks.',
}

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

const hardening = [
  {
    t: 'EIP-712 oracle claims',
    d: `Claims are authorized by a typed signature Claim(string handle, address wallet, bytes32 nonce) under domain {name: "PayX", version: "2", chainId: ${ARC_CHAIN_ID}, verifyingContract}. A signature cannot be replayed on another chain or another deployment. Each nonce is single-use.`,
  },
  {
    t: 'Pausable with a guardian',
    d: 'tip() and claimTips() can be halted by the guardian or the owner. The guardian role can only pause; it cannot unpause, change parameters, or touch funds. Unpausing requires the owner (the Safe).',
  },
  {
    t: 'Ownable2Step, owned by the Admin Safe (2-of-3)',
    d: `Ownership is held by the XyloNet Admin Safe (${short(CONTRACTS.ADMIN_SAFE)}). Any admin action needs two of three signers, and ownership transfers must be explicitly accepted by the new owner.`,
  },
  {
    t: 'Fees go to the Treasury Safe',
    d: `The 1% platform fee accrues separately from escrow and can only be withdrawn to the fee recipient, the Treasury Safe (${short(CONTRACTS.TREASURY_SAFE)}), by the owner or the recipient itself.`,
  },
  {
    t: 'Escrow accounting the owner cannot bypass',
    d: "The contract tracks totalPending (sum of every handle's unclaimed balance). sweepExcessUSDC can only move USDC above totalPending + totalFeesCollected, and rescueToken refuses USDC entirely. There is no function that reduces a handle's pending balance except its own claim.",
  },
  {
    t: 'adminRelinkWallet recovery',
    d: 'If a creator loses the wallet they first claimed with, the owner (2-of-3) can relink the handle to a new wallet. This only redirects future claims and emits WalletRelinked; it never moves existing funds by itself.',
  },
  {
    t: 'Reentrancy guard, SafeERC20, 280-byte messages, input validation',
    d: 'OpenZeppelin ReentrancyGuard on tip/claim/withdraw, SafeERC20 for every transfer, handle normalization onchain, custom errors for every rejection.',
  },
]

export default function PayXSecurityPage() {
  return (
    <div>
      <DocTitle title="Security" lede="How PayXTipping v2 protects funds in escrow, who can do what, and what to watch for." />

      <Section title="Security model at a glance" className="mt-0">
        <P className="mb-4">
          Funds are held by the contract, not by XyloNet. There is deliberately <strong className="text-foreground">no owner or admin path that can move user escrow</strong>.
          The only way funds leave escrow is a valid claim for that handle.
        </P>
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <KeyRound className="mb-3 size-5 text-signal-deep" aria-hidden />
            <H3 className="mb-1">EIP-712 claims</H3>
            <P className="text-[14px]">Bound to chain {ARC_CHAIN_ID} and this contract.</P>
          </Card>
          <Card>
            <ShieldCheck className="mb-3 size-5 text-signal-deep" aria-hidden />
            <H3 className="mb-1">2-of-3 Safe owner</H3>
            <P className="text-[14px]">No single key controls the contract.</P>
          </Card>
          <Card>
            <Pause className="mb-3 size-5 text-signal-deep" aria-hidden />
            <H3 className="mb-1">Pausable</H3>
            <P className="text-[14px]">Guardian can freeze, never move funds.</P>
          </Card>
        </div>
      </Section>

      <Section title="Smart contract hardening (v2)">
        <Card>
          <ul className="grid gap-4">
            {hardening.map((item) => (
              <li key={item.t}>
                <H3>{item.t}</H3>
                <P className="mt-1 text-[14px]">{item.d}</P>
              </li>
            ))}
          </ul>
        </Card>
      </Section>

      <Section title="Who can do what">
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-surface-2">
              <tr>
                {['Role', 'Can', 'Cannot'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[12px] font-medium uppercase tracking-[0.06em] text-ink-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              <tr className="align-top">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">Owner</div>
                  <A href={explorerAddressUrl(CONTRACTS.ADMIN_SAFE)} className="font-mono text-[12px]">
                    Admin Safe 2-of-3
                  </A>
                </td>
                <td className="px-4 py-3 text-ink-2">Set oracle, guardian, fee (≤5%), min amount, fee recipient; pause/unpause; relink a handle&apos;s wallet; sweep excess; rescue non-USDC tokens; withdraw fees</td>
                <td className="px-4 py-3 text-bad">Move or reduce any handle&apos;s pending balance; claim on a user&apos;s behalf; withdraw fees anywhere but the Treasury Safe</td>
              </tr>
              <tr className="align-top">
                <td className="px-4 py-3 font-medium text-foreground">Guardian</td>
                <td className="px-4 py-3 text-ink-2">Pause payments and claims</td>
                <td className="px-4 py-3 text-bad">Unpause; change any setting; move any funds</td>
              </tr>
              <tr className="align-top">
                <td className="px-4 py-3 font-medium text-foreground">Oracle signer</td>
                <td className="px-4 py-3 text-ink-2">Sign claim authorizations for a handle-to-wallet pair after X OAuth</td>
                <td className="px-4 py-3 text-bad">Move funds; sign for a wallet without a valid X session; replay a signature elsewhere</td>
              </tr>
              <tr className="align-top">
                <td className="px-4 py-3 font-medium text-foreground">Anyone</td>
                <td className="px-4 py-3 text-ink-2">Pay any handle; read every balance and event</td>
                <td className="px-4 py-3 text-bad">Claim without an oracle signature</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Claim security">
        <Steps
          items={[
            { title: 'X OAuth (PKCE)', body: 'You sign in with X. We only request read access to your public profile. The verified username is stored in an encrypted, HttpOnly session cookie, never in the URL.' },
            { title: 'Oracle EIP-712 signature', body: 'Our server signs Claim(handle, wallet, nonce) for the handle in your session and the wallet you connected. Signing is rate-limited and the key never leaves the server.' },
            { title: 'Onchain verification', body: 'The contract recovers the signer, checks it against oracleSigner(), burns the nonce, and pays the full pending balance to the wallet.' },
            { title: 'Wallet binding', body: 'Your first claim links the wallet to your handle. Later claims must use the same wallet (WalletMismatch otherwise). Recovery is via adminRelinkWallet through the 2-of-3 Safe.' },
          ]}
        />
      </Section>

      <Section title="Dependencies">
        <div className="grid gap-3">
          <Card>
            <div className="mb-2 flex items-center gap-3">
              <CircleMark size={24} />
              <H3>Circle USDC on Arc</H3>
            </div>
            <P className="mb-2 text-[14px]">
              The USDC instance escrows Arc&apos;s native USDC through its 6-decimal ERC-20 interface and holds no other asset. Any additional supported
              asset gets a separate deployment of the same code that escrows only that token. Each instance holds exactly one token.
            </P>
            <A href="https://www.circle.com/en/usdc" className="text-[14px]">
              Learn more about USDC
            </A>
          </Card>
          <Card>
            <div className="mb-2 flex items-center gap-3">
              <span className="flex size-6 items-center justify-center rounded-sm bg-surface-2 font-mono text-[11px] font-semibold text-foreground">OZ</span>
              <H3>OpenZeppelin Contracts</H3>
            </div>
            <P className="mb-2 text-[14px]">ReentrancyGuard, SafeERC20, Ownable2Step, Pausable, EIP712 and ECDSA: audited, widely deployed building blocks.</P>
            <A href="https://docs.openzeppelin.com/contracts" className="text-[14px]">
              OpenZeppelin documentation
            </A>
          </Card>
        </div>
      </Section>

      <Section title="Risk considerations">
        <div className="grid gap-3">
          <Callout tone="warn" title="Smart contract risk">
            v2 was reviewed line by line and tested against a local fork, but no contract is risk-free. Send amounts you are comfortable with.
          </Callout>
          <Callout tone="warn" title="Oracle availability">
            Claims need a signature from our oracle. If the service is down, funds stay safely in escrow until it is back; they cannot be lost or
            redirected.
          </Callout>
          <Callout tone="warn" title="Handle ownership">
            Payments are indexed by the handle text. Whoever controls that X username at claim time can claim them. Double-check the handle before
            paying.
          </Callout>
        </div>
      </Section>

      <Section title="Best practices">
        <Card>
          <Numbered
            items={[
              'Verify the contract address on this site before interacting from a wallet or script.',
              'Approve only the exact payment amount (the web Pay page does this by default).',
              'Claim to a wallet you control long-term; it becomes your linked wallet.',
              'Review transaction details in your wallet before signing.',
              'Bookmark xylonet.xyz/pay; never sign PayX claims from another domain.',
            ]}
          />
        </Card>
      </Section>

      <Cta
        title="Report a vulnerability"
        description="If you discover a security issue, contact us privately first. Please do not disclose publicly before we have had a chance to respond."
        primary={{ href: 'mailto:forgelabs@xylonet.xyz', label: 'Email forgelabs@xylonet.xyz' }}
        secondary={{ href: 'https://x.com/Xylonet_', label: '@Xylonet_ on X' }}
      />
      <p className="mt-3 text-[13px] text-ink-3">
        <AddressLink address={CONTRACTS.ADMIN_SAFE} href={explorerAddressUrl(CONTRACTS.ADMIN_SAFE)} className="text-ink-3" /> is the Admin Safe referenced above.
      </p>
    </div>
  )
}
