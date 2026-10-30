// PayX Background Service Worker — Arc mainnet (chain 5042) only.

const ARC_CHAIN_ID_HEX = "0x13b2"; // 5042
const ARC_ADD_CHAIN_PARAMS = {
  chainId: "0x13B2",
  chainName: "Arc",
  rpcUrls: ["https://www.xylonet.xyz/api/rpc"],
  blockExplorerUrls: ["https://explorer.arc.io"],
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
};

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "GET_WALLET":
      chrome.storage.local.get(["walletAddress"], (result) => {
        sendResponse({ address: result.walletAddress || null });
      });
      return true; // Keep channel open for async response

    case "EXECUTE_TIP_TRANSACTION":
      handleTipTransaction(message.data, sender.tab?.id)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case "SEND_TIP":
      handleSendTip(message.data)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ error: error.message }));
      return true;

    case "UPDATE_STATS":
      updateTipStats(message.amount);
      sendResponse({ success: true });
      break;

    default:
      console.log("Unknown message type:", message.type);
  }
});

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function isLiveAddress(addr) {
  return typeof addr === "string" && /^0x[0-9a-fA-F]{40}$/.test(addr) && addr.toLowerCase() !== ZERO_ADDRESS;
}

// Handle tip transaction via chrome.scripting.executeScript
async function handleTipTransaction(data, tabId) {
  const { handle, amount, message, contracts } = data || {};

  // Refuse before touching the page when the mainnet contract is not set yet
  // (set-contract.mjs writes it after the deployment ceremony).
  if (!contracts || !isLiveAddress(contracts.PAYX) || !isLiveAddress(contracts.USDC)) {
    return { success: false, error: "PayX is not live on Arc mainnet yet. Please update the extension after launch." };
  }

  if (!tabId) {
    // Get active tab if not provided
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id;
  }

  if (!tabId) {
    return { success: false, error: "No active tab found" };
  }

  try {
    // Execute the transaction in the page context (MAIN world)
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      world: "MAIN", // Execute in page context where window.ethereum exists
      func: executeTipInPage,
      args: [handle, amount, message, contracts, ARC_CHAIN_ID_HEX, ARC_ADD_CHAIN_PARAMS],
    });

    if (results && results[0] && results[0].result) {
      return results[0].result;
    }
    return { success: false, error: "No result from script execution" };
  } catch (error) {
    console.error("Script execution error:", error);
    return { success: false, error: error.message };
  }
}

