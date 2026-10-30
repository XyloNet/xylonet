import type { Metadata } from 'next'
import { CONTRACTS, isPayXDeployed, payXAssetSymbolList } from '@/config/constants'
import { ARC_CHAIN_ID, ARC_EXPLORER_URL, ARC_PUBLIC_RPC_URL } from '@/config/wagmi'
import { Cta, DocTitle, FaqList, Section } from '../../_components/Doc'

export const metadata: Metadata = {
  title: 'PayX FAQ — Docs',
  description: 'Frequently asked questions about PayX on Arc mainnet: paying, claiming, the Chrome extension, Arc and the contract.',
}

export default function PayXFAQPage() {
  const deployed = isPayXDeployed()
  const assets = payXAssetSymbolList()

  const groups = [
    {
      category: 'General',
      questions: [
        {
          q: 'What is PayX?',
          a: `PayX is a payment protocol on Arc mainnet that lets you send ${payXAssetSymbolList('or')} to any X account. Funds are held in an onchain escrow under the handle until the creator signs in with X and claims them to a wallet of their choice.`,
        },
        {
          q: 'How is PayX different from other tipping platforms?',
          a: 'PayX is non-custodial: funds sit in a smart contract, not with us, and there is no admin function that can move user escrow. Creators do not need a wallet to receive, everything is transparent onchain, and Arc settles in under a second.',
        },
        {
          q: 'Is PayX safe to use?',
          a: 'PayXTipping v2 uses OpenZeppelin building blocks (ReentrancyGuard, SafeERC20, Ownable2Step, Pausable, EIP712), is owned by a 2-of-3 Safe, and was reviewed line by line before launch. As with any smart contract there is residual risk; send amounts you are comfortable with.',
        },
        {
          q: 'What blockchain is PayX on?',
          a: `Arc mainnet (chain ID ${ARC_CHAIN_ID}), Circle's stablecoin-native Layer 1. USDC is the native gas token, so you never need another token.`,
        },
      ],
    },
    {
      category: 'Paying',
      questions: [
        {
          q: 'How do I send a payment?',
          a: 'Go to xylonet.xyz/pay (or xylonet.xyz/to/handle to prefill), enter the X username, choose an amount, add an optional message and confirm. The first time you pay an amount you also approve exactly that much USDC for the contract. The Chrome extension does the same from x.com.',
        },
        {
          q: 'What is the minimum amount?',
          a: 'The minimum is 0.1 USDC (minTipAmount = 100000 in 6-decimal units). Each supported asset has its own PayX contract with its own minimum.',
        },
        {
          q: 'Which assets can I pay in?',
          a: `Currently ${assets}. PayX runs one escrow contract per supported asset, so each new asset is added as its own PayXTipping instance with its own minimum and its own claims.`,
        },
        {
          q: 'What are the fees?',
          a: 'A 1% platform fee (100 bps) goes to the XyloNet Treasury Safe, and Arc charges gas of roughly $0.01 in USDC. On a $10 payment the creator receives $9.90.',
        },
        {
          q: 'Can I pay any X user?',
          a: 'Yes. The handle is normalized onchain (lowercase, a–z 0–9 _, 1–15 characters). The creator does not need a wallet or a PayX account to receive.',
        },
        {
          q: 'Can I add a message?',
          a: 'Yes, up to 280 bytes. Messages are stored onchain and visible to the recipient in their hub.',
        },
        {
          q: 'How do I get USDC on Arc?',
          a: 'Bridge USDC from Ethereum, Base, Arbitrum and other chains with the XyloNet bridge at xylonet.xyz/bridge (Circle CCTP under the hood), or withdraw from an exchange that supports Arc.',
        },
      ],
    },
    {
      category: 'Claiming',
      questions: [
        {
          q: 'How do I claim?',
          a: 'Visit xylonet.xyz/pay/creator, sign in with X, connect a wallet on Arc and click Claim on the asset you want (each supported asset has its own contract and its own claim). Our oracle issues an EIP-712 authorization for your handle, wallet and that contract; the contract verifies it and pays out your whole pending balance of that asset.',
        },
        {
          q: 'Do I need a wallet to receive?',
          a: 'No. Anyone can pay your handle before you have a wallet. You only need one when you are ready to claim.',
        },
        {
          q: 'How long do payments stay in escrow?',
          a: 'Indefinitely. There is no expiry and no admin function that can remove them.',
        },
        {
          q: 'Can I claim partial amounts?',
          a: 'No. Each claim withdraws the entire pending balance in one transaction.',
        },
        {
          q: 'What happens if I change my X handle?',
          a: 'Payments are indexed by the handle text, not your X user ID. Payments sent to your old handle stay under that handle; whoever can sign in as that username can claim them. Tell your audience your new handle before you rename.',
        },
        {
          q: 'Can I change my linked wallet?',
          a: 'Your first claim on a given contract links a wallet to your handle there and later claims on that contract must come from it (WalletMismatch otherwise). Each asset instance links independently. If you lose access, contact @Xylonet_: the Admin Safe (2-of-3) can relink your handle via adminRelinkWallet after verification. Relinking only redirects future claims.',
        },
      ],
    },
    {
      category: 'Chrome extension',
      questions: [
        {
          q: 'Where can I get the Chrome extension?',
          a: 'Everything the extension does is available from the web at xylonet.xyz/pay while the Chrome Web Store listing is updated. We will link the listing here as soon as it is live.',
        },
        {
          q: 'Is the extension safe?',
          a: 'It never has access to your private keys; every transaction is signed by your wallet. It only requests permission to add Pay buttons on x.com and to remember your wallet connection.',
        },
        {
          q: 'What wallets are supported?',
          a: `Any EVM wallet: MetaMask, Rabby, Coinbase Wallet, WalletConnect wallets. Make sure it is on Arc (chain ${ARC_CHAIN_ID}); the web app and extension offer to add the network.`,
        },
      ],
    },
    {
      category: 'Arc',
      questions: [
        {
          q: 'What is Arc?',
          a: "Arc is Circle's stablecoin-native Layer 1. USDC is the native gas token, finality is sub-second, and fees are predictable in dollars.",
        },
        {
          q: 'How do I add Arc to my wallet?',
          a: `Chain ID ${ARC_CHAIN_ID}, currency symbol USDC, RPC ${ARC_PUBLIC_RPC_URL}, explorer ${ARC_EXPLORER_URL}. The PayX pages will prompt your wallet to add it automatically when you send or claim.`,
        },
        {
          q: 'Is this the real Arc mainnet?',
          a: `Yes. PayX v2 runs only on Arc mainnet (chain ${ARC_CHAIN_ID}) with real USDC. There is no testnet mode in this app.`,
        },
      ],
    },
    {
      category: 'Technical',
      questions: [
        {
          q: 'Is the smart contract verified?',
          a: deployed
            ? `Yes. The USDC instance of PayXTipping v2 is at ${CONTRACTS.PAYX} on Arc mainnet; the source is verified on the Arc explorer. Any additional asset instance uses the same source and is listed on the smart contract page.`
            : 'The contract is deployed and verified at the mainnet launch ceremony. Its address appears on the smart contract page as soon as it is live.',
        },
        {
          q: 'How does claim verification work?',
          a: `After X OAuth, our server signs an EIP-712 message Claim(string handle, address wallet, bytes32 nonce) under the domain {name: "PayX", version: "2", chainId: ${ARC_CHAIN_ID}, verifyingContract}. The contract recovers the signer, checks it equals oracleSigner(), rejects reused nonces, and pays out.`,
        },
        {
          q: 'What libraries does PayX use?',
          a: 'Solidity 0.8.24 with OpenZeppelin ReentrancyGuard, SafeERC20, Ownable2Step, Pausable, EIP712 and ECDSA. The web app is Next.js with wagmi/viem; the oracle signs with viem.',
        },
        {
          q: 'Can I integrate PayX into my app?',
          a: 'Yes. The contract is public: read pending balances, history and events with any EVM library. See the smart contract page for a viem example.',
        },
      ],
    },
  ]

  return (
    <div>
      <DocTitle title="FAQ" lede="Frequently asked questions about PayX on Arc mainnet." />
      {groups.map((g, i) => (
        <Section key={g.category} title={g.category} className={i === 0 ? 'mt-0' : undefined}>
          <FaqList items={g.questions} />
        </Section>
      ))}
      <Cta
        title="Still have questions?"
        description="Join the community for support and discussion."
        primary={{ href: 'https://discord.gg/mcDkHNrFyA', label: 'Join Discord' }}
        secondary={{ href: 'https://x.com/Xylonet_', label: 'Follow on X' }}
      />
    </div>
  )
}
