// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Utils.sol";
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
contract Decimoon is Initializable, Ownable2StepUpgradeable, UUPSUpgradeable {
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
        uint256 milestonesReleased; // counter — avoids O(n) loop on milestone completion
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
    //      NEVER remove or reorder these variables.
    //      Only append new variables ABOVE __gap
    //      when writing V2, V3, etc. Reduce __gap
    //      size by the number of slots you add.
    // ─────────────────────────────────────────────

    uint256 public platformFeeBps;
    address public feeRecipient;
    uint256 private _nextId;

    // ── Reentrancy guard ─────────────────────────────────────────────────────
    uint256 private _reentrancyStatus;
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    mapping(uint256 => Invoice) public invoices;
    mapping(uint256 => Milestone[]) private _milestones;
    mapping(address => uint256[]) private _creatorInvoices;
    mapping(address => uint256[]) private _clientInvoices;
    mapping(address => uint256) private _creatorCount;
    mapping(address => bool) public tokenWhitelist;

    /// @dev Reserves 50 storage slots for future V1 variables.
    ///      Each new variable added in an upgrade uses one slot.
    ///      Reduce this by 1 per added variable e.g. [49], [48]...
    uint256[49] private __gap;

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

    // ─────────────────────────────────────────────
    //  Modifiers
    // ─────────────────────────────────────────────

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

    modifier nonReentrant() {
        if (_reentrancyStatus == _ENTERED)
            revert("ReentrancyGuard: reentrant call");
        _reentrancyStatus = _ENTERED;
        _;
        _reentrancyStatus = _NOT_ENTERED;
    }

    // ─────────────────────────────────────────────
    //  Constructor — disabled for proxy pattern
    // ─────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ─────────────────────────────────────────────
    //  Initialize
    // ─────────────────────────────────────────────

    /**
     * @notice Initialize the contract. Called once through the proxy on deployment.
     * @param _initialOwner  Address that will own and control the contract.
     *                       Pass your wallet or multisig — NOT a factory address.
     * @param _feeRecipient  Address receiving platform fees (can be same as owner).
     * @param _initialTokens Tokens to whitelist at deploy time.
     */
    function initialize(
        address _initialOwner,
        address _feeRecipient,
        address[] memory _initialTokens
    ) external initializer {
        if (_initialOwner == address(0)) revert ZeroAddress();
        if (_feeRecipient == address(0)) revert ZeroAddress();

        __Ownable_init(_initialOwner);
        __Ownable2Step_init();
        _reentrancyStatus = _NOT_ENTERED;

        feeRecipient = _feeRecipient;
        platformFeeBps = 200; // 2% — must never exceed MAX_FEE_BPS
        require(platformFeeBps <= MAX_FEE_BPS, "fee exceeds max");
        _nextId = 1;

        for (uint256 i = 0; i < _initialTokens.length; i++) {
            if (_initialTokens[i] != address(0)) {
                tokenWhitelist[_initialTokens[i]] = true;
                emit TokenWhitelisted(_initialTokens[i], true);
            }
        }

        emit ContractInitialized(_initialOwner, _feeRecipient, 200);
    }

    // ─────────────────────────────────────────────
    //  UUPS — authorize upgrade
    // ─────────────────────────────────────────────

    /**
     * @dev Only owner can upgrade the implementation.
     *      Called internally by upgradeToAndCall().
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    // ─────────────────────────────────────────────
    //  Create: Standard / Recurring
    // ─────────────────────────────────────────────

    /**
     * @notice Create a standard or recurring invoice.
     * @param client       Payer address. address(0) = open invoice.
     * @param token        Whitelisted ERC-20 token.
     * @param amount       Total amount in token units.
     * @param dueDate      Unix timestamp deadline.
     *                     Required for recurring invoices.
     *                     0 = no deadline (standard only).
     * @param lateFeesBps  Late fee rate in bps PER DAY. 0 = disabled.
     *                     e.g. 50 = 0.5% per day late.
     * @param isRecurring  True = auto-renews on interval.
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
        if (token == address(0)) revert ZeroAddress();
        if (!tokenWhitelist[token]) revert TokenNotWhitelisted();
        if (amount == 0) revert InvalidAmount();
        if (bytes(metadataCID).length == 0) revert EmptyCID();
        if (dueDate != 0 && dueDate <= block.timestamp) revert InvalidDueDate();
        if (isRecurring && interval == Interval.None) revert InvalidInterval();
        if (isRecurring && dueDate == 0) revert RecurringRequiresDueDate();
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
            interval: isRecurring ? interval : Interval.None,
            nextDueDate: isRecurring ? dueDate : 0,
            totalCollected: 0,
            milestonesReleased: 0,
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

    // ─────────────────────────────────────────────
    //  Create: Milestone
    /**
     *  Only amounts on-chain; descriptions in IPFS metadata.
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
        if (token == address(0)) revert ZeroAddress();
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
            interval: Interval.None,
            nextDueDate: 0,
            totalCollected: 0,
            milestonesReleased: 0,
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

    // ─────────────────────────────────────────────
    //  Pay: Standard / Recurring
    // ─────────────────────────────────────────────

    /**
     * @notice Pay a standard or recurring invoice.
     *         Call calculateTotalDue() first to get the exact approve amount.
     *
     * Late fee formula: amount × lateFeesBps × daysLate / 10_000
     * e.g. $500 invoice, 50 bps/day, 3 days late = $500 × 0.5% × 3 = $7.50
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

        // Time-based late fee: lateFeesBps per day
        // Capped at 100% of principal — client never owes more than 2× the invoice
        uint256 lateFee = 0;
        if (inv.status == Status.Overdue && inv.lateFeesBps > 0) {
            uint256 daysLate = (block.timestamp - inv.dueDate) / 1 days;
            if (daysLate == 0) daysLate = 1; // minimum 1 day if overdue
            lateFee = (inv.amount * inv.lateFeesBps * daysLate) / 10_000;
            if (lateFee > inv.amount) lateFee = inv.amount; // cap at 100%
        }

        // Platform fee applies to principal ONLY (not late fees).
        // Late fees go fully to creator — client is not double-penalised.
        // Client pays: inv.amount + platformFee + lateFee
        // Creator gets: inv.amount + lateFee (full invoiced amount + late penalty)
        uint256 fee = (inv.amount * platformFeeBps) / 10_000;
        uint256 creatorAmount = inv.amount + lateFee;

        // Cache values needed after transfer before any state changes
        address creator = inv.creator;
        address tokenAddr = inv.token;
        bool isRecurring = inv.invoiceType == InvoiceType.Recurring;
        uint256 nextDue = isRecurring
            ? _nextDueDate(inv.nextDueDate, inv.interval)
            : 0;

        // ── INTERACTIONS first (CEI) ──────────────────────────────────────
        // State is unchanged during transfers — safe even against exotic tokens.
        IERC20 token = IERC20(tokenAddr);
        token.safeTransferFrom(msg.sender, creator, creatorAmount);
        if (fee > 0) token.safeTransferFrom(msg.sender, feeRecipient, fee);

        // ── EFFECTS after confirmed transfers ─────────────────────────────
        inv.totalCollected += creatorAmount;

        if (isRecurring) {
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
    }

    // ─────────────────────────────────────────────
    //  Pay: Milestone
    // ─────────────────────────────────────────────

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

        // Option B: platform fee added ON TOP — creator receives full milestone amount.
        // Client pays: m.amount + platformFee
        // Creator gets: m.amount (full milestone amount)
        uint256 fee = (m.amount * platformFeeBps) / 10_000;
        uint256 creatorAmount = m.amount;
        uint256 milestoneAmt = m.amount; // cache before state changes

        // Cache addresses before state changes
        address creator = inv.creator;
        address tokenAddr = inv.token;
        uint256 msLength = ms.length;

        // ── INTERACTIONS first (CEI) ──────────────────────────────────────
        IERC20 token = IERC20(tokenAddr);
        token.safeTransferFrom(msg.sender, creator, creatorAmount);
        if (fee > 0) token.safeTransferFrom(msg.sender, feeRecipient, fee);

        // ── EFFECTS after confirmed transfers ─────────────────────────────
        m.released = true;
        m.releasedAt = block.timestamp;
        inv.totalCollected += milestoneAmt;
        inv.milestonesReleased += 1;

        // O(1) completion check — no loop needed
        if (inv.milestonesReleased == msLength) {
            inv.status = Status.Paid;
            inv.paidAt = block.timestamp;
        }

        emit MilestoneReleased(
            invoiceId,
            milestoneIndex,
            milestoneAmt,
            fee,
            creatorAmount,
            block.timestamp
        );
    }

    // ─────────────────────────────────────────────
    //  Cancel / Dispute
    // ─────────────────────────────────────────────

    function cancelInvoice(
        uint256 id
    ) external invoiceExists(id) onlyCreator(id) {
        Invoice storage inv = invoices[id];
        if (inv.status == Status.Paid) revert AlreadyPaid();
        if (inv.status == Status.Cancelled) revert AlreadyCancelled();
        inv.status = Status.Cancelled;
        emit InvoiceCancelled(id, msg.sender);
    }

    /**
     * @notice Raise a dispute. Freezes the invoice — no payments accepted.
     *         Either creator or client can dispute.
     */
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

    /**
     * @notice Resolve a dispute. Owner only.
     *         Owner has full control over dispute resolution.
     *         Resets status to Unpaid so payment can proceed.
     *         Owner may also cancel the invoice after resolving if needed.
     */
    function resolveDispute(uint256 id) external onlyOwner invoiceExists(id) {
        Invoice storage inv = invoices[id];
        if (inv.status != Status.Disputed) revert NotDisputed();
        inv.status = Status.Unpaid;
        inv.disputeReason = "";
        emit DisputeResolved(id);
    }

    // ─────────────────────────────────────────────
    //  Mark Overdue
    // ─────────────────────────────────────────────

    /// @notice Anyone can mark overdue once past due date. Good for keepers / bots.
    function markOverdue(uint256 id) external invoiceExists(id) {
        Invoice storage inv = invoices[id];
        if (inv.status != Status.Unpaid) return;
        if (inv.dueDate == 0 || block.timestamp <= inv.dueDate) return;
        inv.status = Status.Overdue;
        emit InvoiceMarkedOverdue(id);
    }

    // ─────────────────────────────────────────────
    //  Metadata Update
    // ─────────────────────────────────────────────

    /// @notice Update IPFS metadata CID before payment (e.g. fix a typo).
    ///         Not allowed once paid or cancelled.
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

    // ─────────────────────────────────────────────
    //  Views
    // ─────────────────────────────────────────────

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

    /**
     * @notice Preview exact amounts before paying.
     *         Always call this right before triggering wallet approval —
     *         late fees accrue per day so the amount can change overnight.
     *         Approve exactly `totalDue` on the token contract.
     *
     * Fee model:
     *   Platform fee: applied to principal ONLY (not late fees)
     *   Late fees:    go fully to creator
     *   Creator gets: principal + lateFee
     *   Client pays:  principal + platformFee + lateFee
     *
     * Late fee = principal × lateFeesBps × daysLate / 10_000
     */
    function calculateTotalDue(
        uint256 id
    )
        external
        view
        invoiceExists(id)
        returns (
            uint256 principal,
            uint256 lateFee,
            uint256 daysLate,
            uint256 platformFee,
            uint256 creatorReceives,
            uint256 totalDue
        )
    {
        Invoice storage inv = invoices[id];
        principal = inv.amount;
        lateFee = 0;
        daysLate = 0;

        if (
            inv.lateFeesBps > 0 &&
            inv.dueDate != 0 &&
            block.timestamp > inv.dueDate
        ) {
            daysLate = (block.timestamp - inv.dueDate) / 1 days;
            if (daysLate == 0) daysLate = 1;
            lateFee = (principal * inv.lateFeesBps * daysLate) / 10_000;
            if (lateFee > principal) lateFee = principal; // cap at 100%
        }

        // Fee on principal only — late fees fully to creator
        platformFee = (principal * platformFeeBps) / 10_000;
        creatorReceives = principal + lateFee;
        totalDue = creatorReceives + platformFee;
    }

    /// @notice Calculate platform fee for a given amount (fee on top).
    ///         creatorReceives = amount (full), clientPays = amount + fee
    function calculateFee(
        uint256 amount
    ) external view returns (uint256 fee, uint256 clientPays) {
        fee = (amount * platformFeeBps) / 10_000;
        clientPays = amount + fee;
    }

    /**
     * @notice Returns the exact token amount the client must approve
     *         before calling payInvoice(). Call this immediately before
     *         triggering the wallet — never cache this value.
     *
     *         For milestone invoices use getMilestoneClientTotal() instead.
     */
    function getClientTotal(
        uint256 id
    ) external view invoiceExists(id) returns (uint256 totalDue) {
        Invoice storage inv = invoices[id];

        uint256 lateFee = 0;
        if (
            inv.lateFeesBps > 0 &&
            inv.dueDate != 0 &&
            block.timestamp > inv.dueDate
        ) {
            uint256 daysLate = (block.timestamp - inv.dueDate) / 1 days;
            if (daysLate == 0) daysLate = 1;
            lateFee = (inv.amount * inv.lateFeesBps * daysLate) / 10_000;
            if (lateFee > inv.amount) lateFee = inv.amount; // cap at 100%
        }

        uint256 platformFee = (inv.amount * platformFeeBps) / 10_000;
        totalDue = inv.amount + lateFee + platformFee;
    }

    /**
     * @notice Returns the exact token amount the client must approve
     *         before calling releaseMilestone().
     * @param invoiceId      The invoice ID.
     * @param milestoneIndex The milestone index to release.
     */
    function getMilestoneClientTotal(
        uint256 invoiceId,
        uint256 milestoneIndex
    ) external view invoiceExists(invoiceId) returns (uint256 totalDue) {
        Milestone[] storage ms = _milestones[invoiceId];
        if (milestoneIndex >= ms.length) revert MilestoneOutOfBounds();
        uint256 amount = ms[milestoneIndex].amount;
        uint256 platformFee = (amount * platformFeeBps) / 10_000;
        totalDue = amount + platformFee;
    }

    function totalInvoices() external view returns (uint256) {
        return _nextId - 1;
    }

    /// @notice Returns the current implementation address.
    function implementation() external view returns (address) {
        return ERC1967Utils.getImplementation();
    }

    // ─────────────────────────────────────────────
    //  Admin
    // ─────────────────────────────────────────────

    /**
     * @notice Update platform fee.
     *         Hard cap: MAX_FEE_BPS (10%).
     *         Max change per call: MAX_FEE_DELTA_BPS (2%).
     *         This prevents sudden large fee increases.
     */
    function setFee(uint256 newBps) external onlyOwner {
        if (newBps > MAX_FEE_BPS) revert FeeTooHigh();
        uint256 delta = newBps > platformFeeBps
            ? newBps - platformFeeBps
            : platformFeeBps - newBps;
        if (delta > MAX_FEE_DELTA_BPS) revert FeeDeltaTooHigh();
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
