import type { Metadata } from 'next'
import { ARC_NETWORK } from '@/config/constants'
import { A, DocTitle, FaqList } from '../_components/Doc'

export const metadata: Metadata = {
  title: 'FAQ — Docs',
  description: 'Short answers about XyloNet on Arc mainnet: network, gas in USDC, bridging times, fees and PayX.',
}

const faqs: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: 'What is XyloNet?',
    a: 'A stablecoin front-end on Arc mainnet: exchange any token (routed by LI.FI), bridge USDC with Circle CCTP v2, and pay anyone on X in USDC with PayX.',
  },
  {
    q: 'Which network do I need?',
    a: (
      <>
        Arc mainnet, chain ID {ARC_NETWORK.chainId}. The app adds it to your wallet when you connect; you can also add it manually from the{' '}
        <A href="/docs/network">network setup</A> page.
      </>
    ),
  },
  {
    q: 'What do I pay gas in?',
    a: 'USDC. Arc has no separate gas token. Fees are typically a fraction of a cent.',
  },
  {
    q: 'Why does my wallet show USDC with 18 decimals?',
    a: 'The native balance interface on Arc is 18-decimal; the ERC-20 interface of the same USDC (0x3600…0000) is 6-decimal. They are the same asset.',
  },
  {
    q: 'Does XyloNet have its own liquidity pools or vaults?',
    a: 'No. On mainnet exchanges are executed by LI.FI across third-party venues, and USDC bridging is Circle CCTP v2. XyloNet does not custody funds or run an AMM.',
  },
  {
    q: 'How long does a bridge take?',
    a: 'CCTP v2 Fast Transfer routes settle in seconds where supported; Standard Transfer waits for source-chain finality (minutes on Ethereum). Minting on Arc is sub-second once the attestation arrives. LI.FI routes show their own estimate in the quote.',
  },
  {
    q: 'Are there fees?',
    a: 'Venue fees (DEXs, bridges) and network gas are always shown in the quote. XyloNet may add a small integrator fee on LI.FI routes; if so it is displayed before you sign. PayX charges a 1% platform fee per payment (minimum 0.1 USDC); the breakdown is shown before you send.',
  },
  {
    q: 'How does PayX work without the recipient having a wallet?',
    a: 'Your payment is sent to the PayX contract on Arc and recorded against the X handle. The recipient signs in with X to prove they own the handle, then connects any wallet and claims.',
  },
  {
    q: 'Can I get my payment back if it is never claimed?',
    a: 'No. Unclaimed payments are held by the PayX contract indefinitely: there is no expiry, no refund path, and no admin function that can remove them. Only a valid claim by the handle owner moves the funds. Double-check the handle before you pay.',
  },
  {
    q: 'Is the code open source?',
    a: (
      <>
        Yes, the public repository is at <A href="https://github.com/XyloNet/xylonet">github.com/XyloNet/xylonet</A>.
      </>
    ),
  },
  {
    q: 'Something went wrong. Where do I get help?',
    a: (
      <>
        Check the transaction on the <A href={ARC_NETWORK.explorer}>Arc explorer</A>, then reach us on{' '}
        <A href="https://discord.gg/mcDkHNrFyA">Discord</A> or <A href="https://x.com/Xylonet_">X</A>.
      </>
    ),
  },
]

export default function FAQPage() {
  return (
    <div>
      <DocTitle title="FAQ" lede="Short answers to the questions we get most." />
      <FaqList items={faqs} />
    </div>
  )
}
