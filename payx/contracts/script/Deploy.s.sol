// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {PayXTipping} from "../src/PayXTipping.sol";

interface IUSDCMeta {
    function decimals() external view returns (uint8);
}

/**
 * @title PayX v2 mainnet deploy (executed only per docs/05-PAYX-DEPLOYMENT-RUNBOOK.md)
 * @dev Broadcast from XYLO-DEPLOYER-01. Ownership starts with the deployer and is
 *      handed to the Admin Safe via Ownable2Step immediately after the smoke test.
 *
 *   forge script script/Deploy.s.sol --rpc-url $ARC_MAINNET_RPC_URL \
 *     --private-key $DEPLOYER_PRIVATE_KEY --broadcast
 */
contract DeployPayX is Script {
    // Pinned mainnet constants — see docs/ADDRESS_BOOK.md
    address constant USDC = 0x3600000000000000000000000000000000000000;
    address constant TREASURY_SAFE = 0x7EF8Aa263E3Bb8a151702108bD29932e50409990; // feeRecipient
    uint256 constant PLATFORM_FEE_BPS = 100;   // 1% (confirmed by Panchu 2026-08-18)
    uint256 constant MIN_TIP_AMOUNT = 100000;  // 0.1 USDC @ 6dp

    function run() external {
        // Oracle address comes from env at ceremony time (XYLO-ORACLE-01)
        address oracleSigner = vm.envAddress("ORACLE_SIGNER_ADDRESS");

        // Pre-flight assertions — abort before broadcasting anything
        require(block.chainid == 5042, "WRONG CHAIN: not Arc mainnet");
        require(IUSDCMeta(USDC).decimals() == 6, "USDC decimals != 6");
        require(oracleSigner != address(0), "oracle unset");
        require(oracleSigner.code.length == 0, "oracle must be an EOA");

        vm.startBroadcast();
        PayXTipping payX = new PayXTipping(
            USDC, oracleSigner, TREASURY_SAFE, PLATFORM_FEE_BPS, MIN_TIP_AMOUNT
        );
        vm.stopBroadcast();

        console2.log("PayXTipping v2 deployed:", address(payX));
        console2.log("  owner (deployer, pre-handover):", payX.owner());
        console2.log("  oracleSigner:", payX.oracleSigner());
        console2.log("  feeRecipient (Treasury Safe):", payX.feeRecipient());
        console2.log("  fee bps:", payX.platformFeeBps());
        console2.log("  minTip:", payX.minTipAmount());
        console2.log("NEXT: runbook steps 2-6 (assert, smoke test, transferOwnership to Admin Safe)");
    }
}
