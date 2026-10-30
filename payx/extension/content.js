// PayX Content Script - Injects tip buttons on X.com
console.log('[PayX v3.1.0] Arc mainnet build by XyloNet');

// Configuration
const CONFIG = {
  tipAmounts: [1, 5, 10, 25],
  buttonColor: "#e8461b",
};

// Arc mainnet configuration (chain 5042). RPC = XyloNet same-origin proxy until Circle publishes the public RPC.
const ARC_MAINNET = {
  chainId: "0x13B2", // 5042 in hex
  chainName: "Arc",
  rpcUrls: ["https://www.xylonet.xyz/api/rpc"],
  blockExplorerUrls: ["https://explorer.arc.io"],
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
};

// Contract addresses — Arc MAINNET. PAYX is set by payx/extension/set-contract.mjs after the deployment ceremony.
const CONTRACTS = {
  PAYX: "0x47d4164F2f65afc00c7ba932cbEC9858b5FDAf0A",
  USDC: "0x3600000000000000000000000000000000000000", // Real Circle USDC
};

// Real USDC uses 6 decimals
const USDC_DECIMALS = 6;

// Contract ABIs (minimal for what we need)
const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)"
];

const PAYX_ABI = [
  "function tip(string calldata handle, uint256 amount, string calldata message) external"
];

// State
let walletConnected = false;
let walletAddress = null;

// Initialize
(async function init() {
  console.log("PayX: Content script loaded");

  // Check wallet status from storage
  const saved = await chrome.storage.local.get(["walletAddress"]);
  if (saved.walletAddress) {
    walletConnected = true;
    walletAddress = saved.walletAddress;
  }

  // Start observing DOM changes
  observeTweets();

  // Listen for messages from popup and background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "CONNECT_WALLET") {
      // Handle wallet connection request from popup
      connectWallet().then(result => {
        sendResponse(result);
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Keep channel open for async response
    } else if (message.type === "WALLET_CONNECTED") {
      walletConnected = true;
      walletAddress = message.address;
      addTipButtonsToAllTweets();
    } else if (message.type === "WALLET_DISCONNECTED") {
      walletConnected = false;
      walletAddress = null;
    }
  });
})();

// Connect wallet using MetaMask
async function connectWallet() {
  console.log('[PayX] connectWallet called');
  try {
    // Check if MetaMask is available
    if (typeof window.ethereum === "undefined") {
      console.log('[PayX] MetaMask not found');
      return { success: false, error: "MetaMask is not installed. Please install MetaMask first." };
    }

    console.log('[PayX] Requesting accounts...');
    // Request account access
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    if (!accounts || accounts.length === 0) {
      return { success: false, error: "No accounts found. Please unlock MetaMask." };
    }

    const address = accounts[0];

    // Try to switch to Arc mainnet
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_MAINNET.chainId }],
      });
    } catch (switchError) {
      // Chain not added, add it
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [ARC_MAINNET],
        });
      } else {
        console.warn("Could not switch to Arc:", switchError);
      }
    }

    // Update local state
    walletConnected = true;
    walletAddress = address;
    
    // Save to storage
    await chrome.storage.local.set({ walletAddress: address });
    
    // Update UI
    addTipButtonsToAllTweets();

    return { success: true, address };
  } catch (error) {
    console.error("Wallet connection error:", error);
    return { success: false, error: error.message || "Failed to connect wallet" };
  }
}

// Observe DOM for new tweets
function observeTweets() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Find tweet action bars in new nodes
          const actionBars = node.querySelectorAll('[data-testid="tweet"]');
          actionBars.forEach(addTipButtonToTweet);
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Add to existing tweets
  addTipButtonsToAllTweets();
}

// Add tip buttons to all visible tweets
function addTipButtonsToAllTweets() {
  const tweets = document.querySelectorAll('[data-testid="tweet"]');
  tweets.forEach(addTipButtonToTweet);
}

