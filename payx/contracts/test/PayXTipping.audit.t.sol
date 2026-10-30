// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, Vm} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {PayXTipping} from "../src/PayXTipping.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

/**
 * @title 6-dp USDC mock with Circle/Arc blocklist semantics (tests only)
 * @dev On Arc mainnet a transfer to OR from a blocklisted address reverts
 *      (verified on-chain 2026-08-04). This mock reproduces exactly that.
 */
contract BlocklistUSDC is ERC20 {
    error Blocklisted(address account);

    mapping(address => bool) public blocklisted;

    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setBlocklisted(address account, bool value) external {
        blocklisted[account] = value;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (blocklisted[from]) revert Blocklisted(from);
        if (blocklisted[to]) revert Blocklisted(to);
        super._update(from, to, value);
    }
}

/**
 * @title Audit gap tests (docs/07-PAYX-AUDIT-2026-09-15.md)
 * @notice Every test here corresponds to a finding or an explicitly verified property
 *         from the pre-deploy review. Tests prefixed TrustModel_/Accepted_ document
 *         behaviour that is intentional or an accepted risk — they pin it so a future
 *         change cannot silently alter it.
 */
contract PayXTippingAuditTest is Test {
    PayXTipping public payX;
    BlocklistUSDC public usdc;

    address public owner = address(0xA11CE);
    address public feeRecipient = address(0xFEE);
    address public guardian = address(0x6A2D);
    address public tipper = address(0x71BB);
    address public creator = address(0xC2EA);
    address public rando = address(0xBAD);

    uint256 public constant ORACLE_PK = 0xA11CE0FACE5EED0000000000000000000000000000000000000000000000AA01;
    uint256 public constant ATTACKER_PK = 0xA11CE0FACE5EED0000000000000000000000000000000000000000000000BAD1;
    address public oracle;

    uint256 public constant FEE_BPS = 100;
    uint256 public constant MIN_TIP = 100000;
    uint256 public constant ONE_USDC = 1e6;
    uint256 internal constant SECP256K1_N =
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    bytes32 internal constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 internal constant CLAIM_TYPEHASH = keccak256("Claim(string handle,address wallet,bytes32 nonce)");

    event TipSent(
        string indexed handleHash,
        string handle,
        address indexed tipper,
        uint256 amount,
        uint256 fee,
        string message,
        uint256 timestamp
    );

    function setUp() public {
        vm.chainId(5042);
        oracle = vm.addr(ORACLE_PK);

        vm.startPrank(owner);
        usdc = new BlocklistUSDC();
        payX = new PayXTipping(address(usdc), oracle, feeRecipient, FEE_BPS, MIN_TIP);
        payX.setGuardian(guardian);
        vm.stopPrank();

        usdc.mint(tipper, 1_000_000 * ONE_USDC);
        vm.prank(tipper);
        usdc.approve(address(payX), type(uint256).max);
    }

    // ─── helpers ────────────────────────────────────────────────────────────

    function _digest(string memory handle, address wallet, bytes32 nonce) internal view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(CLAIM_TYPEHASH, keccak256(bytes(handle)), wallet, nonce));
        return keccak256(abi.encodePacked("\x19\x01", payX.domainSeparator(), structHash));
    }

    function _signWith(uint256 pk, string memory handle, address wallet, bytes32 nonce)
        internal
        view
        returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, _digest(handle, wallet, nonce));
        return abi.encodePacked(r, s, v);
    }

    function _sign(string memory handle, address wallet, bytes32 nonce) internal view returns (bytes memory) {
        return _signWith(ORACLE_PK, handle, wallet, nonce);
    }

    function _tip(string memory handle, uint256 amount) internal {
        vm.prank(tipper);
        payX.tip(handle, amount, "");
    }

    function _claim(string memory handle, address wallet, string memory nonceSeed) internal {
        bytes32 nonce = keccak256(bytes(nonceSeed));
        payX.claimTips(handle, wallet, nonce, _sign(handle, wallet, nonce));
    }

    function _assertSolvent() internal view {
        assertGe(usdc.balanceOf(address(payX)), payX.totalPending() + payX.totalFeesCollected(), "solvency");
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Handle normalization edge cases
    // ═══════════════════════════════════════════════════════════════════════

    function test_Handle_NonAsciiBytesRejected() public {
        vm.startPrank(tipper);
        vm.expectRevert(PayXTipping.InvalidHandle.selector);
        payX.tip(unicode"élon", ONE_USDC, ""); // UTF-8 multibyte (0xC3 0xA9)
        bytes memory loneHigh = hex"80";
        bytes memory elonFF = hex"656c6f6eff"; // "elon" + 0xFF
        bytes memory elonNul = hex"656c6f6e00"; // "elon" + NUL
        vm.expectRevert(PayXTipping.InvalidHandle.selector);
        payX.tip(string(loneHigh), ONE_USDC, "");
        vm.expectRevert(PayXTipping.InvalidHandle.selector);
        payX.tip(string(elonFF), ONE_USDC, "");
        vm.expectRevert(PayXTipping.InvalidHandle.selector);
        payX.tip(string(elonNul), ONE_USDC, "");
        vm.expectRevert(PayXTipping.InvalidHandle.selector);
        payX.tip("elon musk", ONE_USDC, ""); // space
        vm.expectRevert(PayXTipping.InvalidHandle.selector);
        payX.tip("elon-musk", ONE_USDC, ""); // hyphen
        vm.expectRevert(PayXTipping.InvalidHandle.selector);
        payX.tip("@elonmusk", ONE_USDC, ""); // leading @ is NOT stripped on-chain
        vm.expectRevert(PayXTipping.InvalidHandle.selector);
        payX.tip(unicode"elonmusk🚀", ONE_USDC, "");
        vm.stopPrank();
    }

    function test_Handle_SixteenCharsRejectedEvenWithUppercase() public {
        vm.startPrank(tipper);
        vm.expectRevert(PayXTipping.InvalidHandle.selector);
        payX.tip("ABCDEFGHIJKLMNOP", ONE_USDC, ""); // 16
        payX.tip("ABCDEFGHIJKLMNO", ONE_USDC, ""); // 15, uppercase
        vm.stopPrank();
        assertEq(payX.getPendingBalance("abcdefghijklmno"), ONE_USDC - ONE_USDC / 100);
        // invalid handles map to the empty bucket, which can never hold funds
        assertEq(payX.getPendingBalance("ABCDEFGHIJKLMNOP"), 0);
        assertEq(payX.getTipCount("ABCDEFGHIJKLMNOP"), 0);
        assertFalse(payX.isHandleRegistered("ABCDEFGHIJKLMNOP"));
        assertEq(payX.getTipHistory("ABCDEFGHIJKLMNOP", 0, 10).length, 0);
    }

    function test_Handle_UnderscoreOnlyAndDigitsOnlyAreValidDistinctBuckets() public {
        vm.startPrank(tipper);
        payX.tip("_", ONE_USDC, "");
        payX.tip("___", 2 * ONE_USDC, "");
        payX.tip("123", 3 * ONE_USDC, "");
        vm.stopPrank();
        assertEq(payX.getPendingBalance("_"), 990_000);
        assertEq(payX.getPendingBalance("___"), 1_980_000);
        assertEq(payX.getPendingBalance("123"), 2_970_000);
        assertEq(payX.totalPending(), 990_000 + 1_980_000 + 2_970_000);
    }

    function test_Handle_CaseInsensitiveAcrossAllEntryPoints() public {
        _tip("ELONMUSK", 10 * ONE_USDC);
        _tip("ElonMusk", 10 * ONE_USDC);
        _tip("elonmusk", 10 * ONE_USDC);
        assertEq(payX.getTipCount("eLoNmUsK"), 3);
        assertEq(payX.getPendingBalance("ELONMUSK"), 3 * 9_900_000);

        // claim via yet another casing; oracle signs the normalized form
        bytes32 n = keccak256("n");
        payX.claimTips("ElOnMuSk", creator, n, _sign("elonmusk", creator, n));
        assertEq(usdc.balanceOf(creator), 3 * 9_900_000);
        assertEq(payX.getLinkedWallet("ELONMUSK"), creator);

        // relink via mixed case hits the same record
        vm.prank(owner);
        payX.adminRelinkWallet("ELONmusk", rando);
        assertEq(payX.getLinkedWallet("elonmusk"), rando);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Message cap
    // ═══════════════════════════════════════════════════════════════════════

    function test_Message_CapIsBytesNotCharacters() public {
        // U+1F600 is 4 bytes in UTF-8: 70 of them = 280 bytes (ok), 71 = 284 bytes (revert)
        bytes memory seventy;
        for (uint256 i = 0; i < 70; i++) seventy = abi.encodePacked(seventy, unicode"😀");
        assertEq(seventy.length, 280);
        vm.startPrank(tipper);
        payX.tip("elonmusk", ONE_USDC, string(seventy));
        vm.expectRevert(PayXTipping.MessageTooLong.selector);
        payX.tip("elonmusk", ONE_USDC, string(abi.encodePacked(seventy, unicode"😀")));
        // ASCII boundary, 280 / 281
        payX.tip("elonmusk", ONE_USDC, string(new bytes(280)));
        vm.expectRevert(PayXTipping.MessageTooLong.selector);
        payX.tip("elonmusk", ONE_USDC, string(new bytes(281)));
        vm.stopPrank();
        PayXTipping.Tip[] memory tips = payX.getTipHistory("elonmusk", 0, 10);
        assertEq(tips.length, 2);
        assertEq(bytes(tips[0].message).length, 280);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Fee math, conservation, semantics
    // ═══════════════════════════════════════════════════════════════════════

    function test_Fee_RoundsDownInTipperFavour_ConservationExact() public {
        vm.prank(owner);
        payX.setPlatformFee(1); // 0.01%: exercises floor rounding hard
        uint256[4] memory amounts = [uint256(100_000), 109_999, 199_999, 1_234_567];
        uint256 expectFees;
        uint256 expectNet;
        vm.startPrank(tipper);
        for (uint256 i = 0; i < amounts.length; i++) {
            payX.tip("h", amounts[i], "");
            uint256 fee = (amounts[i] * 1) / 10000;
            expectFees += fee;
            expectNet += amounts[i] - fee;
        }
        vm.stopPrank();
        assertEq(payX.totalFeesCollected(), expectFees); // 10 + 10 + 19 + 123 = 162
        assertEq(payX.getPendingBalance("h"), expectNet);
        assertEq(payX.totalFeesCollected() + payX.totalPending(), usdc.balanceOf(address(payX)));
        assertEq(expectFees, 162);
    }

    function test_Fee_TipperTotalSentIsGross_EventAndEscrowAreNet() public {
        uint256 gross = 10 * ONE_USDC;
        uint256 fee = gross / 100;
        vm.expectEmit(true, true, false, true, address(payX));
        emit TipSent("elonmusk", "elonmusk", tipper, gross - fee, fee, "gm", block.timestamp);
        vm.prank(tipper);
        payX.tip("ElonMusk", gross, "gm");
        assertEq(payX.tipperTotalSent(tipper), gross, "gross");
        assertEq(payX.getPendingBalance("elonmusk"), gross - fee, "net");
        assertEq(payX.getTipHistory("elonmusk", 0, 1)[0].amount, gross - fee, "history stores net");
    }

    function test_Event_HandleHashTopicIsKeccakOfNormalizedHandle() public {
        vm.recordLogs();
        vm.prank(tipper);
        payX.tip("ElonMusk", ONE_USDC, "");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 sig = keccak256("TipSent(string,string,address,uint256,uint256,string,uint256)");
        bool found;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == sig) {
                found = true;
                assertEq(logs[i].topics[1], keccak256("elonmusk"), "indexer must filter on keccak(lowercase)");
                assertEq(logs[i].topics[2], bytes32(uint256(uint160(tipper))));
            }
        }
        assertTrue(found);
    }

    function test_Accepted_FeeChangeBeforeInclusionBoundedByMaxFee() public {
        // A tipper has no fee-slippage parameter; the worst case is the 5% cap.
        vm.prank(owner);
        payX.setPlatformFee(500);
        _tip("elonmusk", 100 * ONE_USDC);
        assertEq(payX.getPendingBalance("elonmusk"), 95 * ONE_USDC);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // withdrawFees / sweep / rescue
    // ═══════════════════════════════════════════════════════════════════════

    function test_WithdrawFees_ZeroReverts_NoZeroValueTransfer() public {
        vm.prank(owner);
        vm.expectRevert(PayXTipping.NothingToWithdraw.selector);
        payX.withdrawFees();
        vm.prank(feeRecipient);
        vm.expectRevert(PayXTipping.NothingToWithdraw.selector);
        payX.withdrawFees();

        _tip("elonmusk", 100 * ONE_USDC);
        vm.prank(feeRecipient);
        payX.withdrawFees();
        assertEq(usdc.balanceOf(feeRecipient), ONE_USDC);
        vm.prank(feeRecipient);
        vm.expectRevert(PayXTipping.NothingToWithdraw.selector);
        payX.withdrawFees(); // nothing accrued since
    }

    function test_Sweep_SecondSweepRevertsExactBalance() public {
        _tip("elonmusk", 10 * ONE_USDC);
        usdc.mint(address(payX), 3 * ONE_USDC);
        vm.startPrank(owner);
        payX.sweepExcessUSDC();
        vm.expectRevert(PayXTipping.NothingToSweep.selector);
        payX.sweepExcessUSDC();
        vm.stopPrank();
        assertEq(usdc.balanceOf(address(payX)), payX.totalPending() + payX.totalFeesCollected());
    }

    function test_Solvency_AcrossEveryPath() public {
        _tip("a", 10 * ONE_USDC);
        _tip("b", 5 * ONE_USDC);
        _assertSolvent();
        usdc.mint(address(payX), 1234);
        _assertSolvent();
        _claim("a", creator, "n1");
        _assertSolvent();
        vm.prank(owner);
        payX.withdrawFees();
        _assertSolvent();
        vm.prank(owner);
        payX.sweepExcessUSDC();
        _assertSolvent();
        assertEq(usdc.balanceOf(address(payX)), payX.totalPending()); // only b's escrow remains
        assertEq(payX.totalPending(), 4_950_000);
        _claim("b", rando, "n2");
        assertEq(usdc.balanceOf(address(payX)), 0);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Circle blocklist simulation
    // ═══════════════════════════════════════════════════════════════════════

    function test_Blocklist_FeeRecipientBricksWithdrawAndSweep_SetFeeRecipientRecovers() public {
        _tip("elonmusk", 100 * ONE_USDC);
        usdc.mint(address(payX), ONE_USDC); // some excess too
        usdc.setBlocklisted(feeRecipient, true);

        vm.startPrank(owner);
        vm.expectRevert(abi.encodeWithSelector(BlocklistUSDC.Blocklisted.selector, feeRecipient));
        payX.withdrawFees();
        vm.expectRevert(abi.encodeWithSelector(BlocklistUSDC.Blocklisted.selector, feeRecipient));
        payX.sweepExcessUSDC();
        // state untouched by the failed attempts
        assertEq(payX.totalFeesCollected(), ONE_USDC);

        // recovery: single owner call, then both paths work
        address treasury2 = address(0xF2EE);
        payX.setFeeRecipient(treasury2);
        payX.withdrawFees();
        payX.sweepExcessUSDC();
        vm.stopPrank();
        assertEq(usdc.balanceOf(treasury2), 2 * ONE_USDC);
        assertEq(payX.totalFeesCollected(), 0);
        // user escrow was never at risk
        assertEq(payX.getPendingBalance("elonmusk"), 99 * ONE_USDC);
        _assertSolvent();
    }

    function test_Blocklist_ClaimWalletBricksClaim_RelinkRecovers() public {
        _tip("elonmusk", 10 * ONE_USDC);
        _claim("elonmusk", creator, "n1"); // pins creator
        _tip("elonmusk", 5 * ONE_USDC);
        usdc.setBlocklisted(creator, true);

        bytes32 n2 = keccak256("n2");
        bytes memory sig2 = _sign("elonmusk", creator, n2);
        vm.expectRevert(abi.encodeWithSelector(BlocklistUSDC.Blocklisted.selector, creator));
        payX.claimTips("elonmusk", creator, n2, sig2);
        assertFalse(payX.usedNonces(n2), "failed claim burns nothing");
        assertEq(payX.getPendingBalance("elonmusk"), 4_950_000, "funds stay in escrow");

        address fresh = address(0xF4E5);
        vm.prank(owner);
        payX.adminRelinkWallet("elonmusk", fresh);
        _claim("elonmusk", fresh, "n3");
        assertEq(usdc.balanceOf(fresh), 4_950_000);
    }

    function test_Blocklist_TipperCannotTip() public {
        usdc.setBlocklisted(tipper, true);
        vm.prank(tipper);
        vm.expectRevert(abi.encodeWithSelector(BlocklistUSDC.Blocklisted.selector, tipper));
        payX.tip("elonmusk", ONE_USDC, "");
        assertEq(payX.totalPending(), 0);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Relink
    // ═══════════════════════════════════════════════════════════════════════

    function test_Relink_DoesNotMoveFunds_NewWalletClaimsEverythingAccrued() public {
        _tip("elonmusk", 10 * ONE_USDC);
        _claim("elonmusk", creator, "n1");
        _tip("elonmusk", 5 * ONE_USDC); // accrued before relink
        uint256 contractBefore = usdc.balanceOf(address(payX));
        uint256 creatorBefore = usdc.balanceOf(creator);
        uint256 pendingBefore = payX.getPendingBalance("elonmusk");
        uint256 totalBefore = payX.totalPending();

        address newWallet = address(0x11E1);
        vm.prank(owner);
        payX.adminRelinkWallet("elonmusk", newWallet);

        assertEq(usdc.balanceOf(address(payX)), contractBefore, "relink moved USDC");
        assertEq(usdc.balanceOf(creator), creatorBefore);
        assertEq(usdc.balanceOf(newWallet), 0);
        assertEq(payX.getPendingBalance("elonmusk"), pendingBefore);
        assertEq(payX.totalPending(), totalBefore);

        _tip("elonmusk", 2 * ONE_USDC); // accrued after relink
        _claim("elonmusk", newWallet, "n2");
        assertEq(usdc.balanceOf(newWallet), 4_950_000 + 1_980_000, "new wallet gets pre- and post-relink tips");
        assertEq(usdc.balanceOf(creator), creatorBefore, "old wallet gets nothing further");
    }

    function test_Relink_RequiresFreshOracleSignatureForNewWallet() public {
        _tip("elonmusk", 10 * ONE_USDC);
        _claim("elonmusk", creator, "n1");
        _tip("elonmusk", 5 * ONE_USDC);
        vm.prank(owner);
        payX.adminRelinkWallet("elonmusk", rando);
        // a signature for the OLD wallet is useless after relink
        bytes32 n2 = keccak256("n2");
        bytes memory sigOld = _sign("elonmusk", creator, n2);
        vm.expectRevert(PayXTipping.WalletMismatch.selector);
        payX.claimTips("elonmusk", creator, n2, sigOld);
        // and relink alone gives the new wallet nothing without the oracle
        bytes32 n3 = keccak256("n3");
        bytes memory sigForged = _signWith(ATTACKER_PK, "elonmusk", rando, n3);
        vm.expectRevert(PayXTipping.InvalidSignature.selector);
        payX.claimTips("elonmusk", rando, n3, sigForged);
    }

    /// TRUST MODEL (documented, not a bug): the owner controls oracleSigner, therefore a
    /// compromised 2-of-3 Admin Safe CAN redirect a registered handle's escrow in two
    /// transactions (setOracleSigner + adminRelinkWallet) plus one claim. Escrow security
    /// reduces to Safe signer security + event monitoring. Pinned here so nobody can claim
    /// otherwise in the docs.
    function test_TrustModel_CompromisedOwnerCanRedirectEscrowViaOracleRotationPlusRelink() public {
        _tip("elonmusk", 10 * ONE_USDC);
        _claim("elonmusk", creator, "n1");
        _tip("elonmusk", 50 * ONE_USDC);

        address attacker = vm.addr(ATTACKER_PK);
        vm.startPrank(owner); // = compromised Safe
        payX.setOracleSigner(attacker);
        payX.adminRelinkWallet("elonmusk", attacker);
        vm.stopPrank();

        bytes32 n = keccak256("steal");
        payX.claimTips("elonmusk", attacker, n, _signWith(ATTACKER_PK, "elonmusk", attacker, n));
        assertEq(usdc.balanceOf(attacker), 49_500_000);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Ownership
    // ═══════════════════════════════════════════════════════════════════════

    function test_RenounceOwnership_Disabled() public {
        vm.prank(owner);
        vm.expectRevert(PayXTipping.OwnershipCannotBeRenounced.selector);
        payX.renounceOwnership();
        vm.prank(rando);
        vm.expectRevert(PayXTipping.OwnershipCannotBeRenounced.selector);
        payX.renounceOwnership();
        assertEq(payX.owner(), owner);
        vm.prank(owner);
        payX.setPlatformFee(50); // admin still alive
        assertEq(payX.platformFeeBps(), 50);
    }

    function test_TransferOwnershipToZero_OnlyCancelsPending_NeverRenounces() public {
        vm.startPrank(owner);
        payX.transferOwnership(address(0x5AFE));
        assertEq(payX.pendingOwner(), address(0x5AFE));
        payX.transferOwnership(address(0));
        vm.stopPrank();
        assertEq(payX.pendingOwner(), address(0));
        assertEq(payX.owner(), owner);
    }

    function test_OwnershipHandoverWorksWhilePaused() public {
        vm.prank(guardian);
        payX.pause();
        vm.prank(owner);
        payX.transferOwnership(address(0x5AFE));
        vm.prank(address(0x5AFE));
        payX.acceptOwnership();
        assertEq(payX.owner(), address(0x5AFE));
        vm.prank(address(0x5AFE));
        payX.unpause();
        assertFalse(payX.paused());
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Claims: EIP-712, malleability, replay, third-party submission
    // ═══════════════════════════════════════════════════════════════════════

    function test_Claim_ThirdPartySubmitterDeliversToSignedWallet() public {
        _tip("elonmusk", 10 * ONE_USDC);
        bytes32 n = keccak256("n");
        bytes memory sig = _sign("elonmusk", creator, n);
        vm.prank(rando); // front-runner / relayer / anyone
        payX.claimTips("elonmusk", creator, n, sig);
        assertEq(usdc.balanceOf(creator), 9_900_000);
        assertEq(usdc.balanceOf(rando), 0);
        assertEq(payX.getLinkedWallet("elonmusk"), creator, "pinned to the SIGNED wallet, not msg.sender");
    }

    function test_Claim_SignatureOverUnnormalizedHandleFails() public {
        _tip("elonmusk", 10 * ONE_USDC);
        bytes32 n = keccak256("n");
        // oracle mistakenly signs the raw mixed-case handle
        bytes memory sigMixed = _sign("ElonMusk", creator, n);
        bytes memory sigAt = _sign("@elonmusk", creator, n);
        bytes memory sigSpace = _sign("elonmusk ", creator, n);
        vm.expectRevert(PayXTipping.InvalidSignature.selector);
        payX.claimTips("elonmusk", creator, n, sigMixed);
        vm.expectRevert(PayXTipping.InvalidSignature.selector);
        payX.claimTips("ElonMusk", creator, n, sigMixed);
        // or with a leading @ / trailing space
        vm.expectRevert(PayXTipping.InvalidSignature.selector);
        payX.claimTips("elonmusk", creator, n, sigAt);
        vm.expectRevert(PayXTipping.InvalidSignature.selector);
        payX.claimTips("elonmusk", creator, n, sigSpace);
        assertFalse(payX.usedNonces(n), "failed claims never burn the nonce");
    }

    function test_Claim_HighSMalleatedSignatureRejected() public {
        _tip("elonmusk", 10 * ONE_USDC);
        bytes32 n = keccak256("n");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ORACLE_PK, _digest("elonmusk", creator, n));
        bytes32 sHigh = bytes32(SECP256K1_N - uint256(s));
        uint8 vFlip = v == 27 ? 28 : 27;
        vm.expectRevert(abi.encodeWithSelector(ECDSA.ECDSAInvalidSignatureS.selector, sHigh));
        payX.claimTips("elonmusk", creator, n, abi.encodePacked(r, sHigh, vFlip));
        // the canonical one still works afterwards
        payX.claimTips("elonmusk", creator, n, abi.encodePacked(r, s, v));
    }

    function test_Claim_WrongLengthSignatureRejected() public {
        _tip("elonmusk", 10 * ONE_USDC);
        bytes32 n = keccak256("n");
        vm.expectRevert(abi.encodeWithSelector(ECDSA.ECDSAInvalidSignatureLength.selector, 64));
        payX.claimTips("elonmusk", creator, n, new bytes(64));
        vm.expectRevert(abi.encodeWithSelector(ECDSA.ECDSAInvalidSignatureLength.selector, 0));
        payX.claimTips("elonmusk", creator, n, "");
    }

    function test_Claim_NonceIsGlobalAcrossHandles() public {
        _tip("a", 10 * ONE_USDC);
        _tip("b", 10 * ONE_USDC);
        bytes32 n = keccak256("shared");
        payX.claimTips("a", creator, n, _sign("a", creator, n));
        bytes memory sigB = _sign("b", creator, n);
        vm.expectRevert(PayXTipping.NonceAlreadyUsed.selector);
        payX.claimTips("b", creator, n, sigB);
    }

    function test_Claim_OracleRotationInvalidatesOutstandingSignatures() public {
        _tip("elonmusk", 10 * ONE_USDC);
        bytes32 n = keccak256("n");
        bytes memory oldSig = _sign("elonmusk", creator, n);
        vm.prank(owner);
        payX.setOracleSigner(vm.addr(ATTACKER_PK)); // "rotate" to a new key
        vm.expectRevert(PayXTipping.InvalidSignature.selector);
        payX.claimTips("elonmusk", creator, n, oldSig);
        payX.claimTips("elonmusk", creator, n, _signWith(ATTACKER_PK, "elonmusk", creator, n));
        assertEq(usdc.balanceOf(creator), 9_900_000);
    }

    function test_Claim_ToContractItselfRejected() public {
        _tip("elonmusk", 10 * ONE_USDC);
        bytes32 n = keccak256("n");
        bytes memory sig = _sign("elonmusk", address(payX), n);
        vm.expectRevert(PayXTipping.InvalidRecipient.selector);
        payX.claimTips("elonmusk", address(payX), n, sig);
    }

    /// ACCEPTED RISK (Low): claim authorizations carry no deadline. A signature for an
    /// UNREGISTERED handle stays valid until its nonce is used or the oracle is rotated,
    /// and pays whatever has accrued by submission time. v3 candidate: `uint256 deadline`.
    function test_Accepted_StaleSignatureForUnregisteredHandleRemainsValid() public {
        _tip("elonmusk", 1 * ONE_USDC);
        bytes32 n = keccak256("old");
        bytes memory sig = _sign("elonmusk", creator, n);
        vm.warp(block.timestamp + 365 days);
        _tip("elonmusk", 99 * ONE_USDC);
        payX.claimTips("elonmusk", creator, n, sig);
        assertEq(usdc.balanceOf(creator), 99 * ONE_USDC); // 100 - 1%
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Config guards
    // ═══════════════════════════════════════════════════════════════════════

    function test_MinTip_ZeroRejectedInConstructorAndSetter() public {
        vm.expectRevert(PayXTipping.InvalidAmount.selector);
        new PayXTipping(address(usdc), oracle, feeRecipient, FEE_BPS, 0);
        vm.prank(owner);
        vm.expectRevert(PayXTipping.InvalidAmount.selector);
        payX.setMinTipAmount(0);
        vm.prank(owner);
        payX.setMinTipAmount(1);
        assertEq(payX.minTipAmount(), 1);
    }

    function test_SetFeeRecipient_ContractItselfRejected() public {
        vm.prank(owner);
        vm.expectRevert(PayXTipping.InvalidRecipient.selector);
        payX.setFeeRecipient(address(payX));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Pause matrix & guardian powers
    // ═══════════════════════════════════════════════════════════════════════

    function test_Pause_BlocksOnlyTipAndClaim_EverythingElseWorks() public {
        _tip("elonmusk", 10 * ONE_USDC);
        _claim("elonmusk", creator, "n1");
        _tip("elonmusk", 10 * ONE_USDC);
        usdc.mint(address(payX), ONE_USDC);
        MockUSDC other = new MockUSDC();
        other.mint(address(payX), 5);

        vm.prank(guardian);
        payX.pause();

        vm.prank(tipper);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        payX.tip("elonmusk", ONE_USDC, "");
        bytes32 n2 = keccak256("n2");
        bytes memory sig2 = _sign("elonmusk", creator, n2);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        payX.claimTips("elonmusk", creator, n2, sig2);

        vm.startPrank(owner);
        payX.withdrawFees();
        payX.sweepExcessUSDC();
        payX.rescueToken(address(other));
        payX.setOracleSigner(address(0x0AC1E));
        payX.setGuardian(address(0x6A2E));
        payX.setPlatformFee(0);
        payX.setMinTipAmount(1);
        payX.setFeeRecipient(address(0xF2EE));
        payX.adminRelinkWallet("elonmusk", rando);
        vm.stopPrank();
        assertTrue(payX.paused());
        assertEq(usdc.balanceOf(feeRecipient), 2 * ONE_USDC / 10 + ONE_USDC); // 0.2 fees + 1 excess
        _assertSolvent();
    }

    function test_Pause_DoublePauseAndSpuriousUnpauseRevert() public {
        vm.prank(owner);
        vm.expectRevert(Pausable.ExpectedPause.selector);
        payX.unpause();
        vm.prank(guardian);
        payX.pause();
        vm.prank(guardian);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        payX.pause();
        vm.prank(owner);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        payX.pause();
    }

    function test_Guardian_CanOnlyPause() public {
        _tip("elonmusk", 10 * ONE_USDC);
        bytes memory notOwner = abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, guardian);
        vm.startPrank(guardian);
        vm.expectRevert(PayXTipping.NotAuthorized.selector);
        payX.withdrawFees();
        vm.expectRevert(notOwner);
        payX.sweepExcessUSDC();
        vm.expectRevert(notOwner);
        payX.rescueToken(address(1));
        vm.expectRevert(notOwner);
        payX.setOracleSigner(guardian);
        vm.expectRevert(notOwner);
        payX.setFeeRecipient(guardian);
        vm.expectRevert(notOwner);
        payX.setGuardian(rando);
        vm.expectRevert(notOwner);
        payX.adminRelinkWallet("elonmusk", guardian);
        vm.expectRevert(notOwner);
        payX.transferOwnership(guardian);
        payX.pause();
        vm.expectRevert(notOwner);
        payX.unpause();
        vm.stopPrank();
        assertEq(usdc.balanceOf(guardian), 0);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Views / growth
    // ═══════════════════════════════════════════════════════════════════════

    function test_GetTipHistory_LimitOverflowSaturates() public {
        _tip("elonmusk", ONE_USDC);
        _tip("elonmusk", ONE_USDC);
        _tip("elonmusk", ONE_USDC);
        assertEq(payX.getTipHistory("elonmusk", 1, type(uint256).max).length, 2);
        assertEq(payX.getTipHistory("elonmusk", 0, type(uint256).max).length, 3);
        assertEq(payX.getTipHistory("elonmusk", 2, type(uint256).max).length, 1);
        assertEq(payX.getTipHistory("elonmusk", 3, 1).length, 0);
        assertEq(payX.getTipHistory("elonmusk", 0, 0).length, 0);
        assertEq(payX.getTipHistory("elonmusk", type(uint256).max, 1).length, 0);
    }

    function test_DustTips_DoNotInflateClaimGas() public {
        for (uint256 i = 0; i < 200; i++) _tip("elonmusk", MIN_TIP);
        assertEq(payX.getTipCount("elonmusk"), 200);
        bytes32 n = keccak256("n");
        bytes memory sig = _sign("elonmusk", creator, n);
        uint256 g = gasleft();
        payX.claimTips("elonmusk", creator, n, sig);
        g -= gasleft();
        assertLt(g, 200_000, "claim must not iterate history");
        assertEq(usdc.balanceOf(creator), 200 * (MIN_TIP - MIN_TIP / 100));
    }
}
