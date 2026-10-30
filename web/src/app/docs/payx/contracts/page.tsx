import type { Metadata } from 'next'
import { CONTRACTS, isPayXDeployed, payXAssetSymbolList } from '@/config/constants'
import { ARC_CHAIN_ID, ARC_EXPLORER_URL, ARC_PUBLIC_RPC_URL, explorerAddressUrl } from '@/config/wagmi'
import { ChainLogo, TokenLogo } from '@/components/ui/TokenLogos'
import { StatusPill } from '@/components/xylo/StatusPill'
import { A, AddressLink, Callout, Card, Code, DocTable, DocTitle, H3, InlineCode, Note, P, Section } from '../../_components/Doc'
import { OracleSigner } from './OracleSigner'

export const metadata: Metadata = {
  title: 'PayX smart contract — Docs',
  description: 'PayXTipping v2 on Arc mainnet: addresses, parameters, functions, events and how to integrate with viem.',
}

const functions = [
  { name: 'tip', params: '(handle, amount, message)', desc: "Send a payment. amount is in the instance's token units (USDC: 6 decimals, min 100000 = 0.1). Requires a prior approve of that token to the instance." },
  { name: 'claimTips', params: '(handle, wallet, nonce, signature)', desc: 'Claim the full pending balance with an oracle EIP-712 signature. First claim links the wallet.' },
  { name: 'getHandleInfo', params: '(handle)', desc: 'pendingBalance, linkedWallet, isRegistered, totalReceived, totalClaimed, tipCount' },
  { name: 'getPendingBalance', params: '(handle)', desc: 'Pending (unclaimed) balance for a handle' },
  { name: 'getTipHistory', params: '(handle, offset, limit)', desc: 'Paginated Tip[] {tipper, amount, timestamp, message}' },
  { name: 'getLinkedWallet', params: '(handle)', desc: 'Wallet the handle claims to (zero if never claimed)' },
  { name: 'platformFeeBps / minTipAmount / paused', params: '()', desc: 'Live protocol parameters' },
  { name: 'domainSeparator', params: '()', desc: 'EIP-712 domain separator for offchain signer verification' },
]

const events = [
  {
    name: 'TipSent',
    body: `event TipSent(
    string indexed handleHash,  // keccak256 of the normalized handle
    string handle,              // normalized lowercase handle
    address indexed tipper,
    uint256 amount,             // NET amount credited to the handle
    uint256 fee,                // platform fee taken
    string message,
    uint256 timestamp
);`,
  },
  {
    name: 'TipsClaimed',
    body: `event TipsClaimed(
    string indexed handleHash,
    string handle,
    address indexed wallet,
    uint256 amount,
    uint256 timestamp
);`,
  },
  {
    name: 'WalletLinked / WalletRelinked',
    body: `event WalletLinked(string indexed handleHash, string handle, address indexed wallet);
event WalletRelinked(string indexed handleHash, string handle, address indexed oldWallet, address indexed newWallet);`,
  },
  {
    name: 'Paused / Unpaused',
    body: `event Paused(address account);
event Unpaused(address account);`,
  },
]

