import { Router } from "express";
import { getLoanVault, getReadOnlyLoanVault } from "../lib/contracts";

const router = Router();

router.get("/available", async (req, res) => {
  try {
    const { band, minAmount, maxAmount } = req.query;
    const loanVault = getReadOnlyLoanVault();
    const pendingLoans = await loanVault.getPendingLoans();

    const filtered = pendingLoans.filter((loan: any) => {
      if (band !== undefined && Number(loan.riskBand) !== Number(band)) return false;
      if (minAmount !== undefined && BigInt(loan.principal) < BigInt(String(minAmount))) return false;
      if (maxAmount !== undefined && BigInt(loan.principal) > BigInt(String(maxAmount))) return false;
      return true;
    });

    return res.json(
      filtered.map((loan: any) => ({
        loanId: Number(loan.loanId),
        borrower: loan.borrower,
        amount: loan.principal.toString(),
        rateBps: loan.interestRateBps.toString(),
        ltvBps: loan.ltvBps.toString(),
        riskBand: Number(loan.riskBand),
        termMonths: Number(loan.termMonths),
      }))
    );
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch available loans",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post("/fund", async (req, res) => {
  try {
    const { loanId } = req.body as { loanId?: number };
    if (loanId === undefined) {
      return res.status(400).json({ error: "loanId is required" });
    }

    const loanVault = getLoanVault();
    const details = await loanVault.loans(loanId);
    const tx = await loanVault.fundLoan(loanId, { value: details.principal });
    const receipt = await tx.wait();

    return res.json({
      txHash: receipt.hash,
      loanId: Number(loanId),
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fund loan",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post("/request", async (req, res) => {
  try {
    const { requestedAmount, termMonths, terms } = req.body as {
      requestedAmount?: string;
      termMonths?: number;
      terms?: {
        riskBand: number;
        maxLoanSize: number;
        interestRateBps: number;
        ltvBps: number;
        riskBandSignature: string;
        maxLoanSizeSignature: string;
        interestRateSignature: string;
        ltvSignature: string;
      };
    };

    if (!requestedAmount || !termMonths || !terms) {
      return res.status(400).json({ error: "requestedAmount, termMonths and terms are required" });
    }

    const loanVault = getLoanVault();
    const tx = await loanVault.requestLoan(BigInt(requestedAmount), Number(termMonths), terms);
    const receipt = await tx.wait();

    return res.json({
      txHash: receipt.hash,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to request loan",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get("/portfolio/:address", async (req, res) => {
  try {
    return res.json({
      address: req.params.address,
      loans: [],
      note: "LoanVault exposes pending loans on-chain. Portfolio indexing should be backed by events or a subgraph before production.",
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch portfolio",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post("/payment", async (req, res) => {
  try {
    const { loanId, amount } = req.body as { loanId?: number; amount?: string };
    if (loanId === undefined || amount === undefined) {
      return res.status(400).json({ error: "loanId and amount are required" });
    }
    const loanVault = getLoanVault();
    const tx = await loanVault.makePayment(loanId, { value: BigInt(amount) });
    const receipt = await tx.wait();
    const details = await loanVault.loans(loanId);

    return res.json({
      txHash: receipt.hash,
      remainingBalance: details.remainingBalance.toString(),
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to make payment",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
