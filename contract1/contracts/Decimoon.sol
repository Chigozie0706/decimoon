// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Decimoon
 * @notice On-chain invoicing for MiniPay / Celo — pay and receive in cUSD
 * @dev UUPS upgradeable. Works with any ERC-20 stablecoin.
 *      cUSD on Celo mainnet: 0x765DE816845861e75A25fCA122bb6898B8B1282a
 */
contract Decimoon is
    Initializable,
    ReentrancyGuardUpgradeable,
    Ownable2StepUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

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
        address client;
        string title;
        string description;
        uint256 amount;
        uint256 dueDate;
        Status status;
        bool isRecurring;
        Interval interval;
        uint256 nextDueDate;
        uint256 totalCollected;
        uint256 createdAt;
        uint256 paidAt;
    }

    // ── State ──────────────────────────────────────────────

    IERC20 public stablecoin;
    uint256 public platformFeeBps;
    uint256 public constant MAX_FEE_BPS = 1000;
    address public feeRecipient;
    uint256 private _nextId;

    mapping(uint256 => Invoice) public invoices;
    mapping(address => uint256[]) private _creatorInvoices;
    mapping(address => uint256[]) private _clientInvoices;

    /// @dev Reserve 50 slots for future upgrades.
    /// When adding new variables, add above this and reduce array size.
    uint256[50] private __gap;

    // ── Events ─────────────────────────────────────────────

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

    // ── Errors ─────────────────────────────────────────────

    error InvoiceNotFound();
    error AlreadyPaid();
    error AlreadyCancelled();
    error WrongClient();
    error InvalidAmount();
    error InvalidDueDate();
    error FeeTooHigh();
    error ZeroAddress();
    error NotCreator();

    // ── Modifiers ──────────────────────────────────────────

    modifier invoiceExists(uint256 id) {
        if (invoices[id].id == 0) revert InvoiceNotFound();
        _;
    }

    // ── Constructor ────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ── Initializer ────────────────────────────────────────

    function initialize(
        address _stablecoin,
        address _feeRecipient
    ) external initializer {
        if (_stablecoin == address(0)) revert ZeroAddress();
        if (_feeRecipient == address(0)) revert ZeroAddress();

        __ReentrancyGuard_init();
        __Ownable_init(msg.sender);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();

        stablecoin = IERC20(_stablecoin);
        feeRecipient = _feeRecipient;
        platformFeeBps = 200;
        _nextId = 1;
    }

    // ── UUPS ───────────────────────────────────────────────

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    // ── Create Invoice ─────────────────────────────────────

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
        if (client != address(0)) _clientInvoices[client].push(id);

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

    // ── Pay Invoice ────────────────────────────────────────

    function payInvoice(uint256 id) external nonReentrant invoiceExists(id) {
        Invoice storage inv = invoices[id];

        // Checks
        if (inv.status == Status.Paid && !inv.isRecurring) revert AlreadyPaid();
        if (inv.status == Status.Cancelled) revert AlreadyCancelled();
        if (inv.client != address(0) && inv.client != msg.sender)
            revert WrongClient();

        // Effects
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

        // Interactions
        stablecoin.safeTransferFrom(msg.sender, address(this), inv.amount);
        stablecoin.safeTransfer(inv.creator, creatorAmount);
        if (fee > 0) stablecoin.safeTransfer(feeRecipient, fee);
    }

    // ── Cancel Invoice ─────────────────────────────────────

    function cancelInvoice(uint256 id) external invoiceExists(id) {
        Invoice storage inv = invoices[id];
        if (inv.creator != msg.sender) revert NotCreator();
        if (inv.status == Status.Paid) revert AlreadyPaid();
        if (inv.status == Status.Cancelled) revert AlreadyCancelled();
        inv.status = Status.Cancelled;
        emit InvoiceCancelled(id, msg.sender);
    }

    // ── Mark Overdue ───────────────────────────────────────

    function markOverdue(uint256 id) external invoiceExists(id) {
        Invoice storage inv = invoices[id];
        if (inv.status != Status.Unpaid) return;
        if (inv.dueDate == 0 || block.timestamp <= inv.dueDate) return;
        inv.status = Status.Overdue;
        emit InvoiceMarkedOverdue(id);
    }

    // ── Views ──────────────────────────────────────────────

    function getInvoice(
        uint256 id
    ) external view invoiceExists(id) returns (Invoice memory) {
        return invoices[id];
    }

    function getCreatorInvoices(
        address creator
    ) external view returns (uint256[] memory) {
        return _creatorInvoices[creator];
    }

    function getClientInvoices(
        address client
    ) external view returns (uint256[] memory) {
        return _clientInvoices[client];
    }

    function calculateFee(
        uint256 amount
    ) external view returns (uint256 fee, uint256 creatorReceives) {
        fee = (amount * platformFeeBps) / 10_000;
        creatorReceives = amount - fee;
    }

    function totalInvoices() external view returns (uint256) {
        return _nextId - 1;
    }

    // ── Admin ──────────────────────────────────────────────

    function setFee(uint256 newBps) external onlyOwner {
        if (newBps > MAX_FEE_BPS) revert FeeTooHigh();
        emit FeeUpdated(platformFeeBps, newBps);
        platformFeeBps = newBps;
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroAddress();
        emit FeeRecipientUpdated(feeRecipient, newRecipient);
        feeRecipient = newRecipient;
    }

    // ── Internal ───────────────────────────────────────────

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
