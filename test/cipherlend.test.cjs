const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { Encryptable } = require("@cofhe/sdk");

const DEFAULT_PROFILE = {
  revenue: 2_500_000n,
  debt: 300_000n,
  burnRate: 90_000n,
  receivables: 400_000n,
  cash: 1_000_000n,
  businessAge: 28n,
  sector: 1,
};

async function encryptProfile(signer, overrides = {}) {
  const data = { ...DEFAULT_PROFILE, ...overrides };
  const client = await hre.cofhe.createClientWithBatteries(signer);
  const [revenue, debt, burnRate, receivables, cash, businessAge] = await client
    .encryptInputs([
      Encryptable.uint32(BigInt(data.revenue)),
      Encryptable.uint32(BigInt(data.debt)),
      Encryptable.uint32(BigInt(data.burnRate)),
      Encryptable.uint32(BigInt(data.receivables)),
      Encryptable.uint32(BigInt(data.cash)),
      Encryptable.uint32(BigInt(data.businessAge)),
    ])
    .execute();

  return {
    revenue,
    debt,
    burnRate,
    receivables,
    cash,
    businessAge,
    sector: data.sector,
  };
}

async function submitProfile(fixture, overrides = {}) {
  const data = await encryptProfile(fixture.borrower, overrides);
  await fixture.registry
    .connect(fixture.borrower)
    .submitProfile(data.revenue, data.debt, data.burnRate, data.receivables, data.cash, data.businessAge, data.sector);
  await fixture.registry.connect(fixture.borrower).authorizeProfileAccess(await fixture.underwriting.getAddress());
}

async function seedBorrowerAndScore(fixture, overrides = {}) {
  await submitProfile(fixture, overrides);
  await fixture.underwriting.runUnderwriting(fixture.borrower.address);
}

async function decryptTerms(fixture, borrowerSigner) {
  const client = await hre.cofhe.createClientWithBatteries(borrowerSigner);
  const handles = await fixture.underwriting.getScoreHandles(borrowerSigner.address);
  const latestBlock = await ethers.provider.getBlock("latest");
  const permit = await client.permits.createSelf({
    issuer: borrowerSigner.address,
    name: `CipherLend test permit ${latestBlock.timestamp}`,
    expiration: Number(latestBlock.timestamp) + 30 * 24 * 60 * 60,
  });
  const [riskBand, maxLoanSize, interestRateBps, ltvBps] = await Promise.all([
    client.decryptForTx(handles[0]).withPermit(permit).execute(),
    client.decryptForTx(handles[1]).withPermit(permit).execute(),
    client.decryptForTx(handles[2]).withPermit(permit).execute(),
    client.decryptForTx(handles[3]).withPermit(permit).execute(),
  ]);

  return {
    riskBand: Number(riskBand.decryptedValue),
    maxLoanSize: Number(maxLoanSize.decryptedValue),
    interestRateBps: Number(interestRateBps.decryptedValue),
    ltvBps: Number(ltvBps.decryptedValue),
    riskBandSignature: riskBand.signature,
    maxLoanSizeSignature: maxLoanSize.signature,
    interestRateSignature: interestRateBps.signature,
    ltvSignature: ltvBps.signature,
  };
}

