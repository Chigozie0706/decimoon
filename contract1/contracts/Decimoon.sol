// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Decimoon
 * @notice Programmable on-chain invoices — settlement layer.
 *
 * Architecture:
 *   ON-CHAIN  → payment logic, status, amounts, enforcement
 *   IPFS/CID  → metadata (title, names, line items, notes, logo)
 *
 * Supports:
 *   - Standard one-time invoices
 *   - Recurring invoices (weekly / biweekly / monthly)
 *   - Milestone invoices (per-phase payments)
 *   - Multi-token (any whitelisted ERC-20)
 *   - On-chain late fee enforcement
 *   - Dispute flow with owner resolution
 *   - Open invoices (anyone can pay)
 *   - Metadata update before payment
 */
contract Decimoon is ReentrancyGuard, Ownable2Step {
    using SafeERC20 for IERC20;

    //  Types

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
        uint256 lateFeesBps; // e.g. 150 = 1.5%
        uint256 lateFeeAccrued;
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

    //  State

    uint256 public platformFeeBps = 200; // 2%
    uint256 public constant MAX_FEE_BPS = 1000; // 10%
    uint256 public constant MAX_LATE_BPS = 1000; // 10%
    address public feeRecipient;

    uint256 private _nextId = 1;

    mapping(uint256 => Invoice) public invoices;
    mapping(uint256 => Milestone[]) private _milestones;
    mapping(address => uint256[]) private _creatorInvoices;
    mapping(address => uint256[]) private _clientInvoices;
    mapping(address => uint256) private _creatorCount;
    mapping(address => bool) public tokenWhitelist;

    //  Events

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

    //  Errors

    error InvoiceNotFound();
    error AlreadyPaid();
    error AlreadyCancelled();
    error AlreadyDisputed();
    error NotDisputed();
    error WrongClient();
    error InvalidAmount();
    error InvalidDueDate();
    error InvalidMilestones();
    error MilestoneAlreadyReleased();
    error MilestoneOutOfBounds();
    error NotMilestoneInvoice();
    error NotStandardOrRecurring();
    error FeeTooHigh();
    error ZeroAddress();
    error NotCreator();
    error NotParty();
    error TokenNotWhitelisted();
    error EmptyCID();

    //  Modifiers

    modifier invoiceExists(uint256 id) {
        if (invoices[id].id == 0) revert InvoiceNotFound();
        _;
    }

    modifier onlyCreator(uint256 id) {
        if (invoices[id].creator != msg.sender) revert NotCreator();
        _;
    }

    modifier onlyParty(uint256 id) {
        Invoice storage inv = invoices[id];
        if (inv.creator != msg.sender && inv.client != msg.sender)
            revert NotParty();
        _;
    }

    //  Constructor

    /**
     * @param _feeRecipient  Address receiving platform fees.
     * @param _initialTokens Whitelisted tokens at deploy time.
     *                       On Celo mainnet:
     *                       cUSD  0x765DE816845861e75A25fCA122bb6898B8B1282a
     *                       cEUR  0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73
     *                       cKES  0x456a3D042C0DbD3db53D5489e98dFb038553B0d0
     *                       USDC  0xcebA9300f2b948710d2653dD7B07f33A8B32118C
     */
    constructor(
        address _feeRecipient,
        address[] memory _initialTokens
    ) Ownable(msg.sender) {
        if (_feeRecipient == address(0)) revert ZeroAddress();
        feeRecipient = _feeRecipient;
        for (uint256 i = 0; i < _initialTokens.length; i++) {
            if (_initialTokens[i] != address(0)) {
                tokenWhitelist[_initialTokens[i]] = true;
                emit TokenWhitelisted(_initialTokens[i], true);
            }
        }
    }

    //  Create: Standard / Recurring

    /**
     * @notice Create a standard or recurring invoice.
     * @param client       Payer address. address(0) = open (anyone can pay).
     * @param token        Whitelisted ERC-20 token.
     * @param amount       Total amount in token units.
     * @param dueDate      Unix timestamp. 0 = no deadline.
     * @param lateFeesBps  Late fee rate in bps. 0 = disabled.
     * @param isRecurring  True = auto-renews.
     * @param interval     None | Weekly | Biweekly | Monthly.
     * @param metadataCID  IPFS CID of metadata JSON.
     */
    function createInvoice(
        address client,
        address token,
        uint256 amount,
        uint256 dueDate,
        uint256 lateFeesBps,
        bool isRecurring,
        Interval interval,
        string calldata metadataCID
    ) external returns (uint256 id) {
        if (!tokenWhitelist[token]) revert TokenNotWhitelisted();
        if (amount == 0) revert InvalidAmount();
        if (bytes(metadataCID).length == 0) revert EmptyCID();
        if (dueDate != 0 && dueDate <= block.timestamp) revert InvalidDueDate();
        if (isRecurring && interval == Interval.None) revert InvalidAmount();
        if (lateFeesBps > MAX_LATE_BPS) revert FeeTooHigh();

        id = _nextId++;
        InvoiceType iType = isRecurring
            ? InvoiceType.Recurring
            : InvoiceType.Standard;
        string memory ref = _generateRef(++_creatorCount[msg.sender]);

        invoices[id] = Invoice({
            id: id,
            invoiceRef: ref,
            metadataCID: metadataCID,
            creator: msg.sender,
            client: client,
            token: token,
            amount: amount,
            dueDate: dueDate,
            status: Status.Unpaid,
            invoiceType: iType,
            lateFeesBps: lateFeesBps,
            lateFeeAccrued: 0,
            interval: isRecurring ? interval : Interval.None,
            nextDueDate: isRecurring && dueDate != 0 ? dueDate : 0,
            totalCollected: 0,
            createdAt: block.timestamp,
            paidAt: 0,
            disputeReason: ""
        });

        _creatorInvoices[msg.sender].push(id);
        if (client != address(0)) _clientInvoices[client].push(id);

        emit InvoiceCreated(
            id,
            msg.sender,
            client,
            ref,
            metadataCID,
            token,
            amount,
            dueDate,
            iType,
            interval
        );
    }

    //  Create: Milestone

    /**
     * @notice Create a milestone invoice.
     *         Only amounts go on-chain; descriptions live in IPFS metadata.
     * @param client            Payer address.
     * @param token             Whitelisted ERC-20 token.
     * @param dueDate           Overall deadline. 0 = none.
     * @param milestoneAmounts  Per-milestone amounts. At least one required.
     * @param metadataCID       IPFS CID of metadata JSON.
     */
    function createMilestoneInvoice(
        address client,
        address token,
        uint256 dueDate,
        uint256[] calldata milestoneAmounts,
        string calldata metadataCID
    ) external returns (uint256 id) {
        if (!tokenWhitelist[token]) revert TokenNotWhitelisted();
        if (milestoneAmounts.length == 0) revert InvalidMilestones();
        if (bytes(metadataCID).length == 0) revert EmptyCID();
        if (dueDate != 0 && dueDate <= block.timestamp) revert InvalidDueDate();

        uint256 total = 0;
        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            if (milestoneAmounts[i] == 0) revert InvalidAmount();
            total += milestoneAmounts[i];
        }

        id = _nextId++;
        string memory ref = _generateRef(++_creatorCount[msg.sender]);

        invoices[id] = Invoice({
            id: id,
            invoiceRef: ref,
            metadataCID: metadataCID,
            creator: msg.sender,
            client: client,
            token: token,
            amount: total,
            dueDate: dueDate,
            status: Status.Unpaid,
            invoiceType: InvoiceType.Milestone,
            lateFeesBps: 0,
            lateFeeAccrued: 0,
            interval: Interval.None,
            nextDueDate: 0,
            totalCollected: 0,
            createdAt: block.timestamp,
            paidAt: 0,
            disputeReason: ""
        });

        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            _milestones[id].push(
                Milestone({
                    amount: milestoneAmounts[i],
                    released: false,
                    releasedAt: 0
                })
            );
        }

        _creatorInvoices[msg.sender].push(id);
        if (client != address(0)) _clientInvoices[client].push(id);

        emit InvoiceCreated(
            id,
            msg.sender,
            client,
            ref,
            metadataCID,
            token,
            total,
            dueDate,
            InvoiceType.Milestone,
            Interval.None
        );
    }

    //  Pay: Standard / Recurring

    /**
     * @notice Pay a standard or recurring invoice.
     *         Caller must approve this contract for amount + any late fee.
     *         Use calculateTotalDue() to get the exact amount first.
     */
    function payInvoice(uint256 id) external nonReentrant invoiceExists(id) {
        Invoice storage inv = invoices[id];

        if (inv.invoiceType == InvoiceType.Milestone)
            revert NotStandardOrRecurring();
        if (inv.status == Status.Paid) revert AlreadyPaid();
        if (inv.status == Status.Cancelled) revert AlreadyCancelled();
        if (inv.status == Status.Disputed) revert AlreadyDisputed();
        if (inv.client != address(0) && inv.client != msg.sender)
            revert WrongClient();

        // Auto-mark overdue
        if (
            inv.dueDate != 0 &&
            block.timestamp > inv.dueDate &&
            inv.status == Status.Unpaid
        ) {
            inv.status = Status.Overdue;
            emit InvoiceMarkedOverdue(id);
        }

        // Enforce late fee
        uint256 lateFee = 0;
        if (inv.status == Status.Overdue && inv.lateFeesBps > 0) {
            lateFee = (inv.amount * inv.lateFeesBps) / 10_000;
            inv.lateFeeAccrued += lateFee;
        }

        uint256 totalDue = inv.amount + lateFee;
        uint256 fee = (totalDue * platformFeeBps) / 10_000;
        uint256 creatorAmount = totalDue - fee;

        inv.totalCollected += totalDue;

        if (inv.invoiceType == InvoiceType.Recurring) {
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
            lateFee,
            creatorAmount,
            block.timestamp
        );

        // CEI: interactions last
        IERC20 token = IERC20(inv.token);
        token.safeTransferFrom(msg.sender, address(this), totalDue);
        token.safeTransfer(inv.creator, creatorAmount);
        if (fee > 0) token.safeTransfer(feeRecipient, fee);
    }

    //  Pay: Milestone

    /**
     * @notice Release a single milestone payment.
     *         Client approves and triggers each phase individually.
     */
    function releaseMilestone(
        uint256 invoiceId,
        uint256 milestoneIndex
    ) external nonReentrant invoiceExists(invoiceId) {
        Invoice storage inv = invoices[invoiceId];

        if (inv.invoiceType != InvoiceType.Milestone)
            revert NotMilestoneInvoice();
        if (inv.status == Status.Cancelled) revert AlreadyCancelled();
        if (inv.status == Status.Disputed) revert AlreadyDisputed();
        if (inv.client != address(0) && inv.client != msg.sender)
            revert WrongClient();

        Milestone[] storage ms = _milestones[invoiceId];
        if (milestoneIndex >= ms.length) revert MilestoneOutOfBounds();

        Milestone storage m = ms[milestoneIndex];
        if (m.released) revert MilestoneAlreadyReleased();

        uint256 fee = (m.amount * platformFeeBps) / 10_000;
        uint256 creatorAmount = m.amount - fee;

        m.released = true;
        m.releasedAt = block.timestamp;
        inv.totalCollected += m.amount;

        // Mark invoice paid when all milestones released
        bool allDone = true;
        for (uint256 i = 0; i < ms.length; i++) {
            if (!ms[i].released) {
                allDone = false;
                break;
            }
        }
        if (allDone) {
            inv.status = Status.Paid;
            inv.paidAt = block.timestamp;
        }

        emit MilestoneReleased(
            invoiceId,
            milestoneIndex,
            m.amount,
            fee,
            creatorAmount,
            block.timestamp
        );

        IERC20 token = IERC20(inv.token);
        token.safeTransferFrom(msg.sender, address(this), m.amount);
        token.safeTransfer(inv.creator, creatorAmount);
        if (fee > 0) token.safeTransfer(feeRecipient, fee);
    }

    //  Cancel / Dispute

    function cancelInvoice(
        uint256 id
    ) external invoiceExists(id) onlyCreator(id) {
        Invoice storage inv = invoices[id];
        if (inv.status == Status.Paid) revert AlreadyPaid();
        if (inv.status == Status.Cancelled) revert AlreadyCancelled();
        inv.status = Status.Cancelled;
        emit InvoiceCancelled(id, msg.sender);
    }

    function disputeInvoice(
        uint256 id,
        string calldata reason
    ) external invoiceExists(id) onlyParty(id) {
        Invoice storage inv = invoices[id];
        if (inv.status == Status.Paid) revert AlreadyPaid();
        if (inv.status == Status.Cancelled) revert AlreadyCancelled();
        if (inv.status == Status.Disputed) revert AlreadyDisputed();
        inv.status = Status.Disputed;
        inv.disputeReason = reason;
        emit InvoiceDisputed(id, msg.sender, reason);
    }

    /// @notice Owner resolves dispute → resets to Unpaid.
    function resolveDispute(uint256 id) external onlyOwner invoiceExists(id) {
        Invoice storage inv = invoices[id];
        if (inv.status != Status.Disputed) revert NotDisputed();
        inv.status = Status.Unpaid;
        inv.disputeReason = "";
        emit DisputeResolved(id);
    }

    //  Mark Overdue

    /// @notice Anyone can mark overdue. Useful for keepers / bots.
    function markOverdue(uint256 id) external invoiceExists(id) {
        Invoice storage inv = invoices[id];
        if (inv.status != Status.Unpaid) return;
        if (inv.dueDate == 0 || block.timestamp <= inv.dueDate) return;
        inv.status = Status.Overdue;
        emit InvoiceMarkedOverdue(id);
    }

    //  Metadata Update

    /// @notice Update IPFS metadata before payment (e.g. correct a typo).
    function updateMetadata(
        uint256 id,
        string calldata newCID
    ) external invoiceExists(id) onlyCreator(id) {
        Invoice storage inv = invoices[id];
        if (inv.status == Status.Paid) revert AlreadyPaid();
        if (inv.status == Status.Cancelled) revert AlreadyCancelled();
        if (bytes(newCID).length == 0) revert EmptyCID();
        inv.metadataCID = newCID;
        emit MetadataUpdated(id, newCID);
    }

    //  Views

    function getInvoice(
        uint256 id
    ) external view invoiceExists(id) returns (Invoice memory) {
        return invoices[id];
    }

    function getMilestones(
        uint256 id
    ) external view invoiceExists(id) returns (Milestone[] memory) {
        return _milestones[id];
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

    function getInvoicesByStatus(
        address creator,
        Status status
    ) external view returns (uint256[] memory) {
        uint256[] storage ids = _creatorInvoices[creator];
        uint256 count = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            if (invoices[ids[i]].status == status) count++;
        }
        uint256[] memory result = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            if (invoices[ids[i]].status == status) result[idx++] = ids[i];
        }
        return result;
    }

    /// @notice Get exact amount to approve before calling payInvoice().
    function calculateTotalDue(
        uint256 id
    )
        external
        view
        invoiceExists(id)
        returns (
            uint256 principal,
            uint256 lateFee,
            uint256 platformFee,
            uint256 totalDue
        )
    {
        Invoice storage inv = invoices[id];
        principal = inv.amount;
        lateFee = 0;
        if (
            inv.lateFeesBps > 0 &&
            inv.dueDate != 0 &&
            block.timestamp > inv.dueDate
        ) {
            lateFee = (inv.amount * inv.lateFeesBps) / 10_000;
        }
        totalDue = principal + lateFee;
        platformFee = (totalDue * platformFeeBps) / 10_000;
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

    //  Admin

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

    function setTokenWhitelist(address token, bool status) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        tokenWhitelist[token] = status;
        emit TokenWhitelisted(token, status);
    }

    //  Internal

    function _nextDueDate(
        uint256 from,
        Interval interval
    ) internal pure returns (uint256) {
        if (interval == Interval.Weekly) return from + 7 days;
        if (interval == Interval.Biweekly) return from + 14 days;
        if (interval == Interval.Monthly) return from + 30 days;
        return 0;
    }

    function _generateRef(uint256 count) internal pure returns (string memory) {
        string memory num = _uintToString(count);
        if (count < 10) num = string(abi.encodePacked("00", num));
        else if (count < 100) num = string(abi.encodePacked("0", num));
        return string(abi.encodePacked("INV-", num));
    }

    function _uintToString(
        uint256 value
    ) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits = 0;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buf = new bytes(digits);
        while (value != 0) {
            digits--;
            buf[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buf);
    }
}
