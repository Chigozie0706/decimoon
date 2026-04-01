// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Decimoon
 * @notice On-chain invoicing for MiniPay / Celo — pay and receive in cUSD
 * @dev Works with any ERC-20 stablecoin (cUSD on Celo mainnet: 0x765DE816845861e75A25fCA122bb6898B8B1282a)
 */
contract Decimoon1 is ReentrancyGuard, Ownable2Step {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────
    //  Types
    // ─────────────────────────────────────────────

    enum Status {
        Unpaid,
        Paid,
        Cancelled,
        Overdue
    }

    enum Interval {
        None,
        Weekly,
        Biweekly,
        Monthly
    }

    struct Invoice {
        uint256 id;
        address creator;
        address client; // address(0) = open invoice (anyone can pay)
        string title;
        string description;
        uint256 amount; // in stablecoin smallest unit (e.g. 1e18 = 1 cUSD)
        uint256 dueDate; // unix timestamp; 0 = no due date
        Status status;
        bool isRecurring;
        Interval interval;
        uint256 nextDueDate; // next payment due (recurring only)
        uint256 totalCollected; // lifetime collected on this invoice
        uint256 createdAt;
        uint256 paidAt;
    }

    // ─────────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────────

    IERC20 public stablecoin;

    uint256 public platformFeeBps = 200; // 2% in basis points
    uint256 public constant MAX_FEE_BPS = 1000; // hard cap at 10%
    address public feeRecipient;

    uint256 private _nextId = 1;

    /// invoiceId => Invoice
    mapping(uint256 => Invoice) public invoices;

    /// creator => list of invoice IDs
    mapping(address => uint256[]) private _creatorInvoices;

    /// client => list of invoice IDs
    mapping(address => uint256[]) private _clientInvoices;

    // ─────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────

    event InvoiceCreated(
        uint256 indexed id,
        address indexed creator,
        address indexed client,
        uint256 amount,
        uint256 dueDate,
        bool isRecurring,
        Interval interval
    );

    event InvoicePaid(
        uint256 indexed id,
        address indexed payer,
        uint256 amount,
        uint256 fee,
        uint256 creatorReceives,
        uint256 timestamp
    );

    event InvoiceCancelled(uint256 indexed id, address indexed cancelledBy);

    event InvoiceMarkedOverdue(uint256 indexed id);

    event RecurringRenewed(
        uint256 indexed id,
        uint256 newDueDate,
        uint256 totalCollected
    );

    event FeeUpdated(uint256 oldBps, uint256 newBps);

    event FeeRecipientUpdated(address oldRecipient, address newRecipient);

    // ─────────────────────────────────────────────
    //  Errors
    // ─────────────────────────────────────────────

    error InvoiceNotFound();
    error AlreadyPaid();
    error AlreadyCancelled();
    error WrongClient();
    error InvalidAmount();
    error InvalidDueDate();
    error FeeTooHigh();
    error ZeroAddress();
    error NotCreator();

    // ─────────────────────────────────────────────
    //  Modifiers
    // ─────────────────────────────────────────────

    modifier invoiceExists(uint256 id) {
        if (invoices[id].id == 0) revert InvoiceNotFound();
        _;
    }

    // ─────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────

    /**
     * @param _stablecoin    ERC-20 token used for payments (cUSD on Celo)
     * @param _feeRecipient  Address that receives platform fees
     */
    constructor(
        address _stablecoin,
        address _feeRecipient
    ) Ownable(msg.sender) {
        if (_stablecoin == address(0)) revert ZeroAddress();
        if (_feeRecipient == address(0)) revert ZeroAddress();

        stablecoin = IERC20(_stablecoin);
        feeRecipient = _feeRecipient;
    }

    // ─────────────────────────────────────────────
    //  Core: Create Invoice
    // ─────────────────────────────────────────────

    /**
     * @notice Create a new invoice.
     * @param client       Who must pay. Use address(0) for open/public invoices.
     * @param title        Short title (e.g. "Logo Design")
     * @param description  Full description
     * @param amount       Payment amount in stablecoin units (18 decimals for cUSD)
     * @param dueDate      Unix timestamp deadline. 0 = no deadline.
     * @param isRecurring  If true, invoice auto-renews on `interval`
     * @param interval     None | Weekly | Biweekly | Monthly
     */
    function createInvoice(
        address client,
        string calldata title,
        string calldata description,
        uint256 amount,
        uint256 dueDate,
        bool isRecurring,
        Interval interval
    ) external returns (uint256 id) {
        if (amount == 0) revert InvalidAmount();
        if (dueDate != 0 && dueDate <= block.timestamp) revert InvalidDueDate();
        if (isRecurring && interval == Interval.None) revert InvalidAmount();

        id = _nextId++;

        uint256 nextDue = isRecurring && dueDate != 0 ? dueDate : 0;

        invoices[id] = Invoice({
            id: id,
            creator: msg.sender,
            client: client,
            title: title,
            description: description,
            amount: amount,
            dueDate: dueDate,
            status: Status.Unpaid,
            isRecurring: isRecurring,
            interval: interval,
            nextDueDate: nextDue,
            totalCollected: 0,
            createdAt: block.timestamp,
            paidAt: 0
        });

        _creatorInvoices[msg.sender].push(id);
        if (client != address(0)) {
            _clientInvoices[client].push(id);
        }

        emit InvoiceCreated(
            id,
            msg.sender,
            client,
            amount,
            dueDate,
            isRecurring,
            interval
        );
    }

    // ─────────────────────────────────────────────
    //  Core: Pay Invoice
    // ─────────────────────────────────────────────

    /**
     * @notice Pay an invoice. Caller must have approved this contract to spend `amount` cUSD.
     * @dev Follows checks-effects-interactions pattern. Protected by nonReentrant.
     * @param id  Invoice ID to pay
     */
    function payInvoice(uint256 id) external nonReentrant invoiceExists(id) {
        Invoice storage inv = invoices[id];

        // ── Checks ────────────────────────────────
        if (inv.status == Status.Paid && !inv.isRecurring) revert AlreadyPaid();
        if (inv.status == Status.Cancelled) revert AlreadyCancelled();
        if (inv.client != address(0) && inv.client != msg.sender)
            revert WrongClient();

        // ── Effects ───────────────────────────────

        // Auto-mark overdue if past due date
        if (
            inv.dueDate != 0 &&
            block.timestamp > inv.dueDate &&
            inv.status == Status.Unpaid
        ) {
            inv.status = Status.Overdue;
            emit InvoiceMarkedOverdue(id);
        }

        uint256 fee = (inv.amount * platformFeeBps) / 10_000;
        uint256 creatorAmount = inv.amount - fee;

        inv.totalCollected += inv.amount;

        if (inv.isRecurring) {
            uint256 nextDue = _nextDueDate(
                inv.nextDueDate > 0 ? inv.nextDueDate : block.timestamp,
                inv.interval
            );
            inv.nextDueDate = nextDue;
            inv.dueDate = nextDue;
            inv.status = Status.Unpaid;
            inv.paidAt = block.timestamp;
            emit RecurringRenewed(id, nextDue, inv.totalCollected);
        } else {
            inv.status = Status.Paid;
            inv.paidAt = block.timestamp;
        }

        emit InvoicePaid(
            id,
            msg.sender,
            inv.amount,
            fee,
            creatorAmount,
            block.timestamp
        );

        // ── Interactions ──────────────────────────
        // Pull full amount from payer into this contract first,
        // then distribute — eliminates partial transfer risk.
        stablecoin.safeTransferFrom(msg.sender, address(this), inv.amount);
        stablecoin.safeTransfer(inv.creator, creatorAmount);
        if (fee > 0) {
            stablecoin.safeTransfer(feeRecipient, fee);
        }
    }

    // ─────────────────────────────────────────────
    //  Core: Cancel Invoice
    // ─────────────────────────────────────────────

    /**
     * @notice Cancel an unpaid invoice. Only the creator can cancel.
     */
    function cancelInvoice(uint256 id) external invoiceExists(id) {
        Invoice storage inv = invoices[id];

        if (inv.creator != msg.sender) revert NotCreator();
        if (inv.status == Status.Paid) revert AlreadyPaid();
        if (inv.status == Status.Cancelled) revert AlreadyCancelled();

        inv.status = Status.Cancelled;
        emit InvoiceCancelled(id, msg.sender);
    }

    // ─────────────────────────────────────────────
    //  Core: Mark Overdue (public keeper function)
    // ─────────────────────────────────────────────

    /**
     * @notice Anyone can call this to mark an invoice overdue once the due date has passed.
     *         Useful for off-chain keepers / bots.
     */
    function markOverdue(uint256 id) external invoiceExists(id) {
        Invoice storage inv = invoices[id];
        if (inv.status != Status.Unpaid) return;
        if (inv.dueDate == 0 || block.timestamp <= inv.dueDate) return;
        inv.status = Status.Overdue;
        emit InvoiceMarkedOverdue(id);
    }

    // ─────────────────────────────────────────────
    //  Views
    // ─────────────────────────────────────────────

    /// @notice Get full invoice details
    function getInvoice(
        uint256 id
    ) external view invoiceExists(id) returns (Invoice memory) {
        return invoices[id];
    }

    /// @notice All invoice IDs created by an address
    function getCreatorInvoices(
        address creator
    ) external view returns (uint256[] memory) {
        return _creatorInvoices[creator];
    }

    /// @notice All invoice IDs addressed to a client
    function getClientInvoices(
        address client
    ) external view returns (uint256[] memory) {
        return _clientInvoices[client];
    }

    /**
     * @notice Returns (fee, creatorReceives) for a given amount at the current fee rate.
     *         Useful for UI preview before payment.
     */
    function calculateFee(
        uint256 amount
    ) external view returns (uint256 fee, uint256 creatorReceives) {
        fee = (amount * platformFeeBps) / 10_000;
        creatorReceives = amount - fee;
    }

    /// @notice Total number of invoices ever created
    function totalInvoices() external view returns (uint256) {
        return _nextId - 1;
    }

    // ─────────────────────────────────────────────
    //  Admin
    // ─────────────────────────────────────────────

    /**
     * @notice Update platform fee. Hard-capped at MAX_FEE_BPS (10%).
     */
    function setFee(uint256 newBps) external onlyOwner {
        if (newBps > MAX_FEE_BPS) revert FeeTooHigh();
        emit FeeUpdated(platformFeeBps, newBps);
        platformFeeBps = newBps;
    }

    /**
     * @notice Update fee recipient wallet.
     */
    function setFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroAddress();
        emit FeeRecipientUpdated(feeRecipient, newRecipient);
        feeRecipient = newRecipient;
    }

    // NOTE: transferOwnership() and acceptOwnership() are inherited from Ownable2Step.
    // Two-step process: owner proposes → new owner must explicitly accept.
    // This prevents accidental loss of ownership from a typo.

    // ─────────────────────────────────────────────
    //  Internal Helpers
    // ─────────────────────────────────────────────

    function _nextDueDate(
        uint256 from,
        Interval interval
    ) internal pure returns (uint256) {
        if (interval == Interval.Weekly) return from + 7 days;
        if (interval == Interval.Biweekly) return from + 14 days;
        if (interval == Interval.Monthly) return from + 30 days;
        return 0;
    }
}
