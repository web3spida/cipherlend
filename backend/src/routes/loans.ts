import { Router } from "express";
import { getLoanVault, getReadOnlyLoanVault } from "../lib/contracts";
import { getExplorerAddressUrl, getExplorerTxUrl } from "../lib/explorer";

const router = Router();

const loanStatusLabels = ["Pending", "Active", "Overdue", "Defaulted", "Repaid"] as const;

const serializeLoanDetails = (loanId: bigint | number, loan: any) => ({
  loanId: Number(loanId),
  borrower: String(loan.borrower),
  lender: String(loan.lender),
  amount: loan.principal.toString(),
  rateBps: loan.interestRateBps.toString(),
  ltvBps: loan.ltvBps.toString(),
  riskBand: Number(loan.riskBand),
  termMonths: Number(loan.termMonths),
  issuedAt: Number(loan.issuedAt),
  nextPaymentDue: Number(loan.nextPaymentDue),
  remainingBalance: loan.remainingBalance.toString(),
  status: loanStatusLabels[Number(loan.status)] ?? "Unknown",
  statusId: Number(loan.status),
  underwritingScoreId: loan.underwritingScoreId,
  explorer: {
    borrower: getExplorerAddressUrl(String(loan.borrower)),
    lender: String(loan.lender) === "0x0000000000000000000000000000000000000000" ? null : getExplorerAddressUrl(String(loan.lender)),
  },
});

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
        status: "Pending",
        underwritingScoreId: loan.underwritingScoreId,
        explorer: {
          borrower: getExplorerAddressUrl(String(loan.borrower)),
        },
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
      explorerUrl: getExplorerTxUrl(receipt.hash),
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
      explorerUrl: getExplorerTxUrl(receipt.hash),
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
    const address = req.params.address;
    const role = String(req.query.role ?? "lender").toLowerCase();
    const loanVault = getReadOnlyLoanVault();
    const ids =
      role === "borrower"
        ? await loanVault.getBorrowerLoanIds(address)
        : await loanVault.getLenderLoanIds(address);

    const loans = await Promise.all(
      ids.map(async (loanId: bigint) => {
        const loan = await loanVault.getLoanDetails(loanId);
        return serializeLoanDetails(loanId, loan);
      })
    );

    return res.json({
      address,
      role,
      loans,
      source: "LoanVault indexed loan id arrays",
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
      explorerUrl: getExplorerTxUrl(receipt.hash),
      remainingBalance: details.remainingBalance.toString(),
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to make payment",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get("/:loanId", async (req, res) => {
  try {
    const loanVault = getReadOnlyLoanVault();
    const loan = await loanVault.getLoanDetails(Number(req.params.loanId));
    if (String(loan.borrower) === "0x0000000000000000000000000000000000000000") {
      return res.status(404).json({ error: "Loan not found" });
    }
    return res.json(serializeLoanDetails(Number(req.params.loanId), loan));
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch loan",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
