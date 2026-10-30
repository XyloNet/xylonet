import type { Metadata } from 'next'
import { ARC_NETWORK, CONTRACTS, PAYX_ASSETS, PAYX_ASSET_KEYS, isPayXAssetLive } from '@/config/constants'
import { explorerAddressUrl } from '@/config/wagmi'
import { StatusPill } from '@/components/xylo/StatusPill'
import { A, AddressLink, Callout, DocTitle, P, Section } from '../_components/Doc'

export const metadata: Metadata = {
  title: 'Smart contracts — Docs',
  description: 'Every address XyloNet interacts with on Arc mainnet (chain 5042): Circle stablecoins, CCTP v2, Gateway, LI.FI and PayX.',
}

type Row = { name: string; address?: `0x${string}`; note: string; pending?: string }
type Group = { title: string; blurb: string; rows: Row[] }

const groups: Group[] = [
  {
    title: 'Stablecoins (Circle)',
    blurb: 'Circle-issued tokens native to Arc.',
    rows: [
      { name: 'USDC', address: CONTRACTS.USDC, note: 'ERC-20 interface of the gas token (6 decimals)' },
      { name: 'EURC', address: CONTRACTS.EURC, note: 'Euro Coin (6 decimals)' },
    ],
  },
  {
    title: 'CCTP v2 (Arc domain 26)',
    blurb: 'Circle Cross-Chain Transfer Protocol: burn on source, mint on destination.',
    rows: [
      { name: 'TokenMessengerV2', address: CONTRACTS.TOKEN_MESSENGER_V2, note: 'depositForBurn entry point' },
      { name: 'MessageTransmitterV2', address: CONTRACTS.MESSAGE_TRANSMITTER_V2, note: 'receiveMessage / attestation verification' },
      { name: 'TokenMinterV2', address: CONTRACTS.TOKEN_MINTER_V2, note: 'mints USDC on Arc after attestation' },
    ],
  },
  {
    title: 'Circle Gateway',
    blurb: 'Unified USDC balance across chains.',
    rows: [
      { name: 'GatewayWallet', address: CONTRACTS.GATEWAY_WALLET, note: 'deposit / unified balance' },
      { name: 'GatewayMinter', address: CONTRACTS.GATEWAY_MINTER, note: 'mints against Gateway balance' },
    ],
  },
  {
    title: 'Common infrastructure',
    blurb: 'Standard contracts deployed at their canonical addresses.',
    rows: [
      { name: 'Permit2', address: CONTRACTS.PERMIT2, note: 'signature-based token approvals' },
      { name: 'Multicall3', address: CONTRACTS.MULTICALL3, note: 'batched reads' },
      { name: 'StableFX Escrow', address: CONTRACTS.FX_ESCROW, note: 'Circle StableFX settlement escrow' },
    ],
  },
  {
    title: 'XyloNet',
    blurb: 'Contracts owned or operated by XyloNet. Safes are 2-of-3 Gnosis Safe v1.4.1.',
    rows: [
      { name: 'Admin Safe', address: CONTRACTS.ADMIN_SAFE, note: 'protocol admin (2-of-3)' },
      { name: 'Treasury Safe', address: CONTRACTS.TREASURY_SAFE, note: 'fee recipient (2-of-3)' },
      // One PayXTipping v2 instance per supported asset; rows come from the registry.
      ...PAYX_ASSET_KEYS.map((key): Row => {
        const a = PAYX_ASSETS[key]
        return {
          name: `PayX v2 (${a.token.symbol})`,
          address: isPayXAssetLive(key) ? a.contract : undefined,
          note: `${a.token.symbol} payment instance; payments are escrowed until the handle owner claims. Fee 1%, minimum ${a.minTipHuman} ${a.token.symbol}`,
          pending: 'Address not configured',
        }
      }),
    ],
  },
  {
    title: 'LI.FI (Arc mainnet)',
    blurb: 'Routing partner for exchanges and any-token bridges.',
    rows: [
      { name: 'LI.FI Diamond', address: CONTRACTS.LIFI_DIAMOND, note: 'exchange / bridge executor' },
      { name: 'LI.FI FeeForwarder', address: CONTRACTS.LIFI_FEE_FORWARDER, note: 'integrator fee collection' },
    ],
  },
]

export default function ContractsPage() {
  return (
    <div>
      <DocTitle title="Smart contracts" lede={`Every address XyloNet interacts with on Arc mainnet (chain ${ARC_NETWORK.chainId}). Each one links to the explorer.`} />

      <Callout tone="info" className="mb-2">
        XyloNet does not deploy an AMM, router, vault or bridge contract of its own. Exchanges and any-token bridges execute through LI.FI&apos;s
        Diamond, native USDC bridging through Circle CCTP v2, and PayX through one payment contract per asset (each PayXTipping v2 instance escrows
        exactly one token, so each asset&apos;s payments live in their own contract with their own claims). Always verify an address on the explorer
        before signing.
      </Callout>

      {groups.map((group) => (
        <Section key={group.title} title={group.title}>
          <P className="mb-3 text-[14px] text-ink-3">{group.blurb}</P>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-surface-2">
                <tr>
                  <th className="px-4 py-2.5 text-[12px] font-medium uppercase tracking-[0.06em] text-ink-3">Contract</th>
                  <th className="px-4 py-2.5 text-[12px] font-medium uppercase tracking-[0.06em] text-ink-3">Address</th>
                  <th className="hidden px-4 py-2.5 text-[12px] font-medium uppercase tracking-[0.06em] text-ink-3 md:table-cell">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {group.rows.map((row) => (
                  <tr key={row.name} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">{row.name}</td>
                    <td className="px-4 py-3">
                      {row.address ? (
                        <AddressLink address={row.address} href={explorerAddressUrl(row.address)} />
                      ) : (
                        <StatusPill tone="warn" dot={false}>
                          {row.pending ?? 'Pending'}
                        </StatusPill>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-ink-2 md:table-cell">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ))}

      <Section title="Source of truth">
        <P className="text-[14px]">
          Circle contract addresses come from the official Arc documentation at <A href={ARC_NETWORK.docs}>{ARC_NETWORK.docs}</A>. LI.FI addresses come
          from LI.FI&apos;s deployment registry. XyloNet addresses are published here and in the public repository.
        </P>
      </Section>
    </div>
  )
}
