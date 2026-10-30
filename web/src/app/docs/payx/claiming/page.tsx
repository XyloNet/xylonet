import type { Metadata } from 'next'
import { KeyRound } from 'lucide-react'
import { ARC_CHAIN_ID } from '@/config/wagmi'
import { A, Callout, Card, Code, DocTitle, FaqList, H3, InlineCode, Note, P, Section, Steps } from '../../_components/Doc'

export const metadata: Metadata = {
  title: 'Claiming — Docs',
  description: 'Verify your X account and claim your PayX balance to any wallet on Arc: X OAuth, oracle EIP-712 signatures and wallet linking.',
}

function XMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

export default function ClaimingPage() {
  return (
    <div>
      <DocTitle title="Claiming" lede="Verify your X account and claim your balance to any wallet on Arc." />

      <Section title="How claiming works" className="mt-0">
        <Card>
          <P className="mb-4">
            Payments stay in escrow until you prove you own the handle. Each supported asset has its own PayX contract, so the creator hub shows one
            balance and one Claim button per asset (one transaction each). The claim combines:
          </P>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-surface-2 p-4">
              <div className="mb-2 flex items-center gap-2">
                <XMark className="size-5 text-foreground" />
                <span className="font-semibold text-foreground">X OAuth (PKCE)</span>
              </div>
              <P className="text-[14px]">Sign in with X to prove you control the handle.</P>
            </div>
            <div className="rounded-lg bg-surface-2 p-4">
              <div className="mb-2 flex items-center gap-2">
                <KeyRound className="size-5 text-signal-deep" />
                <span className="font-semibold text-foreground">Oracle EIP-712 signature</span>
              </div>
              <P className="text-[14px]">Our server authorizes handle to wallet; the contract verifies it.</P>
            </div>
          </div>
        </Card>
      </Section>

      <Section title="Claim process">
        <Steps
          items={[
            {
              title: 'Visit the creator hub',
              body: (
                <>
                  Go to <A href="/pay/creator">/pay/creator</A>.
                </>
              ),
              note: 'Sign in first; your pending balance is read from the contract for the verified handle.',
            },
            {
              title: 'Sign in with X',
              body: 'Click "Sign in with X" and approve read-only access to your profile.',
              note: 'We never request posting permissions. Your verified username is kept in an encrypted, HttpOnly cookie.',
            },
            {
              title: 'See your pending balances',
              body: 'Pending, lifetime received and claimed totals per asset, straight from each instance’s getHandleInfo().',
              note: 'Amounts are already net of the 1% platform fee.',
            },
            {
              title: 'Connect a wallet on Arc and claim',
              body: `Connect the wallet you want paid; if it is on another network we ask it to switch to Arc (chain ${ARC_CHAIN_ID}). Click Claim on the asset you want and confirm.`,
              note: 'The whole pending balance of that asset is paid out in one transaction. Each asset is claimed separately.',
            },
          ]}
        />
      </Section>

      <Section title="Wallet linking">
        <Card>
          <P className="mb-3">
            Your first successful claim links that wallet to your handle onchain (<InlineCode>WalletLinked</InlineCode>). Linking is per contract: each
            asset&apos;s instance remembers its own linked wallet, so use the same wallet across assets if you want a single payout address. After that:
          </P>
          <div className="grid gap-3">
            <div>
              <H3>Every later claim must use the same wallet</H3>
              <P className="text-[14px]">
                A claim for a different wallet reverts with <InlineCode>WalletMismatch</InlineCode>, even with a valid oracle signature.
              </P>
            </div>
            <div>
              <H3>Recovery through governance</H3>
              <P className="text-[14px]">
                If you lose the wallet, contact <A href="https://x.com/Xylonet_">@Xylonet_</A>. After verification the Admin Safe (2-of-3) calls{' '}
                <InlineCode>adminRelinkWallet</InlineCode>, which redirects future claims and emits <InlineCode>WalletRelinked</InlineCode>. It never
                moves existing funds by itself.
              </P>
            </div>
          </div>
          <Callout tone="warn" className="mt-4">
            Choose your first claim wallet carefully. It should be one you control long-term.
          </Callout>
        </Card>
      </Section>

      <Section title="Technical details">
        <H3 className="mb-2">Claim transaction</H3>
        <Code>{`function claimTips(
    string calldata handle,    // your X handle (normalized onchain)
    address wallet,            // destination wallet
    bytes32 nonce,             // random, single-use
    bytes calldata signature   // oracle EIP-712 signature
) external nonReentrant whenNotPaused`}</Code>

        <H3 className="mb-2 mt-6">Signature verification (EIP-712)</H3>
        <P className="mb-3 text-[14px]">
          The contract rebuilds the typed-data digest and checks the recovered signer against <InlineCode>oracleSigner()</InlineCode>:
        </P>
        <Code>{`// domain: EIP712("PayX", "2") + chainId ${ARC_CHAIN_ID} + address(this)
bytes32 CLAIM_TYPEHASH = keccak256("Claim(string handle,address wallet,bytes32 nonce)");

bytes32 structHash = keccak256(
    abi.encode(CLAIM_TYPEHASH, keccak256(bytes(normalizedHandle)), wallet, nonce)
);
bytes32 digest = _hashTypedDataV4(structHash);
if (ECDSA.recover(digest, signature) != oracleSigner) revert InvalidSignature();
if (usedNonces[nonce]) revert NonceAlreadyUsed();`}</Code>
        <Note>Because the domain includes the chain id and the contract address, a signature is useless on any other chain or deployment.</Note>
      </Section>

      <Section title="Onchain events">
        <P className="mb-3">
          Successful claims emit <InlineCode>TipsClaimed</InlineCode> (and <InlineCode>WalletLinked</InlineCode> on the first claim):
        </P>
        <Code>{`event TipsClaimed(
    string indexed handleHash,
    string handle,
    address indexed wallet,
    uint256 amount,             // total claimed (token units of that instance)
    uint256 timestamp
);`}</Code>
      </Section>

      <Section title="Common questions">
        <FaqList
          items={[
            { q: 'How long do payments stay in escrow?', a: 'Indefinitely. There is no expiry and no admin function that can remove them.' },
            { q: 'Can I claim partial amounts?', a: 'No. Each claim withdraws your entire pending balance of that asset at once. Each asset is claimed separately.' },
            {
              q: 'What if I change my X handle?',
              a: 'Payments are indexed by the handle text, not your X user ID. Payments sent to your old handle stay under that handle and can be claimed by whoever can sign in as it. Announce a new handle before renaming.',
            },
            {
              q: 'Can someone else claim my balance?',
              a: 'Only someone who can sign in to X as your handle. The oracle signs only for the handle in a verified session, and the contract accepts only oracle signatures.',
            },
            {
              q: 'What does "PayX is paused" mean?',
              a: 'The guardian or owner halted payments and claims temporarily (for example during an incident). Escrow is untouched; claims resume when the owner unpauses.',
            },
          ]}
        />
      </Section>
    </div>
  )
}
