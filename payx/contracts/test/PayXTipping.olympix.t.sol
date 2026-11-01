// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {PayXTipping} from "../src/PayXTipping.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

/// @dev Token whose transferFrom calls back into the contract under test, to
///      observe or attack the state during the tip() interaction (F-01).
contract CallbackToken is MockUSDC {
    enum Mode { None, Observe, Reenter }
    Mode public mode;
    PayXTipping public target;
    uint256 public observedTotalPending;
    uint256 public observedTipCount;
    bool public reenterReverted;

    function arm(PayXTipping _target, Mode _mode) external {
        target = _target;
        mode = _mode;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (mode == Mode.Observe) {
            observedTotalPending = target.totalPending();
            observedTipCount = target.getTipCount("creator");
        } else if (mode == Mode.Reenter) {
            try target.tip("creator", amount, "") {
                reenterReverted = false;
            } catch {
                reenterReverted = true;
            }
        }
        return super.transferFrom(from, to, amount);
    }
}

/**
 * @title Olympix pre-audit findings tests (F-01 … F-08)
 * @notice Each test is named after the finding in OLYMPIX_SUBMISSION.md it covers.
 *         Fixed findings prove the fix; accepted-risk and open findings document
 *         the exact behavior the reviewers need to reason about.
 */
contract PayXTippingOlympixTest is Test {
    PayXTipping public payX;
    MockUSDC public usdc;

    address public owner = address(0xA11CE);
    address public feeRecipient = address(0xFEE);
    address public guardian = address(0x6A2D);
    address public tipper = address(0x71BB);
    address public creator = address(0xC2EA);
    address public attacker = address(0xBAD);

    uint256 public constant ORACLE_PK = 0xA11CE0FACE5EED0000000000000000000000000000000000000000000000AA01;
    uint256 public constant ATTACKER_PK = 0xBAD0000000000000000000000000000000000000000000000000000000000BAD;
    address public oracle;

    uint256 public constant FEE_BPS = 100; // 1%
    uint256 public constant MIN_TIP = 100000; // 0.1 USDC @ 6dp
    uint256 public constant ONE_USDC = 1e6;

    bytes32 internal constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    function setUp() public {
        vm.chainId(5042);
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

    function _sign(uint256 pk, PayXTipping c, string memory handle, address wallet, bytes32 nonce) internal view returns (bytes memory) {
        bytes32 domain = keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256(bytes("PayX")), keccak256(bytes("2")), block.chainid, address(c)));
        bytes32 structHash = keccak256(abi.encode(keccak256("Claim(string handle,address wallet,bytes32 nonce)"), keccak256(bytes(handle)), wallet, nonce));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domain, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _deployWith(CallbackToken token) internal returns (PayXTipping c) {
        vm.prank(owner);
        c = new PayXTipping(address(token), oracle, feeRecipient, FEE_BPS, MIN_TIP);
        token.mint(tipper, 100 * ONE_USDC);
        vm.prank(tipper);
        token.approve(address(c), type(uint256).max);
    }

    // ─── F-01: checks-effects-interactions in tip() ─────────────────────────

    /// @dev During the token transfer, every effect of the tip is already written.
    function test_F01_tip_effectsAreFinalBeforeTokenTransfer() public {
        CallbackToken token = new CallbackToken();
        PayXTipping c = _deployWith(token);
        token.arm(c, CallbackToken.Mode.Observe);

        vm.prank(tipper);
        c.tip("creator", 10 * ONE_USDC, "hi");

        uint256 net = 10 * ONE_USDC - (10 * ONE_USDC * FEE_BPS) / 10000;
        assertEq(token.observedTotalPending(), net, "totalPending written before transferFrom");
        assertEq(token.observedTipCount(), 1, "tipCount written before transferFrom");
        assertEq(c.totalPending(), net);
    }

    /// @dev A token that re-enters tip() from its transfer hook is stopped by the guard,
    ///      and the outer tip still accounts exactly once.
    function test_F01_tip_reentrantTokenIsRejected() public {
        CallbackToken token = new CallbackToken();
        PayXTipping c = _deployWith(token);
        token.arm(c, CallbackToken.Mode.Reenter);

        vm.prank(tipper);
        c.tip("creator", 10 * ONE_USDC, "");

        assertTrue(token.reenterReverted(), "inner tip() must revert on the reentrancy guard");
        uint256 net = 10 * ONE_USDC - (10 * ONE_USDC * FEE_BPS) / 10000;
        assertEq(c.totalPending(), net, "exactly one tip accounted");
        assertEq(c.getTipCount("creator"), 1);
        assertEq(token.balanceOf(address(c)), 10 * ONE_USDC);
    }

    // ─── F-02: guardian zero address disables the role (Slither missing-zero-check) ─

    function test_F02_setGuardian_zeroDisablesPauseRole() public {
        vm.prank(owner);
        payX.setGuardian(address(0));
        assertEq(payX.guardian(), address(0));

        vm.prank(guardian);
        vm.expectRevert(PayXTipping.NotAuthorized.selector);
        payX.pause();

        // address(0) can never be msg.sender, so nobody inherits the role; the owner keeps it.
        vm.prank(owner);
        payX.pause();
        assertTrue(payX.paused());
    }

    // ─── F-03: claim authorizations do not expire (open, needs a decision) ──

    function test_F03_claimSignature_staysValidUntilUsed() public {
        vm.prank(tipper);
        payX.tip("creator", 10 * ONE_USDC, "");
        bytes32 nonce = keccak256("f03");
        bytes memory sig = _sign(ORACLE_PK, payX, "creator", creator, nonce);

        vm.warp(block.timestamp + 365 days);
        payX.claimTips("creator", creator, nonce, sig); // anyone may submit it; funds go to `creator`
        assertEq(usdc.balanceOf(creator), 10 * ONE_USDC - (10 * ONE_USDC * FEE_BPS) / 10000);

        // Replay is impossible: the nonce is burned.
        vm.expectRevert(PayXTipping.NonceAlreadyUsed.selector);
        payX.claimTips("creator", creator, nonce, sig);
    }

    // ─── F-04: owner + oracle together can redirect escrow (accepted risk, Admin Safe) ─

    function test_F04_ownerCanRedirectEscrowThroughOracleRotationAndRelink() public {
        vm.prank(tipper);
        payX.tip("creator", 10 * ONE_USDC, "");
        bytes32 n1 = keccak256("first");
        payX.claimTips("creator", creator, n1, _sign(ORACLE_PK, payX, "creator", creator, n1));
        assertEq(payX.getLinkedWallet("creator"), creator);

        vm.prank(tipper);
        payX.tip("creator", 5 * ONE_USDC, "");

        // An honest oracle will not sign for a different wallet, and the contract refuses it.
        bytes32 n2 = keccak256("second");
        vm.expectRevert(PayXTipping.WalletMismatch.selector);
        payX.claimTips("creator", attacker, n2, _sign(ORACLE_PK, payX, "creator", attacker, n2));

        // The owner (the 2-of-3 Admin Safe) can relink and rotate the signer: both leave events.
        vm.startPrank(owner);
        vm.expectEmit(true, true, true, true);
        emit PayXTipping.WalletRelinked("creator", "creator", creator, attacker);
        payX.adminRelinkWallet("creator", attacker);
        vm.expectEmit(true, true, false, false);
        emit PayXTipping.OracleSignerUpdated(oracle, vm.addr(ATTACKER_PK));
        payX.setOracleSigner(vm.addr(ATTACKER_PK));
        vm.stopPrank();

        bytes32 n3 = keccak256("third");
        payX.claimTips("creator", attacker, n3, _sign(ATTACKER_PK, payX, "creator", attacker, n3));
        assertEq(usdc.balanceOf(attacker), 5 * ONE_USDC - (5 * ONE_USDC * FEE_BPS) / 10000);
    }

    /// @dev Nobody below owner has that power: guardian, feeRecipient and the old oracle cannot.
    function test_F04_nonOwnersCannotRelinkOrRotate() public {
        address[3] memory who = [guardian, feeRecipient, oracle];
        for (uint256 i = 0; i < who.length; i++) {
            vm.startPrank(who[i]);
            vm.expectRevert();
            payX.adminRelinkWallet("creator", attacker);
            vm.expectRevert();
            payX.setOracleSigner(attacker);
            vm.stopPrank();
        }
    }

    // ─── F-05: rescueToken strict equality is a plain zero check (Slither false positive) ─

    function test_F05_rescueToken_zeroBalanceRevertsNonZeroSucceeds() public {
        MockUSDC other = new MockUSDC();
        vm.prank(owner);
        vm.expectRevert(PayXTipping.NothingToSweep.selector);
        payX.rescueToken(address(other));

        other.mint(address(payX), 7);
        vm.prank(owner);
        payX.rescueToken(address(other));
        assertEq(other.balanceOf(feeRecipient), 7);

        vm.prank(owner);
        vm.expectRevert(PayXTipping.CannotRescueUSDC.selector);
        payX.rescueToken(address(usdc));
    }

    // ─── F-06: fee rounds down, remainder stays with the recipient, nothing is lost ─

    function test_F06_feeRoundsDownAndSumsConserve(uint256 amount) public {
        amount = bound(amount, MIN_TIP, 1_000_000 * ONE_USDC);
        vm.prank(tipper);
        payX.tip("creator", amount, "");
        uint256 fee = (amount * FEE_BPS) / 10000;
        assertLe(fee * 10000, amount * FEE_BPS, "fee never rounds up");
        assertEq(payX.totalPending() + payX.totalFeesCollected(), amount, "net + fee == amount");
        assertEq(usdc.balanceOf(address(payX)), amount);
    }

    // ─── F-07: no refund path; escrow leaves only through claimTips (accepted design) ─

    function test_F07_escrowOnlyLeavesThroughClaim() public {
        vm.prank(tipper);
        payX.tip("creator", 10 * ONE_USDC, "");
        uint256 escrow = payX.totalPending();

        vm.startPrank(owner);
        vm.expectRevert(PayXTipping.NothingToSweep.selector);
        payX.sweepExcessUSDC(); // balance == liabilities: nothing above escrow + fees
        payX.withdrawFees(); // fees only
        vm.stopPrank();

        assertEq(payX.totalPending(), escrow, "escrow untouched by every owner function");
        assertEq(usdc.balanceOf(address(payX)), escrow, "only fees left the contract");
        assertEq(usdc.balanceOf(feeRecipient), (10 * ONE_USDC * FEE_BPS) / 10000);
    }

    // ─── F-08: pause halts tips and claims but never traps fees or admin recovery ─

    function test_F08_pauseScope() public {
        vm.prank(tipper);
        payX.tip("creator", 10 * ONE_USDC, "");
        vm.prank(guardian);
        payX.pause();

        vm.prank(tipper);
        vm.expectRevert();
        payX.tip("creator", ONE_USDC, "");

        bytes32 nonce = keccak256("f08");
        vm.expectRevert();
        payX.claimTips("creator", creator, nonce, _sign(ORACLE_PK, payX, "creator", creator, nonce));

        vm.prank(feeRecipient);
        payX.withdrawFees(); // fee withdrawal works while paused

        vm.prank(guardian);
        vm.expectRevert(); // the guardian can freeze but cannot unfreeze
        payX.unpause();

        vm.prank(owner);
        payX.unpause();
        payX.claimTips("creator", creator, nonce, _sign(ORACLE_PK, payX, "creator", creator, nonce));
        assertGt(usdc.balanceOf(creator), 0);
    }
}
