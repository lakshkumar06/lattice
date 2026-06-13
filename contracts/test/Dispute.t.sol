// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { StakeAndAdvance } from "../src/StakeAndAdvance.sol";
import { StakeAndAdvanceHarness } from "./StakeAndAdvance.t.sol";
import { MockUSDC } from "./mocks/MockUSDC.sol";
import { TestBase } from "./TestBase.sol";

contract DisputeTest is TestBase {
    uint256 internal constant USDC = 1e6;

    MockUSDC internal token;
    StakeAndAdvanceHarness internal creditLine;

    address internal vendor = address(0xA11CE);
    address internal arbiter = address(0xA4B17E4);
    address internal user = address(0xB0B);
    address internal outsider = address(0xBAD);

    function setUp() external {
        token = new MockUSDC();
        vm.prank(vendor);
        creditLine = new StakeAndAdvanceHarness(token, arbiter, 10 minutes, 6000);

        token.mint(user, 1_000 * USDC);
        token.mint(vendor, 1_000 * USDC);

        vm.prank(user);
        token.approve(address(creditLine), type(uint256).max);
        vm.prank(vendor);
        token.approve(address(creditLine), type(uint256).max);
    }

    function test_dispute_lifecycle() external {
        vm.prank(user);
        uint256 stakeId = creditLine.deposit(user, 250 * USDC);

        vm.prank(user);
        creditLine.raiseDispute(stakeId);

        (,,,,,, StakeAndAdvance.StakeState disputedState,, uint64 disputedAt) =
            creditLine.stakes(stakeId);

        assertEq(uint256(disputedState), uint256(StakeAndAdvance.StakeState.Disputed), "disputed");
        assertEq(disputedAt, block.timestamp, "disputed at");

        vm.prank(arbiter);
        creditLine.resolveDispute(stakeId, StakeAndAdvance.Outcome.Split);

        (,,,,,, StakeAndAdvance.StakeState resolvedState,,) = creditLine.stakes(stakeId);

        assertEq(uint256(resolvedState), uint256(StakeAndAdvance.StakeState.Resolved), "resolved");
        assertEq(token.balanceOf(user), 900 * USDC, "user got collateral");
        assertEq(token.balanceOf(vendor), 1_100 * USDC, "vendor got allocation");
        assertEq(creditLine.vendorCreditAllocationTotal(vendor), 0, "allocation removed");
    }

    function test_onlyArbiter_resolves() external {
        vm.prank(user);
        uint256 stakeId = creditLine.deposit(user, 250 * USDC);

        vm.prank(vendor);
        creditLine.raiseDispute(stakeId);

        vm.expectRevert(StakeAndAdvance.OnlyArbiter.selector);
        vm.prank(outsider);
        creditLine.resolveDispute(stakeId, StakeAndAdvance.Outcome.RefundUser);
    }

    function test_autoRelease_afterWindow() external {
        vm.warp(100);

        vm.prank(user);
        uint256 stakeId = creditLine.deposit(user, 250 * USDC);

        vm.prank(user);
        creditLine.raiseDispute(stakeId);

        vm.warp(100 + 10 minutes + 1);
        creditLine.autoRelease(stakeId);

        (,,,,, uint256 pendingObligation, StakeAndAdvance.StakeState state,,) =
            creditLine.stakes(stakeId);

        assertEq(uint256(state), uint256(StakeAndAdvance.StakeState.Resolved), "state");
        assertEq(pendingObligation, 0, "pending obligation");
        assertEq(token.balanceOf(user), 1_000 * USDC, "user full refund");
        assertEq(creditLine.vendorCreditAllocationTotal(vendor), 0, "allocation removed");
    }

    function test_autoRelease_revertsBeforeWindow() external {
        vm.warp(100);

        vm.prank(user);
        uint256 stakeId = creditLine.deposit(user, 250 * USDC);

        vm.prank(user);
        creditLine.raiseDispute(stakeId);

        vm.warp(100 + 10 minutes);

        vm.expectRevert(StakeAndAdvance.DisputeWindowOpen.selector);
        creditLine.autoRelease(stakeId);
    }
}