// Add tip button to a single tweet
function addTipButtonToTweet(tweetElement) {
  // Check if already has tip button
  if (tweetElement.querySelector(".payx-tip-btn")) return;

  // Find the action bar (like, retweet, reply buttons)
  const actionBar = tweetElement.querySelector('[role="group"]');
  if (!actionBar) return;

  // Get the tweet author's handle
  const handleElement = tweetElement.querySelector('a[href*="/"] span');
  let handle = "";
  
  // Try to extract handle from the tweet
  const userLink = tweetElement.querySelector('a[href^="/"][role="link"]');
  if (userLink) {
    const href = userLink.getAttribute("href");
    if (href && href.startsWith("/")) {
      handle = href.slice(1).split("/")[0];
    }
  }

  // Only a real X handle shape ever reaches the modal markup or the contract.
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return;

  // Create tip button
  const tipButton = createTipButton(handle);
  
  // Insert into action bar
  actionBar.appendChild(tipButton);
}

// Create tip button element
function createTipButton(handle) {
  const container = document.createElement("div");
  container.className = "payx-tip-btn";

  // Small mint pill. All styling lives in content.css (light + dark).
  const button = document.createElement("button");
  button.className = "payx-tip-trigger";
  button.type = "button";
  button.setAttribute("aria-label", `Tip @${handle} in USDC`);
  button.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="12" y1="2" x2="12" y2="22"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
    <span>Tip in USDC</span>
  `;

  button.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showTipModal(handle);
  });

  container.appendChild(button);
  return container;
}

// Show tip modal
function showTipModal(handle) {
  // Remove existing modal if any
  const existing = document.getElementById("payx-modal");
  if (existing) existing.remove();

  // Create modal
  const modal = document.createElement("div");
  modal.id = "payx-modal";
  modal.innerHTML = `
    <div class="payx-modal-overlay"></div>
    <div class="payx-modal-content">
      <div class="payx-modal-header">
        <div class="payx-modal-logo">
          <img src="${chrome.runtime.getURL('icons/icon48.png')}" width="32" height="32" alt="XyloNet" />
        </div>
        <h2>Send a tip to <span class="payx-handle">@${handle}</span></h2>
        <button class="payx-modal-close" type="button" aria-label="Close">&times;</button>
      </div>

      <div class="payx-modal-body">
        ${!walletConnected ? `
          <div class="payx-connect-prompt">
            <p>Connect your wallet to tip with USDC on Arc.</p>
            <button class="payx-connect-btn" type="button">Connect wallet</button>
          </div>
        ` : `
          <div class="payx-amount-selector">
            <p class="payx-amount-label">Amount</p>
            <div class="payx-amounts">
              ${CONFIG.tipAmounts.map(amt => `
                <button class="payx-amount-btn" data-amount="${amt}">$${amt}</button>
              `).join("")}
            </div>
            <div class="payx-custom-amount">
              <input type="number" placeholder="Custom amount" min="0.1" step="0.1" />
              <span>USDC</span>
            </div>
          </div>
          
          <div class="payx-message">
            <textarea placeholder="Add a message (optional)" maxlength="280"></textarea>
          </div>
          
          <button class="payx-send-btn" type="button" disabled>Select an amount</button>
        `}
      </div>

      <div class="payx-modal-footer">Built on Arc by <strong>XyloNet</strong></div>
    </div>
  `;

  document.body.appendChild(modal);

  // Event listeners
  const overlay = modal.querySelector(".payx-modal-overlay");
  const closeBtn = modal.querySelector(".payx-modal-close");
  
  overlay.addEventListener("click", () => modal.remove());
  closeBtn.addEventListener("click", () => modal.remove());

  if (walletConnected) {
    setupTipModalLogic(modal, handle);
  } else {
    const connectBtn = modal.querySelector(".payx-connect-btn");
    connectBtn.addEventListener("click", async () => {
      // Show loading state
      connectBtn.textContent = "Connecting...";
      connectBtn.disabled = true;
      
      // Directly connect wallet
      const result = await connectWallet();
      
      if (result.success) {
        // Refresh modal with connected state
        modal.remove();
        showTipModal(handle);
      } else {
        connectBtn.textContent = "Connect wallet";
        connectBtn.disabled = false;
        alert(result.error || "Failed to connect wallet");
      }
    });
  }
}

// Setup tip modal logic
function setupTipModalLogic(modal, handle) {
  let selectedAmount = 0;
  const amountBtns = modal.querySelectorAll(".payx-amount-btn");
  const customInput = modal.querySelector(".payx-custom-amount input");
  const sendBtn = modal.querySelector(".payx-send-btn");
  const messageInput = modal.querySelector(".payx-message textarea");

  // Amount button selection
  amountBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      amountBtns.forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedAmount = parseFloat(btn.dataset.amount);
      customInput.value = "";
      updateSendButton();
    });
  });

  // Custom amount input
  customInput.addEventListener("input", () => {
    amountBtns.forEach((b) => b.classList.remove("selected"));
    selectedAmount = parseFloat(customInput.value) || 0;
    updateSendButton();
  });

  // Update send button state
  function updateSendButton() {
    if (selectedAmount > 0) {
      sendBtn.disabled = false;
      sendBtn.textContent = `Send $${selectedAmount.toFixed(2)} USDC`;
    } else {
      sendBtn.disabled = true;
      sendBtn.textContent = "Select an amount";
    }
  }

  // Send tip - REAL TRANSACTION
  sendBtn.addEventListener("click", async () => {
    if (selectedAmount <= 0) return;

    // Contract not live yet (PAYX still the zero address) — refuse before any wallet prompt.
    if (!/^0x[0-9a-fA-F]{40}$/.test(CONTRACTS.PAYX) || /^0x0{40}$/.test(CONTRACTS.PAYX)) {
      alert("PayX is not live on Arc mainnet yet. Please update the extension after launch.");
      return;
    }
    // Contract caps the message at 280 UTF-8 bytes (the textarea maxlength counts characters).
    const messageText = messageInput.value || "";
    if (new TextEncoder().encode(messageText).length > 280) {
      alert("Message is too long (max 280 bytes). Shorten it and try again.");
      return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = "Approving USDC...";

    try {
      // Execute real transaction via injected script
      const result = await executeTipTransaction(handle, String(selectedAmount), messageText);

      if (result.success && /^0x[0-9a-fA-F]{64}$/.test(String(result.txHash))) {
        // Update stats
        chrome.runtime.sendMessage({
          type: "UPDATE_STATS",
          amount: selectedAmount,
        });

        // Show success
        modal.querySelector(".payx-modal-body").innerHTML = `
          <div class="payx-success">
            <div class="payx-success-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h3>Tip sent</h3>
            <p>You tipped @${handle} <span class="payx-amount">$${selectedAmount.toFixed(2)} USDC</span> onchain.</p>
            <div class="payx-success-links">
              <a href="${ARC_MAINNET.blockExplorerUrls[0]}/tx/${result.txHash}" target="_blank" rel="noopener">View transaction</a>
              <a href="https://www.xylonet.xyz/to/${handle}" target="_blank" rel="noopener">Creator page</a>
            </div>
          </div>
        `;
      } else {
        throw new Error(result.error || "Failed to send tip");
      }
    } catch (error) {
      sendBtn.disabled = false;
      sendBtn.textContent = `Send $${selectedAmount.toFixed(2)} USDC`;
      alert("Failed to send tip: " + error.message);
    }
  });
}

// Execute tip transaction using MetaMask via background script
async function executeTipTransaction(handle, amount, message) {
  return new Promise((resolve) => {
    // Send request to background script which can bypass CSP
    chrome.runtime.sendMessage({
      type: "EXECUTE_TIP_TRANSACTION",
      data: {
        handle: handle,
        amount: amount,
        message: message || "",
        contracts: CONTRACTS
      }
    }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response || { success: false, error: "No response from background" });
      }
    });
  });
}
