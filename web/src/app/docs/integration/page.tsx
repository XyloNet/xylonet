import type { Metadata } from 'next'
import { ARC_NETWORK, CONTRACTS, LIFI } from '@/config/constants'
import { explorerAddressUrl } from '@/config/wagmi'
import { A, AddressLink, Bullets, Code, DocTitle, InlineCode, Note, P, Section } from '../_components/Doc'

export const metadata: Metadata = {
  title: 'Integration guide — Docs',
  description: 'Build against the same rails XyloNet uses on Arc: viem chain definition, USDC reads, LI.FI quotes and CCTP v2.',
}

const chainSnippet = `import { defineChain } from 'viem'

export const arc = defineChain({
  id: ${ARC_NETWORK.chainId},
  name: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [process.env.ARC_RPC_URL!] } }, // Circle's public RPC or your own provider
  blockExplorers: { default: { name: 'Arc Explorer', url: '${ARC_NETWORK.explorer}' } },
  contracts: { multicall3: { address: '${CONTRACTS.MULTICALL3}' } },
})`

const balanceSnippet = `import { createPublicClient, http, erc20Abi, formatUnits } from 'viem'
import { arc } from './arc'

const client = createPublicClient({ chain: arc, transport: http() })

// ERC-20 view of USDC (6 decimals)
const raw = await client.readContract({
  address: '${CONTRACTS.USDC}',
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [account],
})
console.log(formatUnits(raw, 6), 'USDC')`

const lifiSnippet = `// Ask LI.FI for a quote into USDC on Arc (chain ${ARC_NETWORK.chainId})
const url = new URL('https://li.quest/v1/quote')
url.search = new URLSearchParams({
  fromChain: '8453',                                   // Base
  toChain: '${ARC_NETWORK.chainId}',                                     // Arc
  fromToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
  toToken: '${CONTRACTS.USDC}',
  fromAmount: '1000000',                               // 1 USDC
  fromAddress: account,
  integrator: '${LIFI.integrator}',
}).toString()

const quote = await fetch(url).then((r) => r.json())
// quote.transactionRequest is ready to send with your wallet client`

const cctpSnippet = `// CCTP v2 burn on the source chain → mint on Arc (domain 26)
// 1. approve TokenMessengerV2 on the source chain for \`amount\`
// 2. depositForBurn(amount, 26, bytes32(recipientOnArc), sourceUsdc, bytes32(0), maxFee, minFinalityThreshold)
// 3. poll https://iris-api.circle.com/v2/messages/{sourceDomain}?transactionHash=...
// 4. receiveMessage(message, attestation) on MessageTransmitterV2 at
//    ${CONTRACTS.MESSAGE_TRANSMITTER_V2} (Arc)`

export default function IntegrationPage() {
  return (
    <div>
      <DocTitle title="Integration guide" lede="Everything a developer needs to build against the same rails XyloNet uses on Arc mainnet." />

      <Section title="1. Define the chain" className="mt-0">
        <P className="mb-4 text-[14px]">
          Arc is EVM-compatible; a standard viem chain definition is all you need. Use the public RPC published by Circle or your own provider, and
          never ship credentialed RPC URLs to the browser.
        </P>
        <Code>{chainSnippet}</Code>
      </Section>

      <Section title="2. Read a USDC balance">
        <P className="mb-4 text-[14px]">
          The native balance (what <InlineCode>eth_getBalance</InlineCode> returns) is 18-decimal; the ERC-20 interface at{' '}
          <InlineCode>{CONTRACTS.USDC}</InlineCode> is 6-decimal. Both represent the same USDC.
        </P>
        <Code>{balanceSnippet}</Code>
      </Section>

      <Section title="3. Exchange or bridge via LI.FI">
        <P className="mb-4 text-[14px]">
          XyloNet Exchange is a LI.FI integration. You can call the same API directly; the response includes a ready-to-send{' '}
          <InlineCode>transactionRequest</InlineCode>. Routes execute through the LI.FI Diamond at{' '}
          <AddressLink address={CONTRACTS.LIFI_DIAMOND} href={explorerAddressUrl(CONTRACTS.LIFI_DIAMOND)} />.
        </P>
        <Code>{lifiSnippet}</Code>
        <Note>See LI.FI&apos;s documentation for the SDK, widget and fee configuration.</Note>
      </Section>

      <Section title="4. Native USDC with CCTP v2">
        <P className="mb-4 text-[14px]">
          For USDC-only transfers, call Circle&apos;s contracts directly. Arc is domain <strong className="text-foreground">26</strong>.
        </P>
        <Code>{cctpSnippet}</Code>
        <Note>Full parameter reference and Fast/Standard transfer semantics are in Circle&apos;s CCTP v2 developer docs.</Note>
      </Section>

      <Section title="5. PayX">
        <P className="text-[14px]">
          The PayX contract exposes a small interface for sending a USDC payment to an X handle and for claiming with a server-signed authorization.
          The ABI and integration notes live in the <A href="/docs/payx/contracts">PayX smart contract</A> page.
        </P>
      </Section>

      <Section title="Reference">
        <Bullets
          items={[
            <>
              <A href="/docs/contracts">All contract addresses</A> used by XyloNet on Arc.
            </>,
            <>
              <A href={ARC_NETWORK.docs}>Arc developer documentation</A>: RPC endpoints and chain details.
            </>,
            <>
              <A href="https://docs.li.fi">LI.FI docs</A>: API, SDK and widget.
            </>,
            <>
              <A href="https://developers.circle.com/cctp">CCTP v2 docs</A>: burn/mint API and attestation service.
            </>,
            <>
              <A href="https://github.com/XyloNet/xylonet">XyloNet public repository</A>.
            </>,
          ]}
        />
      </Section>
    </div>
  )
}
