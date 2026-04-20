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
 *   Owner has full control over dispute resolution.
 *   This is intentional for V1. A decentralized arbitration
 *   system will be introduced in a future version.
 *
 * Refunds:
 *   Once an invoice is paid, funds are transferred immediately
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

    // ─────────────────────────────────────────────
    //  Types
    // ─────────────────────────────────────────────

    enum Status {
        Unpaid,
        Paid,
        Cancelled,
        Overdue,
        Disputed
    }

    enum InvoiceType {
        Standard, // one-time
        Recurring, // auto-renews
        Milestone // per-phase payments
    }

    enum Interval {
        None,
        Weekly,
        Biweekly,
        Monthly
    }

    /// @dev Only amounts stored on-chain.
    ///      Milestone descriptions live in IPFS metadata JSON.
    struct Milestone {
        uint256 amount;
        bool released;
        uint256 releasedAt;
    }

    struct Invoice {
        // Identity
        uint256 id;
        string invoiceRef; // e.g. "INV-001" — auto-generated per creator
        string metadataCID; // IPFS CID → title, names, line items, notes
        // Parties
        address creator;
        address client; // address(0) = open invoice
        // Payment
        address token; // whitelisted ERC-20
        uint256 amount; // total in token units
        uint256 dueDate; // unix timestamp; 0 = no deadline
        Status status;
        InvoiceType invoiceType;
        // Late fees
        uint256 lateFeesBps; // rate in bps e.g. 150 = 1.5% per day
        // Recurring
        Interval interval;
        uint256 nextDueDate;
        // Tracking
        uint256 totalCollected;
        uint256 createdAt;
        uint256 paidAt;
        // Dispute
        string disputeReason;
    }

    // ─────────────────────────────────────────────
    //  Constants
    // ─────────────────────────────────────────────

    uint256 public constant MAX_FEE_BPS = 1000; // 10% platform fee cap
    uint256 public constant MAX_LATE_BPS = 500; // 5% per day late fee cap
    uint256 public constant MAX_FEE_DELTA_BPS = 200; // max change per setFee() call

    // ─────────────────────────────────────────────
    //  Storage
    //    NEVER remove or reorder these variables.
    //    Only append new variables ABOVE __gap
    //    when writing V2, V3, etc. Reduce __gap
    //    size by the number of slots you add.
    // ─────────────────────────────────────────────

    uint256 public platformFeeBps;
    address public feeRecipient;
    uint256 private _nextId;

    mapping(uint256 => Invoice) public invoices;
    mapping(uint256 => Milestone[]) private _milestones;
    mapping(address => uint256[]) private _creatorInvoices;
    mapping(address => uint256[]) private _clientInvoices;
    mapping(address => uint256) private _creatorCount;
    mapping(address => bool) public tokenWhitelist;

    /// @dev Reserves 50 storage slots for future V1 variables.
    ///      Each new variable added in an upgrade uses one slot.
    ///      Reduce this by 1 per added variable e.g. [49], [48]...
    uint256[50] private __gap;

    // ─────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────

    event ContractInitialized(
        address indexed owner,
        address indexed feeRecipient,
        uint256 platformFeeBps
    );

    event InvoiceCreated(
        uint256 indexed id,
        address indexed creator,
        address indexed client,
        string invoiceRef,
        string metadataCID,
        address token,
        uint256 amount,
        uint256 dueDate,
        InvoiceType invoiceType,
        Interval interval
    );

    event InvoicePaid(
        uint256 indexed id,
        address indexed payer,
        uint256 amount,
        uint256 fee,
        uint256 lateFee,
        uint256 creatorReceives,
        uint256 timestamp
    );

    event MilestoneReleased(
        uint256 indexed invoiceId,
        uint256 indexed milestoneIndex,
        uint256 amount,
        uint256 fee,
        uint256 creatorReceives,
        uint256 timestamp
    );

    event InvoiceCancelled(uint256 indexed id, address indexed by);
    event InvoiceDisputed(
        uint256 indexed id,
        address indexed by,
        string reason
    );
    event DisputeResolved(uint256 indexed id);
    event InvoiceMarkedOverdue(uint256 indexed id);
    event RecurringRenewed(
        uint256 indexed id,
        uint256 newDueDate,
        uint256 totalCollected
    );
    event MetadataUpdated(uint256 indexed id, string newCID);
    event TokenWhitelisted(address indexed token, bool status);
    event FeeUpdated(uint256 oldBps, uint256 newBps);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);

    // ─────────────────────────────────────────────
    //  Errors
    // ─────────────────────────────────────────────

    error InvoiceNotFound();
    error AlreadyPaid();
    error AlreadyCancelled();
    error AlreadyDisputed();
    error NotDisputed();
    error WrongClient();
    error InvalidAmount();
    error InvalidInterval();
    error InvalidDueDate();
    error InvalidMilestones();
    error MilestoneAlreadyReleased();
    error MilestoneOutOfBounds();
    error NotMilestoneInvoice();
    error NotStandardOrRecurring();
    error FeeTooHigh();
    error FeeDeltaTooHigh();
    error ZeroAddress();
    error NotCreator();
    error NotParty();
    error TokenNotWhitelisted();
    error EmptyCID();
    error RecurringRequiresDueDate();
}
