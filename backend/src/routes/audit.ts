import { Router } from "express";
import { getLoanVault, getPermitRegistry, getUnderwritingEngine } from "../lib/contracts";

const router = Router();

router.post("/verify", async (req, res) => {
  try {
    const { loanId, permitId, auditorAddress, borrowerAddress } = req.body as {
      loanId?: string | number;
      permitId?: string;
      auditorAddress?: string;
      borrowerAddress?: string;
    };

    if ((!loanId && !borrowerAddress) || !permitId || !auditorAddress) {
      return res.status(400).json({
        error: "Provide loanId or borrowerAddress, plus permitId and auditorAddress",
      });
    }

    const permitRegistry = getPermitRegistry();
    const permitValid = await permitRegistry.verifyPermit(permitId, auditorAddress, 1);
    if (!permitValid) {
      return res.status(403).json({ error: "Permit is not valid for this auditor" });
    }

    let borrower = borrowerAddress;
    let loan = null;
    if (!borrower && loanId !== undefined) {
      const loanVault = getLoanVault();
      loan = await loanVault.getLoanDetails(Number(loanId));
      borrower = loan.borrower;
    }
    if (!borrower) {
      return res.status(400).json({ error: "Unable to resolve borrower" });
    }

    const underwriting = getUnderwritingEngine();
    const handles = await underwriting.getScoreHandles(borrower);

    return res.json({
      borrower,
      loanId: loanId ?? null,
      loanStatus: loan ? Number(loan.status) : null,
      handles: {
        riskBand: handles[0].toString(),
        maxLoanSize: handles[1].toString(),
        interestRateBps: handles[2].toString(),
        ltvBps: handles[3].toString(),
        revenueBucket: handles[4].toString(),
        dscrAboveThreshold: handles[5].toString(),
        leverageWithinPolicy: handles[6].toString(),
        covenantCompliant: handles[7].toString(),
      },
      computedAt: Number(handles[8]),
      scoreId: handles[9],
      proofHash: handles[10],
      exists: Boolean(handles[11]),
      nextStep: "Use a CoFHE sharing permit/decryptForView to reveal only authorized audit fields off-chain.",
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to verify audit",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
