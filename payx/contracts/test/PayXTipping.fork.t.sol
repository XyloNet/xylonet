// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PayXTipping} from "../src/PayXTipping.sol";

/**
 * @title Arc mainnet fork checks (runs only when ARC_MAINNET_RPC_URL is set)
 *
 * PLATFORM LIMITATION (discovered 2026-08-18): Arc's USDC (0x3600…0000) is a proxy
 * whose implementation (0xC6AD…3cA6) delegates the actual token logic to the Arc
 * system precompile at 0x1800…0000. Vanilla EVM simulators (Foundry revm) do not
 * implement that precompile, so any local execution of USDC calls reverts with
 * OpcodeNotFound. Real-USDC behavior can therefore ONLY be proven on the live
 * chain — which is exactly what the deployment runbook's smoke test does
 * (1 USDC tip → claim, runbook step 3, before ownership handover).
 *
 * These fork tests verify everything that CAN be verified locally:
 * chain identity, predeploy/proxy topology, and that PayXTipping v2 deploys
 * cleanly against the real USDC address.
 */
contract PayXTippingForkTest is Test {
    address constant USDC = 0x3600000000000000000000000000000000000000;
    address constant USDC_IMPL = 0xC6AD664ac6679F4Ce74e10E91449C93Ec1ae3cA6;
    address constant ARC_TOKEN_PRECOMPILE = 0x1800000000000000000000000000000000000000;

    bool hasFork;

    function setUp() public {
        string memory url = vm.envOr("ARC_MAINNET_RPC_URL", string(""));
        if (bytes(url).length == 0) return;
        vm.createSelectFork(url);
        hasFork = true;
    }

    function test_Fork_ChainIdentityAndUSDCTopology() public view {
        if (!hasFork) return;
        assertEq(block.chainid, 5042, "must be Arc mainnet");
        assertGt(USDC.code.length, 0, "USDC proxy code present");
        assertGt(USDC_IMPL.code.length, 0, "USDC implementation code present");
        // The precompile address carries only a 1-byte marker — the logic lives in
        // the chain client itself. This is WHY local simulation of USDC calls is
        // impossible (verified: 0x1800…0000 has 1 byte of code on mainnet).
        assertLe(ARC_TOKEN_PRECOMPILE.code.length, 1, "token logic is a system precompile");
    }

    function test_Fork_DeployAgainstRealUSDCAddress() public {
        if (!hasFork) return;
        // Constructor performs no USDC calls, so deployment against the real
        // address must succeed and pin the exact mainnet configuration.
        PayXTipping payX = new PayXTipping(
            USDC,
            address(0x0AC1E),                                  // placeholder oracle
            0x7EF8Aa263E3Bb8a151702108bD29932e50409990,        // Treasury Safe
            100,
            100000
        );
        assertEq(address(payX.usdc()), USDC);
        assertEq(payX.platformFeeBps(), 100);
        assertEq(payX.minTipAmount(), 100000);
        assertEq(payX.feeRecipient(), 0x7EF8Aa263E3Bb8a151702108bD29932e50409990);
        // EIP-712 domain binds to the REAL chain id 5042 on this fork
        assertEq(
            payX.domainSeparator(),
            keccak256(abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("PayX")), keccak256(bytes("2")), uint256(5042), address(payX)
            ))
        );
    }
}
