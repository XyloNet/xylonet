// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PayXTipping} from "../src/PayXTipping.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract PayXTippingV2Test is Test {
    PayXTipping public payX;
    MockUSDC public usdc;

    address public owner = address(0xA11CE);
    address public feeRecipient = address(0xFEE);
    address public guardian = address(0x6A2D);
    address public tipper = address(0x71BB);
    address public creator = address(0xC2EA);
    address public rando = address(0xBAD);

    uint256 public constant ORACLE_PK = 0xA11CE0FACE5EED0000000000000000000000000000000000000000000000AA01;
    address public oracle;

    uint256 public constant FEE_BPS = 100; // 1%
    uint256 public constant MIN_TIP = 100000; // 0.1 USDC @ 6dp
    uint256 public constant ONE_USDC = 1e6;

    bytes32 internal constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    function setUp() public {
        vm.chainId(5042); // mirror Arc mainnet

        oracle = vm.addr(ORACLE_PK);

        vm.startPrank(owner);
        usdc = new MockUSDC();
        payX = new PayXTipping(address(usdc), oracle, feeRecipient, FEE_BPS, MIN_TIP);
        payX.setGuardian(guardian);
        vm.stopPrank();

        usdc.mint(tipper, 1_000_000 * ONE_USDC);
        vm.prank(tipper);
        usdc.approve(address(payX), type(uint256).max);
    }

    // ─── helpers ────────────────────────────────────────────────────────────

    function _domainSeparator(address verifyingContract, uint256 chainId) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            DOMAIN_TYPEHASH, keccak256(bytes("PayX")), keccak256(bytes("2")), chainId, verifyingContract
        ));
    }

    function _signClaimWithDomain(
        string memory handle, address wallet, bytes32 nonce, bytes32 domain
    ) internal pure returns (bytes memory) {
        bytes32 structHash = keccak256(abi.encode(
            keccak256("Claim(string handle,address wallet,bytes32 nonce)"),
            keccak256(bytes(handle)), wallet, nonce
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domain, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ORACLE_PK, digest);
        return abi.encodePacked(r, s, v);
    }

    function _signClaim(string memory handle, address wallet, bytes32 nonce) internal view returns (bytes memory) {
        return _signClaimWithDomain(handle, wallet, nonce, _domainSeparator(address(payX), block.chainid));
    }

    // ─── construction & domain ──────────────────────────────────────────────

    function test_DomainSeparatorMatchesEIP712() public view {
        assertEq(payX.domainSeparator(), _domainSeparator(address(payX), 5042));
    }

    function test_ConstructorValidation() public {
        vm.expectRevert(PayXTipping.ZeroAddress.selector);
        new PayXTipping(address(0), oracle, feeRecipient, FEE_BPS, MIN_TIP);
        vm.expectRevert(PayXTipping.ZeroAddress.selector);
        new PayXTipping(address(usdc), address(0), feeRecipient, FEE_BPS, MIN_TIP);
        vm.expectRevert(PayXTipping.ZeroAddress.selector);
        new PayXTipping(address(usdc), oracle, address(0), FEE_BPS, MIN_TIP);
        vm.expectRevert(PayXTipping.FeeTooHigh.selector);
        new PayXTipping(address(usdc), oracle, feeRecipient, 501, MIN_TIP);
    }

    // ─── tipping ────────────────────────────────────────────────────────────

    function test_Tip() public {
        vm.prank(tipper);
        payX.tip("elonmusk", 10 * ONE_USDC, "Great tweet!");

        assertEq(payX.getPendingBalance("elonmusk"), 9_900_000); // 10 - 1%
        assertEq(payX.getTipCount("elonmusk"), 1);
        assertEq(payX.totalFeesCollected(), 100_000);
        assertEq(payX.totalPending(), 9_900_000);
        assertEq(payX.tipperTotalSent(tipper), 10 * ONE_USDC);
    }

    function test_TipNormalizesHandle() public {
        vm.prank(tipper);
        payX.tip("ElonMusk", 10 * ONE_USDC, "");
        assertEq(payX.getPendingBalance("elonmusk"), 9_900_000);
        assertEq(payX.getPendingBalance("ELONMUSK"), 9_900_000);
    }

    function test_MultipleTips() public {
        vm.startPrank(tipper);
        payX.tip("elonmusk", 10 * ONE_USDC, "Tip 1");
        payX.tip("elonmusk", 5 * ONE_USDC, "Tip 2");
        vm.stopPrank();
        assertEq(payX.getPendingBalance("elonmusk"), 14_850_000);
        assertEq(payX.getTipCount("elonmusk"), 2);
    }

    function test_RevertTipBelowMinimum() public {
        vm.prank(tipper);
        vm.expectRevert(PayXTipping.InvalidAmount.selector);
        payX.tip("elonmusk", MIN_TIP - 1, "");
    }

    function test_TipAtExactMinimum() public {
        vm.prank(tipper);
        payX.tip("elonmusk", MIN_TIP, "");
        assertEq(payX.getPendingBalance("elonmusk"), MIN_TIP - MIN_TIP / 100);
    }

    function test_RevertInvalidHandleChars() public {
        vm.prank(tipper);
        vm.expectRevert(PayXTipping.InvalidHandle.selector);
        payX.tip("invalid@handle", 10 * ONE_USDC, "");
    }

    function test_HandleLengthBoundaries() public {
        vm.startPrank(tipper);
        payX.tip("abcdefghijklmno", ONE_USDC, ""); // 15 chars: ok
        vm.expectRevert(PayXTipping.InvalidHandle.selector);
        payX.tip("abcdefghijklmnop", ONE_USDC, ""); // 16 chars
        vm.expectRevert(PayXTipping.InvalidHandle.selector);
        payX.tip("", ONE_USDC, "");
        vm.stopPrank();
    }

    function test_MessageLengthCap() public {
        string memory msg280 = string(new bytes(280));
        string memory msg281 = string(new bytes(281));
        vm.startPrank(tipper);
        payX.tip("elonmusk", ONE_USDC, msg280); // exactly 280: ok
        vm.expectRevert(PayXTipping.MessageTooLong.selector);
        payX.tip("elonmusk", ONE_USDC, msg281);
        vm.stopPrank();
    }

    // ─── claiming (EIP-712) ─────────────────────────────────────────────────

    function test_ClaimTips() public {
        vm.prank(tipper);
        payX.tip("elonmusk", 10 * ONE_USDC, "Great work!");

        bytes32 nonce = keccak256("nonce1");
        bytes memory sig = _signClaim("elonmusk", creator, nonce);

        uint256 before = usdc.balanceOf(creator);
        payX.claimTips("elonmusk", creator, nonce, sig);

        assertEq(usdc.balanceOf(creator) - before, 9_900_000);
        assertEq(payX.getPendingBalance("elonmusk"), 0);
        assertEq(payX.totalPending(), 0);
        assertTrue(payX.isHandleRegistered("elonmusk"));
        assertEq(payX.getLinkedWallet("elonmusk"), creator);
    }

    function test_ClaimNormalizesHandleForSigVerification() public {
        vm.prank(tipper);
        payX.tip("ElonMusk", 10 * ONE_USDC, "");
        // oracle signs the NORMALIZED handle; caller passes mixed case
        bytes32 nonce = keccak256("n");
        bytes memory sig = _signClaim("elonmusk", creator, nonce);
        payX.claimTips("ELONMUSK", creator, nonce, sig);
        assertEq(payX.getPendingBalance("elonmusk"), 0);
    }

    function test_RevertClaimInvalidSignature() public {
        vm.prank(tipper);
        payX.tip("elonmusk", 10 * ONE_USDC, "");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBEEF, keccak256("junk"));
        vm.expectRevert(PayXTipping.InvalidSignature.selector);
        payX.claimTips("elonmusk", creator, keccak256("n"), abi.encodePacked(r, s, v));
    }

    function test_RevertClaimWrongChainIdDomain() public {
        vm.prank(tipper);
        payX.tip("elonmusk", 10 * ONE_USDC, "");
        bytes32 nonce = keccak256("n");
        // signed for chainId 1 (or testnet) — must be rejected on 5042
        bytes memory sig = _signClaimWithDomain("elonmusk", creator, nonce, _domainSeparator(address(payX), 5042002));
        vm.expectRevert(PayXTipping.InvalidSignature.selector);
        payX.claimTips("elonmusk", creator, nonce, sig);
    }

    function test_RevertClaimWrongContractDomain() public {
        vm.prank(tipper);
        payX.tip("elonmusk", 10 * ONE_USDC, "");
        bytes32 nonce = keccak256("n");
        bytes memory sig = _signClaimWithDomain("elonmusk", creator, nonce, _domainSeparator(address(0xD00D), 5042));
        vm.expectRevert(PayXTipping.InvalidSignature.selector);
        payX.claimTips("elonmusk", creator, nonce, sig);
    }

    function test_RevertClaimLegacyPackedSignature() public {
        // v1-style eth_sign over abi.encodePacked(handle, wallet, nonce) must NOT work on v2
        vm.prank(tipper);
        payX.tip("elonmusk", 10 * ONE_USDC, "");
        bytes32 nonce = keccak256("n");
        bytes32 legacyHash = keccak256(abi.encodePacked("elonmusk", creator, nonce));
        bytes32 ethSigned = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", legacyHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ORACLE_PK, ethSigned);
        vm.expectRevert(PayXTipping.InvalidSignature.selector);
        payX.claimTips("elonmusk", creator, nonce, abi.encodePacked(r, s, v));
    }

    function test_RevertNonceReuse() public {
        vm.prank(tipper);
        payX.tip("elonmusk", 10 * ONE_USDC, "");
        bytes32 nonce = keccak256("n");
        bytes memory sig = _signClaim("elonmusk", creator, nonce);
        payX.claimTips("elonmusk", creator, nonce, sig);

        vm.prank(tipper);
        payX.tip("elonmusk", 5 * ONE_USDC, "");
        vm.expectRevert(PayXTipping.NonceAlreadyUsed.selector);
        payX.claimTips("elonmusk", creator, nonce, sig);
    }

    function test_RevertClaimNothingPending() public {
        bytes32 nonce = keccak256("n");
        bytes memory sig = _signClaim("elonmusk", creator, nonce);
        vm.expectRevert(PayXTipping.NoTipsToClaim.selector);
        payX.claimTips("elonmusk", creator, nonce, sig);
    }

    function test_RevertWalletMismatchAfterRegistration() public {
        vm.prank(tipper);
        payX.tip("elonmusk", 10 * ONE_USDC, "");
        payX.claimTips("elonmusk", creator, keccak256("n1"), _signClaim("elonmusk", creator, keccak256("n1")));

        vm.prank(tipper);
        payX.tip("elonmusk", 5 * ONE_USDC, "");
        // oracle signs for a DIFFERENT wallet (e.g. hijacked X session) — pin must hold
        bytes32 n2 = keccak256("n2");
        bytes memory sig = _signClaim("elonmusk", rando, n2);
        vm.expectRevert(PayXTipping.WalletMismatch.selector);
        payX.claimTips("elonmusk", rando, n2, sig);
    }

    function test_SecondClaimSameWallet() public {
        vm.prank(tipper);
        payX.tip("elonmusk", 10 * ONE_USDC, "");
        payX.claimTips("elonmusk", creator, keccak256("n1"), _signClaim("elonmusk", creator, keccak256("n1")));
        vm.prank(tipper);
        payX.tip("elonmusk", 5 * ONE_USDC, "");
        payX.claimTips("elonmusk", creator, keccak256("n2"), _signClaim("elonmusk", creator, keccak256("n2")));
        assertEq(usdc.balanceOf(creator), 9_900_000 + 4_950_000);
    }

    // ─── pause ──────────────────────────────────────────────────────────────

    function test_GuardianCanPause_OwnerUnpauses() public {
        vm.prank(guardian);
        payX.pause();

        vm.prank(tipper);
        vm.expectRevert(); // Pausable: EnforcedPause
        payX.tip("elonmusk", ONE_USDC, "");

        bytes32 nonce = keccak256("n");
        bytes memory sig = _signClaim("elonmusk", creator, nonce);
        vm.expectRevert();
        payX.claimTips("elonmusk", creator, nonce, sig);

        vm.prank(owner);
        payX.unpause();
        vm.prank(tipper);
        payX.tip("elonmusk", ONE_USDC, ""); // works again
    }

    function test_OwnerCanPause() public {
        vm.prank(owner);
        payX.pause();
        assertTrue(payX.paused());
    }

    function test_RevertRandoCannotPause() public {
        vm.prank(rando);
        vm.expectRevert(PayXTipping.NotAuthorized.selector);
        payX.pause();
    }

    function test_RevertGuardianCannotUnpause() public {
        vm.prank(guardian);
        payX.pause();
        vm.prank(guardian);
        vm.expectRevert();
        payX.unpause();
    }

    function test_AdminFunctionsWorkWhilePaused() public {
        vm.prank(guardian);
        payX.pause();
        vm.prank(owner);
        payX.setOracleSigner(address(0x0AC1E)); // incident response must work under pause
        assertEq(payX.oracleSigner(), address(0x0AC1E));
    }

    // ─── ownership (Ownable2Step) ───────────────────────────────────────────

    function test_TwoStepOwnershipTransfer() public {
        address safe = address(0x5AFE);
        vm.prank(owner);
        payX.transferOwnership(safe);
        assertEq(payX.owner(), owner); // not yet
        assertEq(payX.pendingOwner(), safe);

        vm.prank(rando);
        vm.expectRevert();
        payX.acceptOwnership();

        vm.prank(safe);
        payX.acceptOwnership();
        assertEq(payX.owner(), safe);
        assertEq(payX.pendingOwner(), address(0));

        // old owner lost admin
        vm.prank(owner);
        vm.expectRevert();
        payX.setPlatformFee(200);
    }

    // ─── admin setters ──────────────────────────────────────────────────────

    function test_AdminSetters() public {
        vm.startPrank(owner);
        payX.setOracleSigner(address(10));
        assertEq(payX.oracleSigner(), address(10));
        payX.setPlatformFee(200);
        assertEq(payX.platformFeeBps(), 200);
        payX.setMinTipAmount(ONE_USDC);
        assertEq(payX.minTipAmount(), ONE_USDC);
        payX.setFeeRecipient(address(11));
        assertEq(payX.feeRecipient(), address(11));
        payX.setGuardian(address(12));
        assertEq(payX.guardian(), address(12));
        vm.stopPrank();
    }

    function test_RevertSettersNotOwner() public {
        vm.startPrank(rando);
        vm.expectRevert();
        payX.setOracleSigner(address(10));
        vm.expectRevert();
        payX.setPlatformFee(0);
        vm.expectRevert();
        payX.setGuardian(rando);
        vm.expectRevert();
        payX.adminRelinkWallet("elonmusk", rando);
        vm.expectRevert();
        payX.sweepExcessUSDC();
        vm.expectRevert();
        payX.rescueToken(address(1));
        vm.stopPrank();
    }

    function test_RevertFeeAboveCap() public {
        vm.prank(owner);
        vm.expectRevert(PayXTipping.FeeTooHigh.selector);
        payX.setPlatformFee(501);
    }

    // ─── fees ───────────────────────────────────────────────────────────────

    function test_WithdrawFeesByOwnerAndRecipient() public {
        vm.prank(tipper);
        payX.tip("elonmusk", 100 * ONE_USDC, "");
        assertEq(payX.totalFeesCollected(), ONE_USDC);

        vm.prank(owner);
        payX.withdrawFees();
        assertEq(usdc.balanceOf(feeRecipient), ONE_USDC);
        assertEq(payX.totalFeesCollected(), 0);

        vm.prank(tipper);
        payX.tip("elonmusk", 100 * ONE_USDC, "");
        vm.prank(feeRecipient);
        payX.withdrawFees();
        assertEq(usdc.balanceOf(feeRecipient), 2 * ONE_USDC);
    }

    function test_RevertWithdrawFeesByRando() public {
        vm.prank(rando);
        vm.expectRevert(PayXTipping.NotAuthorized.selector);
        payX.withdrawFees();
    }

    function test_ZeroFeeConfig() public {
        vm.prank(owner);
        payX.setPlatformFee(0);
        vm.prank(tipper);
        payX.tip("elonmusk", 10 * ONE_USDC, "");
        assertEq(payX.getPendingBalance("elonmusk"), 10 * ONE_USDC);
        assertEq(payX.totalFeesCollected(), 0);
    }

    // ─── relink (S-4) ───────────────────────────────────────────────────────

    function test_AdminRelinkWallet() public {
        vm.prank(tipper);
        payX.tip("elonmusk", 10 * ONE_USDC, "");
        payX.claimTips("elonmusk", creator, keccak256("n1"), _signClaim("elonmusk", creator, keccak256("n1")));

        address newWallet = address(0x11E1);
        vm.prank(owner);
        payX.adminRelinkWallet("ElonMusk", newWallet); // mixed case input normalizes
        assertEq(payX.getLinkedWallet("elonmusk"), newWallet);

        // new tips claim to NEW wallet; old wallet now mismatches
        vm.prank(tipper);
        payX.tip("elonmusk", 5 * ONE_USDC, "");
        bytes32 n2 = keccak256("n2");
        vm.expectRevert(PayXTipping.WalletMismatch.selector);
        payX.claimTips("elonmusk", creator, n2, _signClaim("elonmusk", creator, n2));

        bytes32 n3 = keccak256("n3");
        payX.claimTips("elonmusk", newWallet, n3, _signClaim("elonmusk", newWallet, n3));
        assertEq(usdc.balanceOf(newWallet), 4_950_000);
    }

    function test_RevertRelinkUnregisteredHandle() public {
        vm.prank(owner);
        vm.expectRevert(PayXTipping.HandleNotRegistered.selector);
        payX.adminRelinkWallet("nobody", address(0x11E1));
    }

    // ─── sweep & rescue (S-6) ───────────────────────────────────────────────

    function test_SweepExcessCannotTouchEscrow() public {
        vm.prank(tipper);
        payX.tip("elonmusk", 10 * ONE_USDC, ""); // escrow 9.9 + fees 0.1

        usdc.mint(address(payX), 7 * ONE_USDC); // direct transfer = excess

        vm.prank(owner);
        payX.sweepExcessUSDC();

        assertEq(usdc.balanceOf(feeRecipient), 7 * ONE_USDC); // only the excess
        assertEq(usdc.balanceOf(address(payX)), 10 * ONE_USDC); // escrow+fees intact
        assertEq(payX.getPendingBalance("elonmusk"), 9_900_000); // claimable untouched
    }

    function test_RevertSweepNoExcess() public {
        vm.prank(tipper);
        payX.tip("elonmusk", 10 * ONE_USDC, "");
        vm.prank(owner);
        vm.expectRevert(PayXTipping.NothingToSweep.selector);
        payX.sweepExcessUSDC();
    }

    function test_RescueToken() public {
        MockUSDC other = new MockUSDC();
        other.mint(address(payX), 42 * ONE_USDC);
        vm.prank(owner);
        payX.rescueToken(address(other));
        assertEq(other.balanceOf(feeRecipient), 42 * ONE_USDC);
    }

    function test_RevertRescueUSDC() public {
        vm.prank(owner);
        vm.expectRevert(PayXTipping.CannotRescueUSDC.selector);
        payX.rescueToken(address(usdc));
    }

    // ─── views ──────────────────────────────────────────────────────────────

    function test_GetTipHistoryPagination() public {
        vm.startPrank(tipper);
        payX.tip("elonmusk", 10 * ONE_USDC, "Tip 1");
        payX.tip("elonmusk", 20 * ONE_USDC, "Tip 2");
        payX.tip("elonmusk", 30 * ONE_USDC, "Tip 3");
        vm.stopPrank();

        PayXTipping.Tip[] memory tips = payX.getTipHistory("elonmusk", 0, 10);
        assertEq(tips.length, 3);
        assertEq(tips[0].amount, 9_900_000);
        assertEq(tips[2].amount, 29_700_000);

        tips = payX.getTipHistory("elonmusk", 1, 1);
        assertEq(tips.length, 1);
        assertEq(tips[0].amount, 19_800_000);

        tips = payX.getTipHistory("elonmusk", 5, 10);
        assertEq(tips.length, 0);
    }

    // ─── fuzz & invariants ──────────────────────────────────────────────────

    function testFuzz_FeeMathNeverLosesFunds(uint96 rawAmount) public {
        uint256 amount = bound(uint256(rawAmount), MIN_TIP, 500_000 * ONE_USDC);
        usdc.mint(tipper, amount);
        vm.prank(tipper);
        payX.tip("someone", amount, "");

        // contract balance always covers liability exactly
        assertEq(usdc.balanceOf(address(payX)), payX.totalPending() + payX.totalFeesCollected());
        // fee + net == amount, fee never exceeds cap share
        uint256 fee = (amount * FEE_BPS) / 10000;
        assertEq(payX.getPendingBalance("someone"), amount - fee);
    }

    function testFuzz_TipThenClaimConservation(uint96 rawAmount) public {
        uint256 amount = bound(uint256(rawAmount), MIN_TIP, 500_000 * ONE_USDC);
        usdc.mint(tipper, amount);
        vm.prank(tipper);
        payX.tip("someone", amount, "");

        bytes32 nonce = keccak256(abi.encode(rawAmount));
        payX.claimTips("someone", creator, nonce, _signClaim("someone", creator, nonce));

        // after claim: only fees remain in contract, escrow fully paid out
        assertEq(payX.totalPending(), 0);
        assertEq(usdc.balanceOf(address(payX)), payX.totalFeesCollected());
    }

    function testFuzz_HandleNormalization(string memory handle) public view {
        bytes memory b = bytes(handle);
        bool expectValid = b.length > 0 && b.length <= 15;
        if (expectValid) {
            for (uint256 i = 0; i < b.length; i++) {
                bytes1 c = b[i];
                bool okChar = (c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A)
                    || (c >= 0x30 && c <= 0x39) || c == 0x5F;
                if (!okChar) { expectValid = false; break; }
            }
        }
        // getPendingBalance routes through _normalizeHandle; must never revert,
        // and invalid handles must map to the empty-handle bucket (balance 0)
        uint256 bal = payX.getPendingBalance(handle);
        if (!expectValid) assertEq(bal, 0);
    }
}