export default function PayXContractsPage() {
  const deployed = isPayXDeployed()
  const payxAddress = deployed ? CONTRACTS.PAYX : '<PAYX_CONTRACT_ADDRESS>'

  return (
    <div>
      <DocTitle title="Smart contract" lede="PayXTipping v2 on Arc mainnet: addresses, parameters, events and how to integrate." />

      <Callout tone="info">
        PayX runs <strong className="text-foreground">one PayXTipping v2 instance per supported asset</strong> (currently {payXAssetSymbolList()}). Every
        instance shares the same source, ABI, oracle and fee, but each escrows exactly one token, keeps its own per-handle balances and linked wallets,
        and has its own EIP-712 domain, so claims are made per asset.
      </Callout>

      <Section title="Network information">
        <Card>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <ChainLogo chainId={ARC_CHAIN_ID} size={20} />
                <span className="font-semibold text-foreground">Arc mainnet</span>
              </div>
              <dl className="grid gap-2 text-[14px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-3">Chain ID</dt>
                  <dd className="font-mono text-foreground">{ARC_CHAIN_ID}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-3">RPC URL</dt>
                  <dd className="break-all text-right font-mono text-[12px] text-foreground">{ARC_PUBLIC_RPC_URL}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-3">Gas token</dt>
                  <dd className="font-mono text-foreground">USDC</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-3">Finality</dt>
                  <dd className="font-mono text-foreground">&lt;1s</dd>
                </div>
              </dl>
            </div>
            <div>
              <div className="mb-3 font-semibold text-foreground">Block explorer</div>
              <A href={ARC_EXPLORER_URL} className="break-all font-mono text-[14px]">
                {ARC_EXPLORER_URL.replace(/^https?:\/\//, '')}
              </A>
            </div>
          </div>
        </Card>
      </Section>

      <Section title="PayXTipping v2, USDC instance">
        <Card className="p-0">
          <div className="border-b border-border p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <H3>PayXTipping v2</H3>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {deployed ? <StatusPill tone="ok">Deployed</StatusPill> : <StatusPill tone="warn">Deploying at mainnet launch</StatusPill>}
                  <StatusPill tone="neutral" dot={false}>
                    Solidity 0.8.24
                  </StatusPill>
                </div>
              </div>
              {deployed ? (
                <AddressLink address={CONTRACTS.PAYX} href={explorerAddressUrl(CONTRACTS.PAYX)} />
              ) : (
                <span className="font-mono text-[13px] text-ink-3">address published after the ceremony</span>
              )}
            </div>
            <P className="mt-3 text-[14px]">
              Escrow payment contract: holds balances per handle, verifies EIP-712 claim authorizations, links wallets. One instance per asset (the
              escrow token is immutable).
            </P>
          </div>
          <div className="p-5">
            <div className="type-eyebrow mb-3">Key functions</div>
            <div className="grid gap-2">
              {functions.map((fn) => (
                <div key={fn.name} className="rounded-lg bg-surface-2 p-3">
                  <code className="font-mono text-[13px] text-foreground">
                    {fn.name}
                    <span className="text-ink-3">{fn.params}</span>
                  </code>
                  <p className="mt-1 text-[13px] text-ink-2">{fn.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </Section>

      <Section title="Contract configuration (USDC instance)">
        <DocTable
          head={['Parameter', 'Value']}
          rows={[
            [
              'USDC token',
              <>
                <AddressLink key="a" address={CONTRACTS.USDC} href={explorerAddressUrl(CONTRACTS.USDC)} /> <span className="text-[12px] text-ink-3">6 decimals</span>
              </>,
            ],
            ['Platform fee', <span key="v" className="font-mono">100 bps (1%) · max 500</span>],
            ['Minimum payment', <span key="v" className="font-mono">100000 (0.1 USDC)</span>],
            ['Max message', <span key="v" className="font-mono">280 bytes</span>],
            ['Oracle signer', <OracleSigner key="o" />],
            [
              'Owner',
              <>
                <AddressLink key="a" address={CONTRACTS.ADMIN_SAFE} href={explorerAddressUrl(CONTRACTS.ADMIN_SAFE)} />{' '}
                <span className="text-[12px] text-ink-3">Admin Safe, 2-of-3 (Ownable2Step)</span>
              </>,
            ],
            [
              'Fee recipient',
              <>
                <AddressLink key="a" address={CONTRACTS.TREASURY_SAFE} href={explorerAddressUrl(CONTRACTS.TREASURY_SAFE)} />{' '}
                <span className="text-[12px] text-ink-3">Treasury Safe</span>
              </>,
            ],
            ['EIP-712 domain', <span key="v" className="font-mono text-[12px]">name &quot;PayX&quot; · version &quot;2&quot; · chainId {ARC_CHAIN_ID} · verifyingContract</span>],
          ]}
        />
      </Section>

      <Section title="Payment assets on Arc">
        <Card>
          <div className="flex items-start gap-4">
            <TokenLogo symbol="USDC" size={40} />
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2">
                <H3>USDC</H3>
                <StatusPill tone="info" dot={false}>
                  Native gas
                </StatusPill>
              </div>
              <P className="mb-3 text-[14px]">
                Circle&apos;s USDC is Arc&apos;s native asset. Its ERC-20 interface lives at the system predeploy and uses 6 decimals; PayX amounts are always
                in those units.
              </P>
              <dl className="grid grid-cols-2 gap-3 text-[14px] md:grid-cols-4">
                <div>
                  <dt className="text-[12px] text-ink-3">Address</dt>
                  <dd>
                    <AddressLink address={CONTRACTS.USDC} href={explorerAddressUrl(CONTRACTS.USDC)} className="text-[12px]" />
                  </dd>
                </div>
                <div>
                  <dt className="text-[12px] text-ink-3">Decimals</dt>
                  <dd className="font-mono text-foreground">6</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-ink-3">Symbol</dt>
                  <dd className="text-foreground">USDC</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-ink-3">Get some</dt>
                  <dd>
                    <A href="/bridge">Bridge to Arc</A>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </Card>
      </Section>

      <Section title="Contract events">
        <div className="grid gap-3">
          {events.map((ev) => (
            <div key={ev.name}>
              <H3 className="mb-2">{ev.name}</H3>
              <Code>{ev.body}</Code>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Source and verification">
        <Card>
          <P className="mb-3 text-[14px]">
            The v2 source is verified on the Arc explorer as part of the deployment ceremony. Compare the onchain bytecode against the published source
            before interacting from your own code.
          </P>
          {deployed ? (
            <A href={`${explorerAddressUrl(CONTRACTS.PAYX)}#code`}>View verified source</A>
          ) : (
            <span className="text-[13px] text-ink-3">Explorer link appears here once the contract is deployed.</span>
          )}
        </Card>
      </Section>

      <Section title="Integration">
        <P className="mb-3">
          Read from PayX with viem. Define Arc as a custom chain (id {ARC_CHAIN_ID}) and point it at any Arc mainnet RPC:
        </P>
        <Code>{`import { createPublicClient, defineChain, formatUnits, http } from 'viem';

const arc = defineChain({
  id: ${ARC_CHAIN_ID},
  name: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['${ARC_PUBLIC_RPC_URL}'] } },
  blockExplorers: { default: { name: 'Arc Explorer', url: '${ARC_EXPLORER_URL}' } },
});

const client = createPublicClient({ chain: arc, transport: http() });

const info = await client.readContract({
  address: '${payxAddress}',
  abi: PayXTippingABI, // v2 ABI
  functionName: 'getHandleInfo',
  args: ['username'],
});

console.log(formatUnits(info.pendingBalance, 6), 'USDC pending');`}</Code>
        <Note>
          Handles are normalized onchain (lowercase, a–z 0–9 _, 1–15 chars); pass them without the <InlineCode>@</InlineCode>.
        </Note>
      </Section>
    </div>
  )
}