describe("CipherLend CoFHE alignment", function () {
  this.timeout(300000);

  async function deployFixture() {
    const [deployer, borrower, lender, auditor] = await ethers.getSigners();
    const BorrowerRegistry = await ethers.getContractFactory("BorrowerRegistry");
    const registry = await BorrowerRegistry.deploy();
    await registry.waitForDeployment();

    const UnderwritingEngine = await ethers.getContractFactory("UnderwritingEngine");
    const underwriting = await UnderwritingEngine.deploy(await registry.getAddress());
    await underwriting.waitForDeployment();

    const LoanVault = await ethers.getContractFactory("LoanVault");
    const vault = await LoanVault.deploy(await underwriting.getAddress());
    await vault.waitForDeployment();

    const PermitRegistry = await ethers.getContractFactory("PermitRegistry");
    const permitRegistry = await PermitRegistry.deploy();
    await permitRegistry.waitForDeployment();

    await registry.setUnderwritingEngine(await underwriting.getAddress());
    await underwriting.setLoanVault(await vault.getAddress());

    return { deployer, borrower, lender, auditor, registry, underwriting, vault, permitRegistry };
  }

  describe("BorrowerRegistry", function () {
    it("submits SDK-encrypted profile inputs", async function () {
      const f = await deployFixture();
      const data = await encryptProfile(f.borrower, { revenue: 2_000_000n, sector: 3 });

      await expect(
        f.registry
          .connect(f.borrower)
          .submitProfile(data.revenue, data.debt, data.burnRate, data.receivables, data.cash, data.businessAge, data.sector)
      ).to.emit(f.registry, "ProfileSubmitted");

      const metadata = await f.registry.getProfileMetadata(f.borrower.address);
      expect(Number(metadata[0])).to.equal(3);
      expect(Number(metadata[2])).to.equal(1);
      expect(metadata[3]).to.equal(true);
    });

    it("does not expose encrypted profiles to non-engine callers", async function () {
      const f = await deployFixture();
      await submitProfile(f);
      await expect(f.registry.getEncryptedProfile(f.borrower.address)).to.be.revertedWithCustomError(
        f.registry,
        "OnlyUnderwritingEngine"
      );
    });

    it("updates profile and keeps handle metadata available", async function () {
      const f = await deployFixture();
      await submitProfile(f);
      const updated = await encryptProfile(f.borrower, { revenue: 2_700_000n, businessAge: 29n });

      await expect(
        f.registry
          .connect(f.borrower)
          .updateProfile(
            updated.revenue,
            updated.debt,
            updated.burnRate,
            updated.receivables,
            updated.cash,
            updated.businessAge,
            updated.sector
          )
      ).to.emit(f.registry, "ProfileUpdated");

      const metadata = await f.registry.getProfileMetadata(f.borrower.address);
      const handles = await f.registry.getProfileHandles(f.borrower.address);
      expect(Number(metadata[2])).to.equal(2);
      expect(handles[0]).to.not.equal(0n);
    });
  });

  describe("UnderwritingEngine", function () {
    it("runs underwriting and stores encrypted score handles", async function () {
      const f = await deployFixture();
      await seedBorrowerAndScore(f);
      const handles = await f.underwriting.getScoreHandles(f.borrower.address);

      expect(handles[0]).to.not.equal(0n);
      expect(handles[8]).to.be.greaterThan(0n);
      expect(handles[11]).to.equal(true);
    });

    it("verifies SDK decryptForTx proofs for loan terms", async function () {
      const f = await deployFixture();
      await seedBorrowerAndScore(f);
      const terms = await decryptTerms(f, f.borrower);
      const verified = await f.underwriting.verifyDecryptedTerms(f.borrower.address, terms);

      expect(verified[3]).to.equal(true);
      expect(terms.riskBand).to.be.within(1, 6);
      expect(terms.maxLoanSize).to.be.greaterThan(0);
    });

    it("rejects stale profiles", async function () {
      const f = await deployFixture();
      await submitProfile(f);
      await time.increase(181 * 24 * 60 * 60);
      await expect(f.underwriting.runUnderwriting(f.borrower.address)).to.be.revertedWith("PROFILE_TOO_OLD");
    });
  });

  describe("LoanVault", function () {
    it("creates loan request from verified decrypted term proofs", async function () {
      const f = await deployFixture();
      await seedBorrowerAndScore(f);
      const terms = await decryptTerms(f, f.borrower);

      await expect(f.vault.connect(f.borrower).requestLoan(100_000, 12, terms)).to.emit(f.vault, "LoanRequested");
    });

    it("rejects invalid decrypt proof material", async function () {
      const f = await deployFixture();
      await seedBorrowerAndScore(f);
      const terms = await decryptTerms(f, f.borrower);
      terms.riskBandSignature = "0x";

      await expect(f.vault.connect(f.borrower).requestLoan(100_000, 12, terms)).to.be.revertedWith(
        "INVALID_SCORE_PROOF"
      );
    });

    it("funds loans, accepts repayment, and marks overdue", async function () {
      const f = await deployFixture();
      await seedBorrowerAndScore(f);
      const terms = await decryptTerms(f, f.borrower);
      await f.vault.connect(f.borrower).requestLoan(100_000, 12, terms);

      await expect(f.vault.connect(f.lender).fundLoan(1, { value: 100_000 })).to.emit(f.vault, "LoanFunded");
      await f.vault.connect(f.borrower).makePayment(1, { value: 30_000 });
      let loan = await f.vault.loans(1);
      expect(loan.remainingBalance).to.equal(70_000);

      await time.increase(31 * 24 * 60 * 60);
      await expect(f.vault.markOverdue(1)).to.emit(f.vault, "LoanOverdue");
      loan = await f.vault.loans(1);
      expect(loan.status).to.equal(2);
    });

    it("detects covenant breach after refreshed underwriting and verified proofs", async function () {
      const f = await deployFixture();
      await seedBorrowerAndScore(f, { revenue: 3_000_000n, debt: 200_000n, cash: 1_500_000n });
      let terms = await decryptTerms(f, f.borrower);
      await f.vault.connect(f.borrower).requestLoan(120_000, 12, terms);
      await f.vault.connect(f.lender).fundLoan(1, { value: 120_000 });

      const bad = await encryptProfile(f.borrower, {
        revenue: 150_000n,
        debt: 2_000_000n,
        burnRate: 400_000n,
        receivables: 10_000n,
        cash: 20_000n,
        businessAge: 35n,
      });
      await f.registry
        .connect(f.borrower)
        .updateProfile(bad.revenue, bad.debt, bad.burnRate, bad.receivables, bad.cash, bad.businessAge, bad.sector);

      await f.vault.refreshCovenants(1);
      terms = await decryptTerms(f, f.borrower);
      await expect(f.vault.checkCovenants(1, terms)).to.emit(f.vault, "CovenantBreach");
    });
  });

  describe("PermitRegistry", function () {
    it("grants, expires, and revokes business-level permits", async function () {
      const f = await deployFixture();
      const tx = await f.permitRegistry.connect(f.borrower).grantPermit(f.lender.address, 1, 5);
      const receipt = await tx.wait();
      const permitId = receipt.logs[0].topics[1];

      expect(await f.permitRegistry.verifyPermit(permitId, f.lender.address, 1)).to.equal(true);
      await time.increase(6);
      expect(await f.permitRegistry.verifyPermit(permitId, f.lender.address, 1)).to.equal(false);

      const tx2 = await f.permitRegistry.connect(f.borrower).grantPermit(f.lender.address, 2, 3600);
      const receipt2 = await tx2.wait();
      const permitId2 = receipt2.logs[0].topics[1];
      await f.permitRegistry.connect(f.borrower).revokePermit(permitId2);
      expect(await f.permitRegistry.verifyPermit(permitId2, f.lender.address, 2)).to.equal(false);
    });
  });
});
