import { encodeFunctionData, parseAbi, type Address, type Hex, type PublicClient } from 'viem'

/**
 * Arc's predeployed Multicall3From routes each subcall through the CallFrom
 * precompile, so the target contract sees the original wallet as msg.sender.
 * That turns "approve, then tip" into one transaction with no contract change.
 * Verified on Arc mainnet 2026-09-30: code present, approve+tip simulates from
 * an EOA with zero allowance. Docs: docs.arc.io/arc/concepts/batched-transactions
 */
export const MULTICALL3_FROM: Address = '0x522fAf9A91c41c443c66765030741e4AaCe147D0'

export const MULTICALL3_FROM_ABI = parseAbi([
  'struct Call3 { address target; bool allowFailure; bytes callData; }',
  'struct Result { bool success; bytes returnData; }',
  'function aggregate3(Call3[] calldata calls) external returns (Result[] memory returnData)',
])

export type Call3 = { target: Address; allowFailure: boolean; callData: Hex }

const ERC20_APPROVE = parseAbi(['function approve(address spender, uint256 amount) returns (bool)'])

export function approveCall(token: Address, spender: Address, amount: bigint): Call3 {
  return { target: token, allowFailure: false, callData: encodeFunctionData({ abi: ERC20_APPROVE, functionName: 'approve', args: [spender, amount] }) }
}

/**
 * Batching only works when the transaction sender is a plain EOA (CallFrom
 * rejects intermediaries). Smart accounts and 7702-delegated accounts carry
 * code, so they take the sequential path (or their own native batching).
 */
export async function canBatchFrom(client: PublicClient, account: Address): Promise<boolean> {
  try {
    const code = await client.getCode({ address: account })
    return !code || code === '0x'
  } catch {
    return false
  }
}
