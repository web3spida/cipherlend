// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {FHE, InEuint32, euint32} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

contract BorrowerRegistry is Ownable {
    struct BorrowerProfile {
        euint32 annualRevenue;
        euint32 totalDebt;
        euint32 monthlyBurnRate;
        euint32 accountsReceivable;
        euint32 cashOnHand;
        euint32 businessAgeMonths;
        uint8 industrySector;
        address borrower;
        uint256 submittedAt;
        uint256 version;
    }

    mapping(address => BorrowerProfile) private profiles;
    mapping(address => uint256) public profileTimestamp;
    mapping(address => bool) public hasProfile;

    address public underwritingEngine;

    event ProfileSubmitted(address indexed borrower, uint256 version);
    event ProfileUpdated(address indexed borrower, uint256 version);
    event UnderwritingEngineSet(address indexed underwritingEngine);
    event ProfileAccessGranted(address indexed borrower, address indexed account);

    error OnlyUnderwritingEngine();
    error ProfileNotFound();

    constructor() Ownable(msg.sender) {}

    function setUnderwritingEngine(address underwritingEngineAddress) external onlyOwner {
        underwritingEngine = underwritingEngineAddress;
        emit UnderwritingEngineSet(underwritingEngineAddress);
    }

    function submitProfile(
        InEuint32 memory revenue,
        InEuint32 memory debt,
        InEuint32 memory burnRate,
        InEuint32 memory receivables,
        InEuint32 memory cash,
        InEuint32 memory businessAge,
        uint8 sector
    ) external {
        require(!hasProfile[msg.sender], "PROFILE_EXISTS");
        _upsertProfile(msg.sender, revenue, debt, burnRate, receivables, cash, businessAge, sector, 1);
        emit ProfileSubmitted(msg.sender, 1);
    }

    function updateProfile(
        InEuint32 memory revenue,
        InEuint32 memory debt,
        InEuint32 memory burnRate,
        InEuint32 memory receivables,
        InEuint32 memory cash,
        InEuint32 memory businessAge,
        uint8 sector
    ) external {
        require(hasProfile[msg.sender], "PROFILE_NOT_FOUND");
        uint256 nextVersion = profiles[msg.sender].version + 1;
        _upsertProfile(msg.sender, revenue, debt, burnRate, receivables, cash, businessAge, sector, nextVersion);
        emit ProfileUpdated(msg.sender, nextVersion);
    }

    function authorizeProfileAccess(address account) external {
        if (!hasProfile[msg.sender]) revert ProfileNotFound();
        _allowProfile(profiles[msg.sender], account);
        emit ProfileAccessGranted(msg.sender, account);
    }

    function getProfileMetadata(address borrower)
        external
        view
        returns (uint8 sector, uint256 submittedAt, uint256 version, bool exists)
    {
        BorrowerProfile storage profile = profiles[borrower];
        return (profile.industrySector, profile.submittedAt, profile.version, hasProfile[borrower]);
    }

    function getEncryptedProfile(address borrower) external returns (BorrowerProfile memory profile, bool exists) {
        if (msg.sender != underwritingEngine) revert OnlyUnderwritingEngine();
        BorrowerProfile storage storedProfile = profiles[borrower];
        profile = storedProfile;
        exists = hasProfile[borrower];
        if (exists) {
            _allowProfileTransient(storedProfile, msg.sender);
        }
    }

    function getProfileHandles(address borrower)
        external
        view
        returns (
            uint256 annualRevenue,
            uint256 totalDebt,
            uint256 monthlyBurnRate,
            uint256 accountsReceivable,
            uint256 cashOnHand,
            uint256 businessAgeMonths,
            bool exists
        )
    {
        BorrowerProfile storage profile = profiles[borrower];
        return (
            uint256(euint32.unwrap(profile.annualRevenue)),
            uint256(euint32.unwrap(profile.totalDebt)),
            uint256(euint32.unwrap(profile.monthlyBurnRate)),
            uint256(euint32.unwrap(profile.accountsReceivable)),
            uint256(euint32.unwrap(profile.cashOnHand)),
            uint256(euint32.unwrap(profile.businessAgeMonths)),
            hasProfile[borrower]
        );
    }

    function _upsertProfile(
        address borrower,
        InEuint32 memory revenue,
        InEuint32 memory debt,
        InEuint32 memory burnRate,
        InEuint32 memory receivables,
        InEuint32 memory cash,
        InEuint32 memory businessAge,
        uint8 sector,
        uint256 version
    ) internal {
        profiles[borrower] = BorrowerProfile({
            annualRevenue: FHE.asEuint32(revenue),
            totalDebt: FHE.asEuint32(debt),
            monthlyBurnRate: FHE.asEuint32(burnRate),
            accountsReceivable: FHE.asEuint32(receivables),
            cashOnHand: FHE.asEuint32(cash),
            businessAgeMonths: FHE.asEuint32(businessAge),
            industrySector: sector,
            borrower: borrower,
            submittedAt: block.timestamp,
            version: version
        });
        profileTimestamp[borrower] = block.timestamp;
        hasProfile[borrower] = true;

        _allowProfile(profiles[borrower], address(this));
        _allowProfile(profiles[borrower], borrower);
        if (underwritingEngine != address(0)) {
            _allowProfile(profiles[borrower], underwritingEngine);
        }
    }

    function _allowProfile(BorrowerProfile storage profile, address account) internal {
        FHE.allowThis(profile.annualRevenue);
        FHE.allowThis(profile.totalDebt);
        FHE.allowThis(profile.monthlyBurnRate);
        FHE.allowThis(profile.accountsReceivable);
        FHE.allowThis(profile.cashOnHand);
        FHE.allowThis(profile.businessAgeMonths);

        FHE.allow(profile.annualRevenue, account);
        FHE.allow(profile.totalDebt, account);
        FHE.allow(profile.monthlyBurnRate, account);
        FHE.allow(profile.accountsReceivable, account);
        FHE.allow(profile.cashOnHand, account);
        FHE.allow(profile.businessAgeMonths, account);
    }

    function _allowProfileTransient(BorrowerProfile storage profile, address account) internal {
        FHE.allowTransient(profile.annualRevenue, account);
        FHE.allowTransient(profile.totalDebt, account);
        FHE.allowTransient(profile.monthlyBurnRate, account);
        FHE.allowTransient(profile.accountsReceivable, account);
        FHE.allowTransient(profile.cashOnHand, account);
        FHE.allowTransient(profile.businessAgeMonths, account);
    }
}
