// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Decimoon
 * @notice Programmable on-chain invoices — UUPS upgradeable settlement layer.
 *
 * Architecture:
 *   ON-CHAIN  → payment logic, status, amounts, enforcement
 *   IPFS/CID  → metadata (title, names, line items, notes, logo)
 *
 * Upgradeability:
 *   Uses UUPS proxy pattern. Only the owner can authorize upgrades.
 *   To upgrade: deploy DecimoonV2, then call upgradeToAndCall(newImpl, "").
 *
 * Dispute resolution:
 *   ⚠️ Owner has full control over dispute resolution.
 *   This is intentional for V1. A decentralized arbitration
 *   system will be introduced in a future version.
 *
 * Refunds:
 *   ⚠️ Once an invoice is paid, funds are transferred immediately
 *   to the creator. There is no on-chain refund mechanism.
 *   Refunds must be handled off-chain between parties.
 *
 * @dev Storage layout is append-only. Never remove or reorder
 *      existing state variables between upgrades.
 *      __gap reserves slots for future V1 storage additions.
 */


contract Decimoon is
    Initializable,
    ReentrancyGuardUpgradeable,
    Ownable2StepUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;
