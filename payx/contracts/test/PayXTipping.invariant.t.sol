// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {PayXTipping} from "../src/PayXTipping.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

/**
 * @title PayXTipping v2 handler-based invariant suite (audit 2026-09-15)
 *
 * Actors driven by the handler: 3 tippers, 4 claim wallets, owner (Admin Safe),
 * guardian, feeRecipient (Treasury Safe), 2 oracle keys (rotation), a rando.
 * Handles: 5 fixed lowercase keys, tipped/claimed through random-case variants
 * so normalization is exercised on every entry point.
 *
 * foundry.toml [invariant]: runs=256, depth=50, fail_on_revert=true — every
 * handler bounds its inputs and declares the reverts it expects, so ANY other
 * revert is a real finding.
 */
contract PayXHandler is Test {
    PayXTipping public payx;
    MockUSDC public usdc;

    address public owner;
    address public guardian;
    address public feeRecipient;
    address public constant RANDO = address(0xBAD);

    uint256[2] internal oraclePks;
    uint256 public activeOracle; // index into oraclePks

    address[] public tippers;
    address[] public wallets;
    string[] public handles;

    // ── ghost state ──────────────────────────────────────────────────────────
    bytes32[] public ghostNonces;              // every nonce consumed by a successful claim
    uint256 public ghostClaims;
    uint256 public ghostTipsGross;             // sum of `amount` passed to tip()
    uint256 public ghostDonated;               // USDC minted straight to the contract
    uint256 public ghostSwept;
    uint256 public ghostFeesWithdrawn;
    uint256 public ghostNonceCounter;
    bool public ghostPendingDecreasedOutsideClaim;
    uint256 public ghostTipsWhilePaused;       // must stay 0
    uint256 public ghostClaimsWhilePaused;     // must stay 0

    bytes32 internal constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 internal constant CLAIM_TYPEHASH = keccak256("Claim(string handle,address wallet,bytes32 nonce)");

    constructor(
        PayXTipping _payx,
        MockUSDC _usdc,
        address _owner,
        address _guardian,
        address _feeRecipient,
        uint256 _pk0,
        uint256 _pk1
    ) {
        payx = _payx;
        usdc = _usdc;
        owner = _owner;
        guardian = _guardian;
        feeRecipient = _feeRecipient;
        oraclePks[0] = _pk0;
        oraclePks[1] = _pk1;

        tippers.push(address(0x7100));
        tippers.push(address(0x7200));
        tippers.push(address(0x7300));
        wallets.push(address(0xC100));
        wallets.push(address(0xC200));
        wallets.push(address(0xC300));
        wallets.push(address(0xC400));
        handles.push("alpha");
        handles.push("bravo_1");
        handles.push("charlie22");
        handles.push("_delta_");
        handles.push("abcdefghijklmno"); // 15 chars: X maximum
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    function handlesLength() external view returns (uint256) { return handles.length; }
    function ghostNoncesLength() external view returns (uint256) { return ghostNonces.length; }

    /// Random-case variant of a lowercase handle (exercises on-chain normalization).
    function _variant(string memory key, uint256 seed) internal pure returns (string memory) {
        bytes memory b = abi.encodePacked(key); // copy: bytes(key) would alias and mutate `key`
        for (uint256 i = 0; i < b.length; i++) {
            if (((seed >> i) & 1) == 1 && b[i] >= 0x61 && b[i] <= 0x7A) b[i] = bytes1(uint8(b[i]) - 32);
        }
        return string(b);
    }

    function _sign(uint256 pk, string memory normalizedHandle, address wallet, bytes32 nonce)
        internal
        view
        returns (bytes memory)
    {
        bytes32 domain = keccak256(
            abi.encode(DOMAIN_TYPEHASH, keccak256(bytes("PayX")), keccak256(bytes("2")), block.chainid, address(payx))
        );
        bytes32 structHash = keccak256(abi.encode(CLAIM_TYPEHASH, keccak256(bytes(normalizedHandle)), wallet, nonce));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domain, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _snapshot() internal view returns (uint256[] memory snap) {
        snap = new uint256[](handles.length + 1);
        for (uint256 i = 0; i < handles.length; i++) snap[i] = payx.getPendingBalance(handles[i]);
        snap[handles.length] = payx.totalPending();
    }

    /// Every handler action EXCEPT claim() runs under this: no pendingBalance
    /// (per handle or total) may go down.
    modifier guardPending() {
        uint256[] memory before = _snapshot();
        _;
        uint256[] memory after_ = _snapshot();
        for (uint256 i = 0; i < after_.length; i++) {
            if (after_[i] < before[i]) ghostPendingDecreasedOutsideClaim = true;
        }
    }

    // ── tipper actions ───────────────────────────────────────────────────────

    function tip(uint256 tSeed, uint256 hSeed, uint256 amount, uint256 msgLen, uint256 caseSeed)
        external
        guardPending
    {
        address tipper = tippers[tSeed % tippers.length];
        string memory key = handles[hSeed % handles.length];
        string memory h = _variant(key, caseSeed);
        amount = bound(amount, payx.minTipAmount(), 1_000_000e6);
        msgLen = bound(msgLen, 0, payx.MAX_MESSAGE_BYTES());
        string memory message = string(new bytes(msgLen));

        usdc.mint(tipper, amount);
        vm.startPrank(tipper);
        usdc.approve(address(payx), amount);
        if (payx.paused()) {
            vm.expectRevert(Pausable.EnforcedPause.selector);
            payx.tip(h, amount, message);
            vm.stopPrank();
            return;
        }
        uint256 fee = (amount * payx.platformFeeBps()) / 10000;
        uint256 pendingBefore = payx.getPendingBalance(key);
        uint256 feesBefore = payx.totalFeesCollected();
        payx.tip(h, amount, message);
        vm.stopPrank();

        assertEq(payx.getPendingBalance(key), pendingBefore + amount - fee, "net credited");
        assertEq(payx.totalFeesCollected(), feesBefore + fee, "fee credited");
        ghostTipsGross += amount;
    }

    function tipOversizedMessageReverts(uint256 tSeed, uint256 extra) external guardPending {
        address tipper = tippers[tSeed % tippers.length];
        extra = bound(extra, 1, 2000);
        uint256 amount = payx.minTipAmount();
        usdc.mint(tipper, amount);
        vm.startPrank(tipper);
        usdc.approve(address(payx), amount);
        string memory tooLong = string(new bytes(payx.MAX_MESSAGE_BYTES() + extra));
        if (payx.paused()) vm.expectRevert(Pausable.EnforcedPause.selector);
        else vm.expectRevert(PayXTipping.MessageTooLong.selector);
        payx.tip(handles[0], amount, tooLong);
        vm.stopPrank();
    }

    // ── claimer actions ──────────────────────────────────────────────────────

    /// Legit claim: current oracle signs (normalized handle, pinned-or-chosen wallet, fresh nonce);
    /// a third party (RANDO) submits it; funds must land in `wallet`. Then replay must fail.
    function claim(uint256 hSeed, uint256 wSeed, uint256 nSeed, uint256 caseSeed) external {
        string memory key = handles[hSeed % handles.length];
        string memory h = _variant(key, caseSeed);
        PayXTipping.HandleInfo memory info = payx.getHandleInfo(key);
        address wallet = info.isRegistered ? info.linkedWallet : wallets[wSeed % wallets.length];
        bytes32 nonce = keccak256(abi.encode(nSeed, ghostNonceCounter++));
        bytes memory sig = _sign(oraclePks[activeOracle], key, wallet, nonce);

        if (payx.paused()) {
            vm.expectRevert(Pausable.EnforcedPause.selector);
            payx.claimTips(h, wallet, nonce, sig);
            return;
        }
        if (info.pendingBalance == 0) {
            vm.expectRevert(PayXTipping.NoTipsToClaim.selector);
            payx.claimTips(h, wallet, nonce, sig);
            return;
        }

        uint256 walletBefore = usdc.balanceOf(wallet);
        uint256 randoBefore = usdc.balanceOf(RANDO);
        uint256 totalBefore = payx.totalPending();
        vm.prank(RANDO);
        payx.claimTips(h, wallet, nonce, sig);

        assertEq(usdc.balanceOf(wallet) - walletBefore, info.pendingBalance, "wallet paid in full");
        assertEq(usdc.balanceOf(RANDO), randoBefore, "submitter gets nothing");
        assertEq(payx.getPendingBalance(key), 0, "pending zeroed");
        assertEq(payx.totalPending(), totalBefore - info.pendingBalance, "liability reduced");
        assertEq(payx.getLinkedWallet(key), wallet, "wallet pinned");
        assertTrue(payx.isHandleRegistered(key));
        ghostNonces.push(nonce);
        ghostClaims++;

        // replay of the very same authorization must be dead
        vm.expectRevert(PayXTipping.NonceAlreadyUsed.selector);
        payx.claimTips(h, wallet, nonce, sig);
    }

    /// Oracle signs for a wallet other than the pinned one (hijacked X session) — must never pay.
    function claimWrongWallet(uint256 hSeed, uint256 nSeed) external guardPending {
        string memory key = handles[hSeed % handles.length];
        PayXTipping.HandleInfo memory info = payx.getHandleInfo(key);
        if (!info.isRegistered) return;
        address wrong = address(0xDEAD);
        bytes32 nonce = keccak256(abi.encode("wrong", nSeed, ghostNonceCounter++));
        bytes memory sig = _sign(oraclePks[activeOracle], key, wrong, nonce);

        if (payx.paused()) vm.expectRevert(Pausable.EnforcedPause.selector);
        else if (info.pendingBalance == 0) vm.expectRevert(PayXTipping.NoTipsToClaim.selector);
        else vm.expectRevert(PayXTipping.WalletMismatch.selector);
        payx.claimTips(key, wrong, nonce, sig);
    }

    /// Signature by the INACTIVE (rotated-out) oracle key must never pay.
    function claimWithRotatedOutKey(uint256 hSeed, uint256 wSeed, uint256 nSeed) external guardPending {
        string memory key = handles[hSeed % handles.length];
        address wallet = wallets[wSeed % wallets.length];
        bytes32 nonce = keccak256(abi.encode("stale", nSeed, ghostNonceCounter++));
        bytes memory sig = _sign(oraclePks[1 - activeOracle], key, wallet, nonce);
        if (payx.paused()) vm.expectRevert(Pausable.EnforcedPause.selector);
        else vm.expectRevert(PayXTipping.InvalidSignature.selector);
        payx.claimTips(key, wallet, nonce, sig);
    }

    // ── guardian / owner actions ─────────────────────────────────────────────

    function pause(uint256 seed) external guardPending {
        address who = seed % 2 == 0 ? guardian : owner;
        bool wasPaused = payx.paused();
        vm.prank(who);
        if (wasPaused) vm.expectRevert(Pausable.EnforcedPause.selector);
        payx.pause();
    }

    function unpause() external guardPending {
        bool wasPaused = payx.paused();
        vm.prank(owner);
        if (!wasPaused) vm.expectRevert(Pausable.ExpectedPause.selector);
        payx.unpause();
    }

    function setFee(uint256 bps) external guardPending {
        bps = bound(bps, 0, payx.MAX_FEE_BPS());
        vm.prank(owner);
        payx.setPlatformFee(bps);
    }

    function setMinTip(uint256 amt) external guardPending {
        amt = bound(amt, 1, 5e6);
        vm.prank(owner);
        payx.setMinTipAmount(amt);
    }

    function rotateOracle() external guardPending {
        activeOracle = 1 - activeOracle;
        vm.prank(owner);
        payx.setOracleSigner(vm.addr(oraclePks[activeOracle]));
    }

    function withdrawFees(uint256 seed) external guardPending {
        address who = seed % 2 == 0 ? owner : feeRecipient;
        uint256 fees = payx.totalFeesCollected();
        uint256 before = usdc.balanceOf(feeRecipient);
        vm.prank(who);
        if (fees == 0) {
            vm.expectRevert(PayXTipping.NothingToWithdraw.selector);
            payx.withdrawFees();
            return;
        }
        payx.withdrawFees();
        assertEq(usdc.balanceOf(feeRecipient) - before, fees);
        assertEq(payx.totalFeesCollected(), 0);
        ghostFeesWithdrawn += fees;
    }

    function donate(uint256 amount) external guardPending {
        amount = bound(amount, 1, 1_000e6);
        usdc.mint(address(payx), amount);
        ghostDonated += amount;
    }

    function sweep() external guardPending {
        uint256 balance = usdc.balanceOf(address(payx));
        uint256 liabilities = payx.totalPending() + payx.totalFeesCollected();
        uint256 before = usdc.balanceOf(feeRecipient);
        vm.prank(owner);
        if (balance <= liabilities) {
            vm.expectRevert(PayXTipping.NothingToSweep.selector);
            payx.sweepExcessUSDC();
            return;
        }
        payx.sweepExcessUSDC();
        assertEq(usdc.balanceOf(feeRecipient) - before, balance - liabilities);
        assertEq(usdc.balanceOf(address(payx)), liabilities, "escrow+fees untouched");
        ghostSwept += balance - liabilities;
    }

    function relink(uint256 hSeed, uint256 wSeed) external guardPending {
        string memory key = handles[hSeed % handles.length];
        address newWallet = wallets[wSeed % wallets.length];
        bool registered = payx.isHandleRegistered(key);
        uint256 pending = payx.getPendingBalance(key);
        uint256 balance = usdc.balanceOf(address(payx));
        vm.prank(owner);
        if (!registered) {
            vm.expectRevert(PayXTipping.HandleNotRegistered.selector);
            payx.adminRelinkWallet(key, newWallet);
            return;
        }
        payx.adminRelinkWallet(key, newWallet);
        assertEq(payx.getPendingBalance(key), pending, "relink never moves funds");
        assertEq(usdc.balanceOf(address(payx)), balance, "relink never moves funds");
        assertEq(payx.getLinkedWallet(key), newWallet);
    }

    function renounceIsDisabled() external guardPending {
        vm.prank(owner);
        vm.expectRevert(PayXTipping.OwnershipCannotBeRenounced.selector);
        payx.renounceOwnership();
    }

    // ── unauthorized actors ──────────────────────────────────────────────────

    function randoCannotAdmin(uint256 seed) external guardPending {
        uint256 k = seed % 8;
        bytes memory notOwner = abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, RANDO);
        vm.startPrank(RANDO);
        if (k == 0) { vm.expectRevert(PayXTipping.NotAuthorized.selector); payx.pause(); }
        else if (k == 1) { vm.expectRevert(notOwner); payx.unpause(); }
        else if (k == 2) { vm.expectRevert(PayXTipping.NotAuthorized.selector); payx.withdrawFees(); }
        else if (k == 3) { vm.expectRevert(notOwner); payx.sweepExcessUSDC(); }
        else if (k == 4) { vm.expectRevert(notOwner); payx.adminRelinkWallet(handles[0], RANDO); }
        else if (k == 5) { vm.expectRevert(notOwner); payx.setOracleSigner(RANDO); }
        else if (k == 6) { vm.expectRevert(notOwner); payx.setFeeRecipient(RANDO); }
        else { vm.expectRevert(notOwner); payx.acceptOwnership(); }
        vm.stopPrank();
    }

    function guardianCannotMoveFundsOrConfigure(uint256 seed) external guardPending {
        uint256 k = seed % 5;
        bytes memory notOwner = abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, guardian);
        vm.startPrank(guardian);
        if (k == 0) { vm.expectRevert(PayXTipping.NotAuthorized.selector); payx.withdrawFees(); }
        else if (k == 1) { vm.expectRevert(notOwner); payx.sweepExcessUSDC(); }
        else if (k == 2) { vm.expectRevert(notOwner); payx.unpause(); }
        else if (k == 3) { vm.expectRevert(notOwner); payx.setOracleSigner(guardian); }
        else { vm.expectRevert(notOwner); payx.adminRelinkWallet(handles[0], guardian); }
        vm.stopPrank();
    }
}

