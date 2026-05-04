// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {FHE, ebool, euint8, euint32} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {BorrowerRegistry} from "./BorrowerRegistry.sol";

contract UnderwritingEngine is Ownable {
    uint256 public constant DSCR_WEIGHT = 40;
    uint256 public constant RUNWAY_WEIGHT = 30;
    uint256 public constant LEVERAGE_WEIGHT = 20;
    uint256 public constant RECEIVABLES_WEIGHT = 10;

    uint256 public constant MIN_BUSINESS_AGE = 12;
    uint256 public constant MAX_PROFILE_AGE = 180 days;

    uint256 public constant BAND_AA_THRESHOLD = 85;
    uint256 public constant BAND_A_THRESHOLD = 70;
    uint256 public constant BAND_BBB_THRESHOLD = 55;
    uint256 public constant BAND_BB_THRESHOLD = 40;
    uint256 public constant BAND_B_THRESHOLD = 25;
    uint256 public constant SCORE_MAX_AGE = 90 days;

    struct CreditScore {
        euint8 riskBand;
        euint32 maxLoanSize;
        euint32 interestRateBps;
        euint32 ltvBps;
        euint8 revenueBucket;
        uint256 computedAt;
        bytes32 proofHash;
        bool exists;
    }

    struct ScoreSignals {
        ebool dscrAboveThreshold;
        ebool leverageWithinPolicy;
        ebool covenantCompliant;
    }

    struct DecryptedTerms {
        uint8 riskBand;
        uint32 maxLoanSize;
        uint32 interestRateBps;
        uint32 ltvBps;
        bytes riskBandSignature;
        bytes maxLoanSizeSignature;
        bytes interestRateSignature;
        bytes ltvSignature;
    }

    BorrowerRegistry public immutable borrowerRegistry;
    address public loanVault;

    mapping(address => CreditScore) private creditScores;
    mapping(address => bytes32) public latestScoreId;
    mapping(bytes32 => address) public scoreBorrower;
    mapping(address => ScoreSignals) private scoreSignals;

    event UnderwritingComplete(address indexed borrower, bytes32 indexed scoreId, uint256 computedAt);
    event ScoreExpired(address indexed borrower);
    event ScoreAccessGranted(address indexed borrower, address indexed account);

    error OnlyLoanVault();
    error ScoreNotFound();
    error AccessNotAllowed();

    constructor(address borrowerRegistryAddress) Ownable(msg.sender) {
        borrowerRegistry = BorrowerRegistry(borrowerRegistryAddress);
    }

    function setLoanVault(address loanVaultAddress) external onlyOwner {
        loanVault = loanVaultAddress;
    }

    function runUnderwriting(address borrower) external returns (bytes32 scoreId) {
        (BorrowerRegistry.BorrowerProfile memory profile, bool exists) = borrowerRegistry.getEncryptedProfile(borrower);

        require(exists, "PROFILE_NOT_FOUND");
        require(block.timestamp - profile.submittedAt <= MAX_PROFILE_AGE, "PROFILE_TOO_OLD");

        euint32 dscrScore = _computeDSCR(profile.annualRevenue, profile.totalDebt);
        euint32 runwayScore = _computeRunway(profile.cashOnHand, profile.monthlyBurnRate);
        euint32 leverageScore = _computeLeverageRatio(profile.totalDebt, profile.annualRevenue);
        euint32 receivablesScore = _computeReceivablesScore(profile.accountsReceivable, profile.annualRevenue);
        euint32 aggregate = _aggregateScore(dscrScore, runwayScore, leverageScore, receivablesScore);

        ebool ageEligible = profile.businessAgeMonths.gte(FHE.asEuint32(MIN_BUSINESS_AGE));
        euint32 adjustedScore = FHE.select(ageEligible, aggregate, FHE.asEuint32(0));
        euint8 band = _mapToBand(adjustedScore);
        euint8 revenueBucket = _bucketRevenue(profile.annualRevenue);

        (euint32 maxLoanSize, euint32 interestRateBps, euint32 ltvBps) = _computeLoanTerms(
            adjustedScore,
            profile.annualRevenue
        );
        bytes32 proofHash = keccak256(
            abi.encode(
                euint8.unwrap(band),
                euint32.unwrap(maxLoanSize),
                euint32.unwrap(interestRateBps),
                euint32.unwrap(ltvBps),
                euint8.unwrap(revenueBucket),
                block.timestamp,
                borrower
            )
        );

        creditScores[borrower] = CreditScore({
            riskBand: band,
            maxLoanSize: maxLoanSize,
            interestRateBps: interestRateBps,
            ltvBps: ltvBps,
            revenueBucket: revenueBucket,
            computedAt: block.timestamp,
            proofHash: proofHash,
            exists: true
        });

        scoreSignals[borrower] = ScoreSignals({
            dscrAboveThreshold: dscrScore.gte(FHE.asEuint32(120)),
            leverageWithinPolicy: leverageScore.gte(FHE.asEuint32(40)),
            covenantCompliant: band.lte(FHE.asEuint8(4))
        });

        _allowScoreThis(borrower);
        _allowScoreAccount(borrower, address(this));
        _allowScoreAccount(borrower, borrower);
        if (loanVault != address(0)) {
            _allowScoreAccount(borrower, loanVault);
        }

        scoreId = keccak256(abi.encodePacked(borrower, block.timestamp, proofHash, block.prevrandao));
        latestScoreId[borrower] = scoreId;
        scoreBorrower[scoreId] = borrower;
        emit UnderwritingComplete(borrower, scoreId, block.timestamp);
    }

    function authorizeScoreAccess(address borrower, address account) external {
        if (msg.sender != borrower && msg.sender != owner() && msg.sender != loanVault) revert AccessNotAllowed();
        _allowScoreAccount(borrower, account);
        emit ScoreAccessGranted(borrower, account);
    }

    function getScoreHandles(address borrower)
        external
        view
        returns (
            uint256 riskBand,
            uint256 maxLoanSize,
            uint256 interestRateBps,
            uint256 ltvBps,
            uint256 revenueBucket,
            uint256 dscrAboveThreshold,
            uint256 leverageWithinPolicy,
            uint256 covenantCompliant,
            uint256 computedAt,
            bytes32 scoreId,
            bytes32 proofHash,
            bool exists
        )
    {
        CreditScore storage score = creditScores[borrower];
        ScoreSignals storage signals = scoreSignals[borrower];
        return (
            uint256(euint8.unwrap(score.riskBand)),
            uint256(euint32.unwrap(score.maxLoanSize)),
            uint256(euint32.unwrap(score.interestRateBps)),
            uint256(euint32.unwrap(score.ltvBps)),
            uint256(euint8.unwrap(score.revenueBucket)),
            uint256(ebool.unwrap(signals.dscrAboveThreshold)),
            uint256(ebool.unwrap(signals.leverageWithinPolicy)),
            uint256(ebool.unwrap(signals.covenantCompliant)),
            score.computedAt,
            latestScoreId[borrower],
            score.proofHash,
            score.exists
        );
    }

    function getScoreMetadata(address borrower)
        external
        view
        returns (uint256 computedAt, bytes32 scoreId, bytes32 proofHash, bool exists)
    {
        CreditScore storage score = creditScores[borrower];
        return (score.computedAt, latestScoreId[borrower], score.proofHash, score.exists);
    }

    function verifyDecryptedTerms(address borrower, DecryptedTerms calldata terms)
        external
        view
        returns (uint256 computedAt, bytes32 scoreId, bytes32 proofHash, bool valid)
    {
        CreditScore storage score = creditScores[borrower];
        if (!score.exists) return (0, bytes32(0), bytes32(0), false);

        valid = FHE.verifyDecryptResultSafe(score.riskBand, terms.riskBand, terms.riskBandSignature)
            && FHE.verifyDecryptResultSafe(score.maxLoanSize, terms.maxLoanSize, terms.maxLoanSizeSignature)
            && FHE.verifyDecryptResultSafe(score.interestRateBps, terms.interestRateBps, terms.interestRateSignature)
            && FHE.verifyDecryptResultSafe(score.ltvBps, terms.ltvBps, terms.ltvSignature);

        return (score.computedAt, latestScoreId[borrower], score.proofHash, valid);
    }

    function isScoreFresh(address borrower) public returns (bool) {
        CreditScore storage score = creditScores[borrower];
        if (!score.exists) return false;
        bool fresh = (block.timestamp - score.computedAt) <= SCORE_MAX_AGE;
        if (!fresh) {
            emit ScoreExpired(borrower);
        }
        return fresh;
    }

    function _allowScoreThis(address borrower) internal {
        CreditScore storage score = creditScores[borrower];
        ScoreSignals storage signals = scoreSignals[borrower];
        if (!score.exists) revert ScoreNotFound();

        FHE.allowThis(score.riskBand);
        FHE.allowThis(score.maxLoanSize);
        FHE.allowThis(score.interestRateBps);
        FHE.allowThis(score.ltvBps);
        FHE.allowThis(score.revenueBucket);
        FHE.allowThis(signals.dscrAboveThreshold);
        FHE.allowThis(signals.leverageWithinPolicy);
        FHE.allowThis(signals.covenantCompliant);
    }

    function _allowScoreAccount(address borrower, address account) internal {
        CreditScore storage score = creditScores[borrower];
        ScoreSignals storage signals = scoreSignals[borrower];
        if (!score.exists) revert ScoreNotFound();

        FHE.allow(score.riskBand, account);
        FHE.allow(score.maxLoanSize, account);
        FHE.allow(score.interestRateBps, account);
        FHE.allow(score.ltvBps, account);
        FHE.allow(score.revenueBucket, account);
        FHE.allow(signals.dscrAboveThreshold, account);
        FHE.allow(signals.leverageWithinPolicy, account);
        FHE.allow(signals.covenantCompliant, account);
    }

    function _computeDSCR(euint32 revenue, euint32 debt) internal returns (euint32) {
        euint32 safeDebt = FHE.select(debt.eq(FHE.asEuint32(0)), FHE.asEuint32(1), debt);
        euint32 dscr = revenue.mul(FHE.asEuint32(100)).div(safeDebt);
        return FHE.min(dscr, FHE.asEuint32(200));
    }

    function _computeRunway(euint32 cash, euint32 burn) internal returns (euint32) {
        euint32 safeBurn = FHE.select(burn.eq(FHE.asEuint32(0)), FHE.asEuint32(1), burn);
        euint32 months = cash.div(safeBurn);
        euint32 cappedMonths = FHE.min(months, FHE.asEuint32(36));
        return cappedMonths.mul(FHE.asEuint32(100)).div(FHE.asEuint32(36));
    }

    function _computeLeverageRatio(euint32 debt, euint32 revenue) internal returns (euint32) {
        euint32 safeRevenue = FHE.select(revenue.eq(FHE.asEuint32(0)), FHE.asEuint32(1), revenue);
        euint32 leverage = debt.mul(FHE.asEuint32(100)).div(safeRevenue);
        euint32 leverageCapped = FHE.min(leverage, FHE.asEuint32(100));
        return FHE.asEuint32(100).sub(leverageCapped);
    }

    function _computeReceivablesScore(euint32 receivables, euint32 revenue) internal returns (euint32) {
        euint32 quarterlyRevenue = revenue.div(FHE.asEuint32(4));
        euint32 safeQuarterlyRevenue = FHE.select(
            quarterlyRevenue.eq(FHE.asEuint32(0)),
            FHE.asEuint32(1),
            quarterlyRevenue
        );
        euint32 ratio = receivables.mul(FHE.asEuint32(100)).div(safeQuarterlyRevenue);
        return FHE.min(ratio, FHE.asEuint32(100));
    }

    function _aggregateScore(
        euint32 dscrScore,
        euint32 runwayScore,
        euint32 leverageScore,
        euint32 receivablesScore
    ) internal returns (euint32 totalScore) {
        euint32 weighted = dscrScore
            .mul(FHE.asEuint32(DSCR_WEIGHT))
            .add(runwayScore.mul(FHE.asEuint32(RUNWAY_WEIGHT)))
            .add(leverageScore.mul(FHE.asEuint32(LEVERAGE_WEIGHT)))
            .add(receivablesScore.mul(FHE.asEuint32(RECEIVABLES_WEIGHT)));

        return weighted.div(FHE.asEuint32(100));
    }

    function _mapToBand(euint32 score) internal returns (euint8 band) {
        band = FHE.asEuint8(6);
        band = FHE.select(score.gte(FHE.asEuint32(BAND_B_THRESHOLD)), FHE.asEuint8(5), band);
        band = FHE.select(score.gte(FHE.asEuint32(BAND_BB_THRESHOLD)), FHE.asEuint8(4), band);
        band = FHE.select(score.gte(FHE.asEuint32(BAND_BBB_THRESHOLD)), FHE.asEuint8(3), band);
        band = FHE.select(score.gte(FHE.asEuint32(BAND_A_THRESHOLD)), FHE.asEuint8(2), band);
        band = FHE.select(score.gte(FHE.asEuint32(BAND_AA_THRESHOLD)), FHE.asEuint8(1), band);
    }

    function _computeLoanTerms(euint32 adjustedScore, euint32 revenue)
        internal
        returns (euint32 maxLoanSize, euint32 interestRateBps, euint32 ltvBps)
    {
        euint32 loanPct = FHE.min(adjustedScore, FHE.asEuint32(40));
        euint32 rateDiscount = FHE.min(adjustedScore.mul(FHE.asEuint32(12)), FHE.asEuint32(1200));
        euint32 ltv = FHE.min(adjustedScore.mul(FHE.asEuint32(50)).add(FHE.asEuint32(3000)), FHE.asEuint32(7500));

        maxLoanSize = revenue.mul(loanPct).div(FHE.asEuint32(100));
        interestRateBps = FHE.asEuint32(1800).sub(rateDiscount);
        ltvBps = ltv;
    }

    function _bucketRevenue(euint32 annualRevenue) internal returns (euint8 bucketIndex) {
        bucketIndex = FHE.asEuint8(1);
        bucketIndex = FHE.select(annualRevenue.gte(FHE.asEuint32(1_000_000)), FHE.asEuint8(2), bucketIndex);
        bucketIndex = FHE.select(annualRevenue.gte(FHE.asEuint32(5_000_000)), FHE.asEuint8(3), bucketIndex);
        bucketIndex = FHE.select(annualRevenue.gte(FHE.asEuint32(20_000_000)), FHE.asEuint8(4), bucketIndex);
    }
}
