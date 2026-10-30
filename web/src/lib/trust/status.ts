import 'server-only'
import { erc20Abi, getAddress, parseAbi, type Address } from 'viem'
import { PayXTippingABI } from '@/config/abis/PayXTipping'
import { CONTRACTS, PAYX_ASSETS, livePayXAssets } from '@/config/constants'
import { getPayXPublicClient, isRpcConfigured } from '@/lib/payx/client'

export const SAFES = {
  admin: { name: 'Admin Safe', address: '0xFD3A6DEE167C9B519fE7f646F91e9D80ba51Ed96' as Address, role: 'Owns the product contracts. Can rotate the oracle, set the guardian and update parameters. Cannot touch escrow.' },
  treasury: { name: 'Treasury Safe', address: '0x7EF8Aa263E3Bb8a151702108bD29932e50409990' as Address, role: 'Receives protocol fees. Nothing else.' },
}

const SAFE_ABI = parseAbi(['function getOwners() view returns (address[])', 'function getThreshold() view returns (uint256)'])

export interface TrustSnapshot {
  fetchedAt: number
  rpc: { ok: boolean; block: number | null; ageSeconds: number | null }
  payx: {
    address: Address
    owner: Address | null
    ownerIsAdminSafe: boolean
    pendingOwner: Address | null
    feeRecipient: Address | null
    feeRecipientIsTreasury: boolean
    oracle: Address | null
    guardian: Address | null
    paused: boolean
    feeBps: number
    minTip: bigint
    escrow: bigint
    fees: bigint
    balance: bigint
    solvent: boolean
    surplus: bigint
  } | null
  /** The other PayX instances (one audited contract per tipping asset). */
  instances: Array<{ symbol: string; decimals: number; address: Address; ownerIsAdminSafe: boolean; pendingIsAdminSafe: boolean; feeRecipientIsTreasury: boolean; paused: boolean; escrow: bigint; fees: bigint; balance: bigint; solvent: boolean }>
  safes: Array<{ name: string; address: Address; threshold: number | null; owners: Address[]; role: string }>
  lifi: { ok: boolean; ms: number | null }
  cctp: { ok: boolean; ms: number | null }
}

async function timed<T>(fn: () => Promise<T>): Promise<{ ok: boolean; ms: number; value?: T }> {
  const t0 = Date.now()
  try {
    const value = await fn()
    return { ok: true, ms: Date.now() - t0, value }
  } catch {
    return { ok: false, ms: Date.now() - t0 }
  }
}

