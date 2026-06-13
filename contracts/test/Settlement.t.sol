// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { StakeAndAdvance } from "../src/StakeAndAdvance.sol";
import { StakeAndAdvanceHarness } from "./StakeAndAdvance.t.sol";
import { MockUSDC } from "./mocks/MockUSDC.sol";
import { TestBase } from "./TestBase.sol";

contract SettlementTest is TestBase {
    event Settled(
        uint256 indexed stakeId,
        address indexed user,
        address indexed vendor,
        uint256 immediateRefund,
        uint256 pendingObligation
    );

    uint256 internal constant USDC = 1e6;

    MockUSDC internal token;
    StakeAndAdvanceHarness internal creditLine;

    address internal vendor = address(0xA11CE);
    address internal arbiter = address(0xA4B17E4);
    address internal forwarder = address(0xF04);
    address internal user = address(0xB0B);

    function setUp() external {
        token = new MockUSDC();
        vm.prank(vendor);
        creditLine = new StakeAndAdvanceHarness(token, arbiter, forwarder, 10 minutes, 6000);

        token.mint(user, 1_000 * USDC);
        token.mint(vendor, 1_000 * USDC);

        vm.prank(user);
        token.approve(address(creditLine), type(uint256).max);
        vm.prank(vendor);
        token.approve(address(creditLine), type(uint256).max);
    }

    function test_cancel_noDraw_fullRefund() external {
        vm.prank(user);
        uint256 stakeId = creditLine.deposit(user, 250 * USDC);

        vm.expectEmit(true, true, true, true);
        emit Settled(stakeId, user, vendor, 250 * USDC, 0);

        vm.prank(user);
        creditLine.cancel(stakeId);

        (,,,,, uint256 pendingObligation, StakeAndAdvanceHarness.StakeState state,,) =
            creditLine.stakes(stakeId);

        assertEq(uint256(state), uint256(StakeAndAdvance.StakeState.Cancelled), "state");
        assertEq(pendingObligation, 0, "pending obligation");
        assertEq(token.balanceOf(user), 1_000 * USDC, "user balance");
        assertEq(token.balanceOf(address(creditLine)), 0, "contract balance");
    }

    function test_cancel_afterDraw_partialRefund_createsObligation() external {
        vm.prank(user);
        uint256 stakeId = creditLine.deposit(user, 250 * USDC);
        creditLine.setCreditCap(vendor, 100 * USDC, 0);

        vm.prank(vendor);
        creditLine.drawdown(100 * USDC);

        vm.expectEmit(true, true, true, true);
        emit Settled(stakeId, user, vendor, 150 * USDC, 100 * USDC);

        vm.prank(user);
        creditLine.cancel(stakeId);

        (,,,,, uint256 pendingObligation,,,) = creditLine.stakes(stakeId);

        assertEq(pendingObligation, 100 * USDC, "pending obligation");
        assertEq(creditLine.priorityObligation(vendor), 100 * USDC, "priority obligation");
        assertEq(creditLine.currentOutstandingDebt(vendor), 100 * USDC, "debt remains");
        assertEq(token.balanceOf(user), 900 * USDC, "user balance");
        assertEq(token.balanceOf(address(creditLine)), 0, "contract balance");
    }

    function test_cancel_decrementsCreditLimit() external {
        vm.prank(user);
        uint256 stakeId = creditLine.deposit(user, 250 * USDC);
        creditLine.setCreditCap(vendor, 100 * USDC, 0);

        assertEq(creditLine.effectiveCreditLimit(vendor), 100 * USDC, "limit before");

        vm.prank(user);
        creditLine.cancel(stakeId);

        assertEq(creditLine.vendorCreditAllocationTotal(vendor), 0, "allocation");
        assertEq(creditLine.effectiveCreditLimit(vendor), 0, "limit after");
    }
}
