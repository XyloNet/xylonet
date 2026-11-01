// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title PayX Tipping Contract v2 (Arc Mainnet)
 * @notice Tip X/Twitter handles with USDC; tips escrow until the handle owner
 *         claims them via an X-OAuth-verified, EIP-712-signed oracle authorization.
 * @dev v2 hardening over the audited testnet v1 (see docs/04-PAYX-SECURITY-THREAT-MODEL.md):
 *      - EIP-712 typed claim signatures bound to name/version/chainId/contract (S-1)
 *      - Pausable tip/claim with a guardian who can pause but never move funds (S-2)
 *      - Ownable2Step ownership, held by the Admin Safe 2-of-3 (S-3)
 *      - adminRelinkWallet: owner-gated handle/wallet recovery with event trail (S-4)
 *      - withdrawFees restricted to owner or feeRecipient (S-5)
 *      - totalPending escrow liability + sweep/rescue that mathematically cannot
 *        touch user escrow (S-6); there is deliberately NO owner path to escrow
 *      - 280-byte tip message cap (S-7)
 *      v2.1 (pre-deploy audit 2026-09-15, docs/07-PAYX-AUDIT-2026-09-15.md), ABI-additive:
 *      - renounceOwnership() disabled: the Admin Safe can never brick admin (A-1)
 *      - withdrawFees() reverts when nothing is owed: no zero-value USDC transfer (A-2)
 *      - minTipAmount can never be 0: no zero-amount tips / free storage spam (A-3)
 *      - claim wallet and feeRecipient can never be this contract (A-4)
 *      - getTipHistory() saturates offset+limit instead of panicking (A-5)
 *      All USDC amounts use the 6-decimal ERC-20 interface of Arc's native USDC.
 */