/** Live facts a careful user checks before trusting a money app. Read fresh, cached briefly by the page. */
export async function readTrust(): Promise<TrustSnapshot> {
  const fetchedAt = Date.now()
  const empty: TrustSnapshot = { fetchedAt, rpc: { ok: false, block: null, ageSeconds: null }, payx: null, instances: [], safes: [], lifi: { ok: false, ms: null }, cctp: { ok: false, ms: null } }
  const lifiP = timed(() => fetch('https://li.quest/v1/chains?chainTypes=EVM', { next: { revalidate: 60 }, signal: AbortSignal.timeout(6000) }).then((r) => { if (!r.ok) throw new Error(); return r.status }))
  const cctpP = timed(() => fetch('https://iris-api.circle.com/v2/burn/USDC/fees/6/26', { next: { revalidate: 60 }, signal: AbortSignal.timeout(6000) }).then((r) => { if (!r.ok && r.status !== 404) throw new Error(); return r.status }))
  if (!isRpcConfigured()) {
    const [lifi, cctp] = await Promise.all([lifiP, cctpP])
    return { ...empty, lifi: { ok: lifi.ok, ms: lifi.ms }, cctp: { ok: cctp.ok, ms: cctp.ms } }
  }
  const client = getPayXPublicClient()
  const payxAddr = PAYX_ASSETS.USDC.contract
  const r = <T,>(functionName: string, args: readonly unknown[] = []) =>
    client.readContract({ address: payxAddr, abi: PayXTippingABI, functionName: functionName as never, args: args as never }) as Promise<T>

  const others = livePayXAssets().filter((a) => a.key !== 'USDC')
  const instancesP = Promise.all(
    others.map((a) =>
      timed(async () => {
        const read = <T,>(functionName: string) => client.readContract({ address: a.contract, abi: PayXTippingABI, functionName: functionName as never }) as Promise<T>
        const [owner, pendingOwner, feeRecipient, paused, escrow, fees, balance] = await Promise.all([
          read<Address>('owner'), read<Address>('pendingOwner'), read<Address>('feeRecipient'), read<boolean>('paused'), read<bigint>('totalPending'), read<bigint>('totalFeesCollected'),
          client.readContract({ address: a.token.address, abi: erc20Abi, functionName: 'balanceOf', args: [a.contract] }),
        ])
        return {
          symbol: a.token.symbol,
          decimals: a.token.decimals,
          address: a.contract as Address,
          ownerIsAdminSafe: getAddress(owner) === getAddress(SAFES.admin.address),
          pendingIsAdminSafe: getAddress(pendingOwner) === getAddress(SAFES.admin.address),
          feeRecipientIsTreasury: getAddress(feeRecipient) === getAddress(SAFES.treasury.address),
          paused,
          escrow,
          fees,
          balance,
          solvent: balance >= escrow + fees,
        }
      }),
    ),
  )

  const [block, lifi, cctp, payx, adminSafe, treasurySafe, instances] = await Promise.all([
    timed(() => client.getBlock({ blockTag: 'latest' })),
    lifiP,
    cctpP,
    timed(async () => {
      const [owner, pendingOwner, oracle, guardian, feeRecipient, feeBps, minTip, paused, escrow, fees, balance] = await Promise.all([
        r<Address>('owner'), r<Address>('pendingOwner'), r<Address>('oracleSigner'), r<Address>('guardian'), r<Address>('feeRecipient'), r<bigint>('platformFeeBps'), r<bigint>('minTipAmount'), r<boolean>('paused'), r<bigint>('totalPending'), r<bigint>('totalFeesCollected'),
        client.readContract({ address: CONTRACTS.USDC, abi: erc20Abi, functionName: 'balanceOf', args: [payxAddr] }),
      ])
      return { owner, pendingOwner, oracle, guardian, feeRecipient, feeBps: Number(feeBps), minTip, paused, escrow, fees, balance }
    }),
    timed(async () => ({ owners: await client.readContract({ address: SAFES.admin.address, abi: SAFE_ABI, functionName: 'getOwners' }), threshold: Number(await client.readContract({ address: SAFES.admin.address, abi: SAFE_ABI, functionName: 'getThreshold' })) })),
    timed(async () => ({ owners: await client.readContract({ address: SAFES.treasury.address, abi: SAFE_ABI, functionName: 'getOwners' }), threshold: Number(await client.readContract({ address: SAFES.treasury.address, abi: SAFE_ABI, functionName: 'getThreshold' })) })),
    instancesP,
  ])

  const p = payx.value
  return {
    fetchedAt,
    rpc: block.ok && block.value ? { ok: true, block: Number(block.value.number), ageSeconds: Math.max(0, Math.round(Date.now() / 1000 - Number(block.value.timestamp))) } : { ok: false, block: null, ageSeconds: null },
    payx: p
      ? {
          address: payxAddr,
          owner: p.owner,
          ownerIsAdminSafe: getAddress(p.owner) === getAddress(SAFES.admin.address),
          pendingOwner: p.pendingOwner,
          feeRecipient: p.feeRecipient,
          feeRecipientIsTreasury: getAddress(p.feeRecipient) === getAddress(SAFES.treasury.address),
          oracle: p.oracle,
          guardian: p.guardian,
          paused: p.paused,
          feeBps: p.feeBps,
          minTip: p.minTip,
          escrow: p.escrow,
          fees: p.fees,
          balance: p.balance,
          solvent: p.balance >= p.escrow + p.fees,
          surplus: p.balance - (p.escrow + p.fees),
        }
      : null,
    instances: instances.flatMap((i) => (i.value ? [i.value] : [])),
    safes: [
      { ...SAFES.admin, threshold: adminSafe.value?.threshold ?? null, owners: (adminSafe.value?.owners ?? []) as Address[] },
      { ...SAFES.treasury, threshold: treasurySafe.value?.threshold ?? null, owners: (treasurySafe.value?.owners ?? []) as Address[] },
    ],
    lifi: { ok: lifi.ok, ms: lifi.ms },
    cctp: { ok: cctp.ok, ms: cctp.ms },
  }
}
