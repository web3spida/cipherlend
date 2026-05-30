// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {UnderwritingEngine} from "./UnderwritingEngine.sol";

contract LoanVault is Ownable, ReentrancyGuard {
    enum LoanStatus {
        Pending,
        Active,
        Overdue,
        Defaulted,
        Repaid
    }

    struct Loan {
        address borrower;
        address lender;
        uint256 principal;
        uint256 interestRateBps;
        uint256 ltvBps;
        uint8 riskBand;
        uint256 issuedAt;
        uint256 termMonths;
        uint256 nextPaymentDue;
        uint256 remainingBalance;
        LoanStatus status;
        bytes32 underwritingScoreId;
    }

    struct PendingLoanView {
        uint256 loanId;
        address borrower;
        uint256 principal;
        uint256 interestRateBps;
        uint256 ltvBps;
        uint8 riskBand;
        uint256 termMonths;
        bytes32 underwritingScoreId;
    }

    uint256 public constant SCORE_VALIDITY = 90 days;
    uint256 public constant PAYMENT_INTERVAL = 30 days;

    UnderwritingEngine public immutable underwritingEngine;

    mapping(uint256 => Loan) public loans;
    mapping(address => uint256[]) public borrowerLoans;
    mapping(address => uint256[]) public lenderLoans;
    uint256[] private pendingLoanIds;
    uint256 public loanCounter;

    event LoanRequested(uint256 indexed loanId, address borrower);
    event LoanFunded(uint256 indexed loanId, address lender, uint256 amount);
    event PaymentMade(uint256 indexed loanId, uint256 amount);
    event LoanRepaid(uint256 indexed loanId);
    event CovenantBreach(uint256 indexed loanId, uint8 newBand);
    event LoanOverdue(uint256 indexed loanId);

    constructor(address underwritingEngineAddress) Ownable(msg.sender) {
        underwritingEngine = UnderwritingEngine(underwritingEngineAddress);
    }

    function requestLoan(
        uint256 requestedAmount,
        uint256 termMonths,
        UnderwritingEngine.DecryptedTerms calldata terms
    ) external {
        require(requestedAmount > 0, "INVALID_AMOUNT");
        require(termMonths > 0 && termMonths <= 60, "INVALID_TERM");

        (
            uint256 computedAt,
            bytes32 scoreId,
            ,
            bool valid
        ) = underwritingEngine.verifyDecryptedTerms(msg.sender, terms);

        require(valid, "INVALID_SCORE_PROOF");
        require(block.timestamp - computedAt <= SCORE_VALIDITY, "SCORE_EXPIRED");
        require(terms.riskBand != 6, "BORROWER_REJECTED");
        require(requestedAmount <= terms.maxLoanSize, "EXCEEDS_MAX_LOAN");

        loanCounter += 1;
        loans[loanCounter] = Loan({
            borrower: msg.sender,
            lender: address(0),
            principal: requestedAmount,
            interestRateBps: terms.interestRateBps,
            ltvBps: terms.ltvBps,
            riskBand: terms.riskBand,
            issuedAt: 0,
            termMonths: termMonths,
            nextPaymentDue: 0,
            remainingBalance: requestedAmount,
            status: LoanStatus.Pending,
            underwritingScoreId: scoreId
        });

        borrowerLoans[msg.sender].push(loanCounter);
        pendingLoanIds.push(loanCounter);
        emit LoanRequested(loanCounter, msg.sender);
    }

    function fundLoan(uint256 loanId) external payable nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.borrower != address(0), "LOAN_NOT_FOUND");
        require(loan.status == LoanStatus.Pending, "NOT_PENDING");
        require(msg.value == loan.principal, "INVALID_FUNDING_AMOUNT");

        loan.lender = msg.sender;
        loan.status = LoanStatus.Active;
        loan.issuedAt = block.timestamp;
        loan.nextPaymentDue = block.timestamp + PAYMENT_INTERVAL;
        lenderLoans[msg.sender].push(loanId);
        _removePendingLoan(loanId);

        (bool sent, ) = payable(loan.borrower).call{value: msg.value}("");
        require(sent, "TRANSFER_FAILED");
        emit LoanFunded(loanId, msg.sender, msg.value);
    }

    function makePayment(uint256 loanId) external payable nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.borrower != address(0), "LOAN_NOT_FOUND");
        require(msg.sender == loan.borrower, "NOT_BORROWER");
        require(loan.status == LoanStatus.Active || loan.status == LoanStatus.Overdue, "LOAN_NOT_PAYABLE");
        require(msg.value > 0, "INVALID_PAYMENT");

        uint256 payment = msg.value;
        if (payment > loan.remainingBalance) {
            payment = loan.remainingBalance;
        }
        loan.remainingBalance -= payment;

        (bool sent, ) = payable(loan.lender).call{value: payment}("");
        require(sent, "LENDER_TRANSFER_FAILED");
        emit PaymentMade(loanId, payment);

        if (loan.remainingBalance == 0) {
            loan.status = LoanStatus.Repaid;
            loan.nextPaymentDue = 0;
            emit LoanRepaid(loanId);
            return;
        }

        loan.status = LoanStatus.Active;
        loan.nextPaymentDue = block.timestamp + PAYMENT_INTERVAL;
    }

    function refreshCovenants(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        require(loan.borrower != address(0), "LOAN_NOT_FOUND");
        require(
            loan.status == LoanStatus.Active || loan.status == LoanStatus.Overdue,
            "COVENANT_CHECK_NOT_ALLOWED"
        );

        underwritingEngine.runUnderwriting(loan.borrower);
    }

    function checkCovenants(uint256 loanId, UnderwritingEngine.DecryptedTerms calldata terms) external {
        Loan storage loan = loans[loanId];
        require(loan.borrower != address(0), "LOAN_NOT_FOUND");
        require(
            loan.status == LoanStatus.Active || loan.status == LoanStatus.Overdue,
            "COVENANT_CHECK_NOT_ALLOWED"
        );

        (, , , bool valid) = underwritingEngine.verifyDecryptedTerms(loan.borrower, terms);
        require(valid, "INVALID_SCORE_PROOF");

        if (terms.riskBand > loan.riskBand) {
            emit CovenantBreach(loanId, terms.riskBand);
            if (terms.riskBand == 6) {
                loan.status = LoanStatus.Defaulted;
            }
        }
    }

    function markOverdue(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        require(loan.borrower != address(0), "LOAN_NOT_FOUND");
        require(loan.status == LoanStatus.Active, "NOT_ACTIVE");
        require(block.timestamp > loan.nextPaymentDue, "NOT_OVERDUE");
        loan.status = LoanStatus.Overdue;
        emit LoanOverdue(loanId);
    }

    function getLoanDetails(uint256 loanId) external view returns (Loan memory) {
        return loans[loanId];
    }

    function getPendingLoanIds() external view returns (uint256[] memory) {
        return pendingLoanIds;
    }

    function getBorrowerLoanIds(address borrower) external view returns (uint256[] memory) {
        return borrowerLoans[borrower];
    }

    function getLenderLoanIds(address lender) external view returns (uint256[] memory) {
        return lenderLoans[lender];
    }

    function getPendingLoans() external view returns (PendingLoanView[] memory pendingLoans) {
        pendingLoans = new PendingLoanView[](pendingLoanIds.length);
        for (uint256 i = 0; i < pendingLoanIds.length; i++) {
            uint256 loanId = pendingLoanIds[i];
            Loan storage loan = loans[loanId];
            pendingLoans[i] = PendingLoanView({
                loanId: loanId,
                borrower: loan.borrower,
                principal: loan.principal,
                interestRateBps: loan.interestRateBps,
                ltvBps: loan.ltvBps,
                riskBand: loan.riskBand,
                termMonths: loan.termMonths,
                underwritingScoreId: loan.underwritingScoreId
            });
        }
    }

    function _removePendingLoan(uint256 loanId) internal {
        for (uint256 i = 0; i < pendingLoanIds.length; i++) {
            if (pendingLoanIds[i] == loanId) {
                pendingLoanIds[i] = pendingLoanIds[pendingLoanIds.length - 1];
                pendingLoanIds.pop();
                return;
            }
        }
    }
}