contract PayXTippingInvariantTest is Test {
    PayXTipping public payx;
    MockUSDC public usdc;
    PayXHandler public handler;

    address public owner = address(0xA11CE);
    address public feeRecipient = address(0xFEE);
    address public guardian = address(0x6A2D);
    uint256 public constant PK0 = 0xA11CE0FACE5EED0000000000000000000000000000000000000000000000AA01;
    uint256 public constant PK1 = 0xA11CE0FACE5EED0000000000000000000000000000000000000000000000AA02;

    function setUp() public {
        vm.chainId(5042);
        vm.startPrank(owner);
        usdc = new MockUSDC();
        payx = new PayXTipping(address(usdc), vm.addr(PK0), feeRecipient, 100, 100000);
        payx.setGuardian(guardian);
        vm.stopPrank();

        handler = new PayXHandler(payx, usdc, owner, guardian, feeRecipient, PK0, PK1);
        targetContract(address(handler));
    }

    /// balance >= escrow liability + accrued fees, under every path.
    function invariant_Solvency() public view {
        assertGe(usdc.balanceOf(address(payx)), payx.totalPending() + payx.totalFeesCollected());
    }

    /// Stronger: balance is EXACTLY liabilities + un-swept donations. Nothing leaks, nothing appears.
    function invariant_ExactAccounting() public view {
        assertEq(
            usdc.balanceOf(address(payx)),
            payx.totalPending() + payx.totalFeesCollected() + handler.ghostDonated() - handler.ghostSwept()
        );
    }

    /// sum over handles of pendingBalance == totalPending.
    function invariant_SumOfPendingEqualsTotalPending() public view {
        uint256 sum;
        uint256 n = handler.handlesLength();
        for (uint256 i = 0; i < n; i++) sum += payx.getPendingBalance(handler.handles(i));
        assertEq(sum, payx.totalPending());
    }

    /// per handle: totalReceived == totalClaimed + pendingBalance.
    function invariant_PerHandleConservation() public view {
        uint256 n = handler.handlesLength();
        for (uint256 i = 0; i < n; i++) {
            PayXTipping.HandleInfo memory info = payx.getHandleInfo(handler.handles(i));
            assertEq(info.totalReceived, info.totalClaimed + info.pendingBalance);
            // registered <=> a wallet is pinned; never registered without a wallet
            assertEq(info.isRegistered, info.linkedWallet != address(0));
        }
    }

    /// Every nonce that ever authorized a payout is permanently burned; one payout per nonce.
    function invariant_NoncesNeverReused() public view {
        uint256 n = handler.ghostNoncesLength();
        assertEq(n, handler.ghostClaims());
        for (uint256 i = 0; i < n; i++) assertTrue(payx.usedNonces(handler.ghostNonces(i)));
    }

    /// No path other than claimTips ever decreases a handle's pendingBalance (or totalPending).
    function invariant_PendingOnlyDecreasesViaClaim() public view {
        assertFalse(handler.ghostPendingDecreasedOutsideClaim());
    }

    /// Everything the Treasury ever received came from fees or swept excess — never escrow.
    function invariant_FeeRecipientOnlyGetsFeesAndExcess() public view {
        assertEq(usdc.balanceOf(feeRecipient), handler.ghostFeesWithdrawn() + handler.ghostSwept());
    }

    /// Gross tips in == everything accounted for (escrow + claimed + fees accrued + fees withdrawn).
    function invariant_GrossTipsFullyAccounted() public view {
        uint256 claimed;
        uint256 n = handler.handlesLength();
        for (uint256 i = 0; i < n; i++) claimed += payx.getHandleInfo(handler.handles(i)).totalClaimed;
        assertEq(
            handler.ghostTipsGross(),
            payx.totalPending() + claimed + payx.totalFeesCollected() + handler.ghostFeesWithdrawn()
        );
    }

    /// Config bounds and governance never drift: fee <= cap, minTip > 0, owner fixed, oracle is one of the two keys.
    function invariant_ConfigBounds() public view {
        assertLe(payx.platformFeeBps(), payx.MAX_FEE_BPS());
        assertGt(payx.minTipAmount(), 0);
        assertEq(payx.owner(), owner);
        assertEq(payx.pendingOwner(), address(0));
        assertEq(payx.guardian(), guardian);
        assertEq(payx.feeRecipient(), feeRecipient);
        address o = payx.oracleSigner();
        assertTrue(o == vm.addr(PK0) || o == vm.addr(PK1));
    }

    /// Pause only ever gates tip/claim (handlers assert the reverts); nothing succeeded while paused.
    function invariant_PauseBlocksOnlyTipAndClaim() public view {
        assertEq(handler.ghostTipsWhilePaused(), 0);
        assertEq(handler.ghostClaimsWhilePaused(), 0);
    }
}