contract PayXTipping is ReentrancyGuard, Ownable2Step, Pausable, EIP712 {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════
    // STRUCTS
    // ═══════════════════════════════════════════════════════════════════════

    struct Tip {
        address tipper;
        uint256 amount;
        uint256 timestamp;
        string message;
    }

    struct HandleInfo {
        uint256 pendingBalance;
        address linkedWallet;
        bool isRegistered;
        uint256 totalReceived;
        uint256 totalClaimed;
        uint256 tipCount;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice EIP-712 typed struct for claim authorizations
    bytes32 public constant CLAIM_TYPEHASH =
        keccak256("Claim(string handle,address wallet,bytes32 nonce)");

    /// @notice Maximum platform fee: 5%
    uint256 public constant MAX_FEE_BPS = 500;

    /// @notice Maximum tip message length in bytes
    uint256 public constant MAX_MESSAGE_BYTES = 280;

    // ═══════════════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice USDC token (Arc native, 6-decimal ERC-20 interface)
    IERC20 public immutable usdc;

    /// @notice Oracle address whose EIP-712 signatures authorize claims
    address public oracleSigner;

    /// @notice Address allowed to pause (in addition to owner); can never move funds
    address public guardian;

    /// @notice Platform fee in basis points (100 = 1%)
    uint256 public platformFeeBps;

    /// @notice Minimum tip amount (6-decimal USDC units; 100000 = 0.1 USDC)
    uint256 public minTipAmount;

    /// @notice Platform fee recipient (Treasury Safe)
    address public feeRecipient;

    /// @notice Fees accrued and not yet withdrawn
    uint256 public totalFeesCollected;

    /// @notice Sum of all handles' pendingBalance — the escrow liability.
    ///         usdc.balanceOf(this) >= totalPending + totalFeesCollected always holds.
    uint256 public totalPending;

    /// @notice X handle (lowercase) => HandleInfo
    mapping(string => HandleInfo) public handles;

    /// @notice X handle => tips received
    mapping(string => Tip[]) public tipHistory;

    /// @notice Used claim nonces (replay protection)
    mapping(bytes32 => bool) public usedNonces;

    /// @notice Tipper address => total amount tipped (gross, 6-decimal units)
    mapping(address => uint256) public tipperTotalSent;

    // ═══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════

    event TipSent(
        string indexed handleHash,
        string handle,
        address indexed tipper,
        uint256 amount,
        uint256 fee,
        string message,
        uint256 timestamp
    );

    event TipsClaimed(
        string indexed handleHash,
        string handle,
        address indexed wallet,
        uint256 amount,
        uint256 timestamp
    );

    event WalletLinked(string indexed handleHash, string handle, address indexed wallet);

    event WalletRelinked(
        string indexed handleHash,
        string handle,
        address indexed oldWallet,
        address indexed newWallet
    );

    event OracleSignerUpdated(address indexed oldSigner, address indexed newSigner);
    event GuardianUpdated(address indexed oldGuardian, address indexed newGuardian);
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    event MinTipAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event FeesWithdrawn(address indexed recipient, uint256 amount);
    event ExcessSwept(address indexed recipient, uint256 amount);
    event TokenRescued(address indexed token, address indexed recipient, uint256 amount);

    // ═══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════

    error InvalidHandle();
    error InvalidAmount();
    error InvalidSignature();
    error NonceAlreadyUsed();
    error NoTipsToClaim();
    error WalletMismatch();
    error ZeroAddress();
    error FeeTooHigh();
    error MessageTooLong();
    error NotAuthorized();
    error HandleNotRegistered();
    error NothingToSweep();
    error CannotRescueUSDC();
    error NothingToWithdraw();
    error InvalidRecipient();
    error OwnershipCannotBeRenounced();

    // ═══════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @param _usdc USDC token address on Arc (0x3600…0000)
     * @param _oracleSigner Oracle address (XYLO-ORACLE-01)
     * @param _feeRecipient Fee recipient (Treasury Safe)
     * @param _platformFeeBps Platform fee in basis points (max 500 = 5%)
     * @param _minTipAmount Minimum tip in 6-decimal USDC units (100000 = 0.1 USDC)
     */
    constructor(
        address _usdc,
        address _oracleSigner,
        address _feeRecipient,
        uint256 _platformFeeBps,
        uint256 _minTipAmount
    ) Ownable(msg.sender) EIP712("PayX", "2") {
        if (_usdc == address(0)) revert ZeroAddress();
        if (_oracleSigner == address(0)) revert ZeroAddress();
        if (_feeRecipient == address(0)) revert ZeroAddress();
        if (_platformFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        if (_minTipAmount == 0) revert InvalidAmount();

        usdc = IERC20(_usdc);
        oracleSigner = _oracleSigner;
        feeRecipient = _feeRecipient;
        platformFeeBps = _platformFeeBps;
        minTipAmount = _minTipAmount;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CORE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Send a tip to an X handle
     * @param handle X handle without @ (lowercased on-chain; a-z 0-9 _ only, max 15)
     * @param amount USDC amount in 6-decimal units
     * @param message Optional message, max 280 bytes
     */
    function tip(
        string calldata handle,
        uint256 amount,
        string calldata message
    ) external nonReentrant whenNotPaused {
        string memory normalizedHandle = _normalizeHandle(handle);
        if (bytes(normalizedHandle).length == 0) revert InvalidHandle();
        if (amount < minTipAmount) revert InvalidAmount();
        if (bytes(message).length > MAX_MESSAGE_BYTES) revert MessageTooLong();

        uint256 fee = (amount * platformFeeBps) / 10000;
        uint256 netAmount = amount - fee;

        // Effects before the token interaction (checks-effects-interactions, F-01).
        // nonReentrant already closes the re-entry path; this ordering removes the
        // dependency on it for a token whose transfer hook could call back in.
        HandleInfo storage info = handles[normalizedHandle];
        info.pendingBalance += netAmount;
        info.totalReceived += netAmount;
        info.tipCount += 1;

        totalFeesCollected += fee;
        totalPending += netAmount;
        tipperTotalSent[msg.sender] += amount;

        tipHistory[normalizedHandle].push(
            Tip({tipper: msg.sender, amount: netAmount, timestamp: block.timestamp, message: message})
        );

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit TipSent(normalizedHandle, normalizedHandle, msg.sender, netAmount, fee, message, block.timestamp);
    }

    /**
     * @notice Claim all pending tips for a handle (requires oracle EIP-712 signature)
     * @param handle The X handle being claimed
     * @param wallet The wallet to receive the tips
     * @param nonce Unique nonce (single use)
     * @param signature Oracle EIP-712 signature over Claim(handle, wallet, nonce)
     */
    function claimTips(
        string calldata handle,
        address wallet,
        bytes32 nonce,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        string memory normalizedHandle = _normalizeHandle(handle);
        if (bytes(normalizedHandle).length == 0) revert InvalidHandle();
        if (wallet == address(0)) revert ZeroAddress();
        if (wallet == address(this)) revert InvalidRecipient();

        if (usedNonces[nonce]) revert NonceAlreadyUsed();
        usedNonces[nonce] = true;

        // EIP-712: binds handle+wallet+nonce to this contract, this chain, PayX v2
        bytes32 structHash = keccak256(
            abi.encode(CLAIM_TYPEHASH, keccak256(bytes(normalizedHandle)), wallet, nonce)
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        if (ECDSA.recover(digest, signature) != oracleSigner) revert InvalidSignature();

        HandleInfo storage info = handles[normalizedHandle];
        uint256 amount = info.pendingBalance;
        if (amount == 0) revert NoTipsToClaim();

        if (!info.isRegistered) {
            info.linkedWallet = wallet;
            info.isRegistered = true;
            emit WalletLinked(normalizedHandle, normalizedHandle, wallet);
        } else {
            if (info.linkedWallet != wallet) revert WalletMismatch();
        }

        info.pendingBalance = 0;
        info.totalClaimed += amount;
        totalPending -= amount;

        usdc.safeTransfer(wallet, amount);

        emit TipsClaimed(normalizedHandle, normalizedHandle, wallet, amount, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    function getPendingBalance(string calldata handle) external view returns (uint256) {
        return handles[_normalizeHandle(handle)].pendingBalance;
    }

    function getHandleInfo(string calldata handle) external view returns (HandleInfo memory) {
        return handles[_normalizeHandle(handle)];
    }

    function getTipCount(string calldata handle) external view returns (uint256) {
        return handles[_normalizeHandle(handle)].tipCount;
    }

    function getTipHistory(
        string calldata handle,
        uint256 offset,
        uint256 limit
    ) external view returns (Tip[] memory tips) {
        string memory normalizedHandle = _normalizeHandle(handle);
        Tip[] storage allTips = tipHistory[normalizedHandle];

        if (offset >= allTips.length) {
            return new Tip[](0);
        }

        // saturating: offset < length here, so length - offset never underflows
        uint256 end = limit >= allTips.length - offset ? allTips.length : offset + limit;

        tips = new Tip[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            tips[i - offset] = allTips[i];
        }
    }

    function getLinkedWallet(string calldata handle) external view returns (address) {
        return handles[_normalizeHandle(handle)].linkedWallet;
    }

    function isHandleRegistered(string calldata handle) external view returns (bool) {
        return handles[_normalizeHandle(handle)].isRegistered;
    }

    /// @notice EIP-712 domain separator (for off-chain signer verification)
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS (owner = Admin Safe 2-of-3)
    // ═══════════════════════════════════════════════════════════════════════

    function setOracleSigner(address _newSigner) external onlyOwner {
        if (_newSigner == address(0)) revert ZeroAddress();
        address oldSigner = oracleSigner;
        oracleSigner = _newSigner;
        emit OracleSignerUpdated(oldSigner, _newSigner);
    }

    /// @notice Set the pause guardian (zero address disables the role)
    function setGuardian(address _newGuardian) external onlyOwner {
        address oldGuardian = guardian;
        guardian = _newGuardian;
        emit GuardianUpdated(oldGuardian, _newGuardian);
    }

    function setPlatformFee(uint256 _newFeeBps) external onlyOwner {
        if (_newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        uint256 oldFee = platformFeeBps;
        platformFeeBps = _newFeeBps;
        emit PlatformFeeUpdated(oldFee, _newFeeBps);
    }

    /// @notice Set the minimum tip (6-decimal units). Must be > 0: a zero minimum would
    ///         allow zero-amount tips (free tipHistory/event spam, zero-value USDC transfers).
    function setMinTipAmount(uint256 _newMinAmount) external onlyOwner {
        if (_newMinAmount == 0) revert InvalidAmount();
        uint256 oldAmount = minTipAmount;
        minTipAmount = _newMinAmount;
        emit MinTipAmountUpdated(oldAmount, _newMinAmount);
    }

    /// @notice Set the fee recipient. Also the recovery path if the current recipient
    ///         becomes Circle-blocklisted (withdrawFees/sweep would revert until changed).
    function setFeeRecipient(address _newRecipient) external onlyOwner {
        if (_newRecipient == address(0)) revert ZeroAddress();
        if (_newRecipient == address(this)) revert InvalidRecipient();
        address oldRecipient = feeRecipient;
        feeRecipient = _newRecipient;
        emit FeeRecipientUpdated(oldRecipient, _newRecipient);
    }

    /**
     * @notice Emergency stop: halts tip() and claimTips(). Guardian or owner.
     * @dev The guardian can freeze but can never move funds or change config.
     */
    function pause() external {
        if (msg.sender != guardian && msg.sender != owner()) revert NotAuthorized();
        _pause();
    }

    /// @notice Resume operations. Owner (2-of-3) only.
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Disabled. Renouncing would leave the contract with no owner forever:
     *         no unpause, no oracle rotation, no relink, no fee-recipient recovery.
     *         Ownership can only move via the two-step transfer/accept flow.
     */
    function renounceOwnership() public pure override {
        revert OwnershipCannotBeRenounced();
    }

    /**
     * @notice Withdraw accrued platform fees to feeRecipient.
     * @dev Callable by owner or feeRecipient only (S-5).
     */
    function withdrawFees() external nonReentrant {
        if (msg.sender != owner() && msg.sender != feeRecipient) revert NotAuthorized();
        uint256 amount = totalFeesCollected;
        if (amount == 0) revert NothingToWithdraw();
        totalFeesCollected = 0;
        usdc.safeTransfer(feeRecipient, amount);
        emit FeesWithdrawn(feeRecipient, amount);
    }

    /**
     * @notice Recovery for a registered handle whose wallet is lost/changed hands.
     * @dev Owner (Admin Safe 2-of-3) only — governance procedure in threat model §4.
     *      Redirects FUTURE claims; never moves existing funds by itself.
     */
    function adminRelinkWallet(string calldata handle, address newWallet) external onlyOwner {
        string memory normalizedHandle = _normalizeHandle(handle);
        if (bytes(normalizedHandle).length == 0) revert InvalidHandle();
        if (newWallet == address(0)) revert ZeroAddress();

        HandleInfo storage info = handles[normalizedHandle];
        if (!info.isRegistered) revert HandleNotRegistered();

        address oldWallet = info.linkedWallet;
        info.linkedWallet = newWallet;
        emit WalletRelinked(normalizedHandle, normalizedHandle, oldWallet, newWallet);
    }

    /**
     * @notice Sweep USDC sent directly to the contract (outside tip()) to feeRecipient.
     * @dev Arithmetically can never touch escrow: only balance above
     *      totalPending + totalFeesCollected is sweepable (S-6).
     */
    function sweepExcessUSDC() external onlyOwner nonReentrant {
        uint256 balance = usdc.balanceOf(address(this));
        uint256 liabilities = totalPending + totalFeesCollected;
        if (balance <= liabilities) revert NothingToSweep();
        uint256 excess = balance - liabilities;
        usdc.safeTransfer(feeRecipient, excess);
        emit ExcessSwept(feeRecipient, excess);
    }

    /**
     * @notice Rescue non-USDC tokens accidentally sent here, to feeRecipient.
     */
    function rescueToken(address token) external onlyOwner nonReentrant {
        if (token == address(usdc)) revert CannotRescueUSDC();
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance == 0) revert NothingToSweep();
        IERC20(token).safeTransfer(feeRecipient, balance);
        emit TokenRescued(token, feeRecipient, balance);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Normalize an X handle: lowercase; only a-z, 0-9, _; 1–15 chars.
     * @return Normalized handle, or empty string if invalid.
     */
    function _normalizeHandle(string memory handle) internal pure returns (string memory) {
        bytes memory b = bytes(handle);
        if (b.length == 0 || b.length > 15) return "";

        bytes memory result = new bytes(b.length);
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 char = b[i];
            if (char >= 0x41 && char <= 0x5A) {
                result[i] = bytes1(uint8(char) + 32); // A-Z -> a-z
            } else if (
                (char >= 0x61 && char <= 0x7A) || // a-z
                (char >= 0x30 && char <= 0x39) || // 0-9
                char == 0x5F // underscore
            ) {
                result[i] = char;
            } else {
                return "";
            }
        }
        return string(result);
    }
}