// This function runs in the page context (has access to window.ethereum).
// It must be self-contained: nothing from the worker scope is visible here.
async function executeTipInPage(handle, amount, message, contracts, arcChainIdHex, arcAddChainParams) {
  const PAYX_ADDRESS = contracts.PAYX;
  const USDC_ADDRESS = contracts.USDC;
  const ZERO = "0x0000000000000000000000000000000000000000";
  const MIN_TIP_UNITS = 100000n; // 0.1 USDC (6dp) — contract minTipAmount at launch
  const MAX_MESSAGE_BYTES = 280;

  const isAddr = (a) => typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(a) && a.toLowerCase() !== ZERO;

  try {
    if (!isAddr(PAYX_ADDRESS) || !isAddr(USDC_ADDRESS)) {
      return { success: false, error: "PayX is not live on Arc mainnet yet." };
    }
    if (!window.ethereum) {
      return { success: false, error: "MetaMask not found. Please install MetaMask." };
    }

    // ── Chain guard: never send a transaction on any chain other than Arc (5042) ──
    const onArc = async () => {
      const id = await window.ethereum.request({ method: "eth_chainId" });
      return typeof id === "string" && id.toLowerCase() === arcChainIdHex;
    };
    if (!(await onArc())) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: arcAddChainParams.chainId }],
        });
      } catch (switchError) {
        if (switchError && switchError.code === 4902) {
          await window.ethereum.request({ method: "wallet_addEthereumChain", params: [arcAddChainParams] });
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: arcAddChainParams.chainId }],
          });
        } else {
          return { success: false, error: "Please switch your wallet to Arc (chain 5042) and try again." };
        }
      }
      if (!(await onArc())) {
        return { success: false, error: "Wallet is not on Arc (chain 5042). Tip cancelled." };
      }
    }

    // Get accounts
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (!accounts || accounts.length === 0) {
      return { success: false, error: "Please connect wallet first" };
    }
    const userAddress = accounts[0];

    // ── Inputs ──
    // Amount: string → 6dp integer without float drift ("1.5" → 1500000n).
    const amountStr = String(amount ?? "").trim();
    if (!/^\d+(\.\d{1,6})?$/.test(amountStr)) {
      return { success: false, error: "Invalid amount. Use up to 6 decimals." };
    }
    const [whole, frac = ""] = amountStr.split(".");
    const amountUnits = BigInt(whole) * 1000000n + BigInt((frac + "000000").slice(0, 6));
    if (amountUnits < MIN_TIP_UNITS) {
      return { success: false, error: "Minimum tip is 0.1 USDC." };
    }

    // Handle: mirror PayXTipping._normalizeHandle (1–15 chars of a-z 0-9 _; contract lowercases).
    const handleStr = String(handle || "").replace(/^@/, "");
    if (!/^[A-Za-z0-9_]{1,15}$/.test(handleStr)) {
      return { success: false, error: "Invalid handle. Must be 1-15 letters, numbers or underscores." };
    }

    // Message: the contract caps at 280 BYTES (UTF-8), not characters.
    const messageStr = String(message || "");
    const enc = new TextEncoder();
    const handleBytes = enc.encode(handleStr);
    const messageBytes = enc.encode(messageStr);
    if (messageBytes.length > MAX_MESSAGE_BYTES) {
      return { success: false, error: "Message is too long (max 280 bytes)." };
    }

    // ── ABI helpers ──
    const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const word = (v) => BigInt(v).toString(16).padStart(64, "0");
    const padBytes = (bytes) => {
      const h = hex(bytes);
      const target = Math.max(32, Math.ceil(bytes.length / 32) * 32) * 2;
      return h.padEnd(target, "0");
    };
    const addrWord = (a) => a.slice(2).toLowerCase().padStart(64, "0");
    const rpc = (method, params) => window.ethereum.request({ method, params });

    // ── Allowance: approve exactly the tip amount only when needed ──
    // allowance(address owner, address spender) selector 0xdd62ed3e
    let currentAllowance = 0n;
    try {
      const res = await rpc("eth_call", [
        { to: USDC_ADDRESS, data: "0xdd62ed3e" + addrWord(userAddress) + addrWord(PAYX_ADDRESS) },
        "latest",
      ]);
      currentAllowance = BigInt(res);
    } catch {
      currentAllowance = 0n;
    }

    if (currentAllowance < amountUnits) {
      // approve(address,uint256) selector 0x095ea7b3 — exact amount, never infinite
      const approveData = "0x095ea7b3" + addrWord(PAYX_ADDRESS) + word(amountUnits);
      let approveTxHash;
      try {
        approveTxHash = await rpc("eth_sendTransaction", [
          { from: userAddress, to: USDC_ADDRESS, data: approveData },
        ]);
      } catch (approveError) {
        return { success: false, error: "Approval rejected: " + (approveError.message || "User rejected") };
      }

      // Wait for the approval to be mined (Arc ~0.5s blocks; poll up to ~60s).
      let mined = null;
      for (let i = 0; i < 120 && !mined; i++) {
        await new Promise((r) => setTimeout(r, 500));
        try {
          mined = await rpc("eth_getTransactionReceipt", [approveTxHash]);
        } catch {
          mined = null;
        }
      }
      if (!mined) return { success: false, error: "Approval is taking too long. Please try again in a moment." };
      if (mined.status !== "0x1") return { success: false, error: "USDC approval failed on-chain." };
    }

    // ── tip(string handle, uint256 amount, string message) selector 0x64e28922 ──
    const handlePadded = padBytes(handleBytes);
    const messagePadded = padBytes(messageBytes);
    const headSize = 96; // 3 words
    const messageOffset = headSize + 32 + handlePadded.length / 2;
    const tipData =
      "0x64e28922" +
      word(headSize) +
      word(amountUnits) +
      word(messageOffset) +
      word(handleBytes.length) +
      handlePadded +
      word(messageBytes.length) +
      messagePadded;

    // Simulate first so a revert (InvalidAmount, MessageTooLong, EnforcedPause…) never reaches the wallet prompt.
    try {
      await rpc("eth_call", [{ from: userAddress, to: PAYX_ADDRESS, data: tipData }, "latest"]);
    } catch (simError) {
      const m = String((simError && simError.message) || "");
      const known = ["InvalidAmount", "InvalidHandle", "MessageTooLong", "EnforcedPause"].find((k) => m.includes(k));
      return { success: false, error: known ? `The contract rejected this tip (${known}).` : "The tip would revert. Check your USDC balance and try again." };
    }

    // Final chain re-check right before the value-moving transaction.
    if (!(await onArc())) {
      return { success: false, error: "Wallet left Arc (chain 5042). Tip cancelled." };
    }

    let tipTxHash;
    try {
      tipTxHash = await rpc("eth_sendTransaction", [{ from: userAddress, to: PAYX_ADDRESS, data: tipData }]);
    } catch (tipError) {
      return { success: false, error: "Tip rejected: " + (tipError.message || "User rejected") };
    }

    if (typeof tipTxHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(tipTxHash)) {
      return { success: false, error: "Wallet returned an invalid transaction hash." };
    }
    return { success: true, txHash: tipTxHash };
  } catch (error) {
    return { success: false, error: (error && error.message) || "Transaction failed" };
  }
}

// Legacy handler: no contract address is supplied, so it can never send a tx.
async function handleSendTip() {
  return { success: false, error: "Unsupported message. Please update the PayX extension." };
}

// Update tip statistics
async function updateTipStats(amount) {
  const stats = await chrome.storage.local.get(["tipsSent", "totalTipped"]);
  const newTipsSent = (stats.tipsSent || 0) + 1;
  const newTotalTipped = (stats.totalTipped || 0) + parseFloat(amount);

  await chrome.storage.local.set({
    tipsSent: newTipsSent,
    totalTipped: newTotalTipped,
  });
}

// Handle extension install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("PayX Extension installed!");
    // Initialize storage
    chrome.storage.local.set({
      tipsSent: 0,
      totalTipped: 0,
    });
  }
});
