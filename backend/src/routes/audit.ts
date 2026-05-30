import { Router } from "express";
import PDFDocument from "pdfkit";
import { getLoanVault, getPermitRegistry, getUnderwritingEngine } from "../lib/contracts";

const router = Router();

const buildAuditReport = async (body: {
  loanId?: string | number;
  permitId?: string;
  auditorAddress?: string;
  borrowerAddress?: string;
}) => {
  const { loanId, permitId, auditorAddress, borrowerAddress } = body;
  if ((!loanId && !borrowerAddress) || !permitId || !auditorAddress) {
    throw new Error("Provide loanId or borrowerAddress, plus permitId and auditorAddress");
  }

  const permitRegistry = getPermitRegistry();
  const permitValid = await permitRegistry.verifyPermit(permitId, auditorAddress, 1);
  if (!permitValid) {
    const error = new Error("Permit is not valid for this auditor");
    (error as Error & { status?: number }).status = 403;
    throw error;
  }

  let borrower = borrowerAddress;
  let loan = null;
  if (!borrower && loanId !== undefined) {
    const loanVault = getLoanVault();
    loan = await loanVault.getLoanDetails(Number(loanId));
    borrower = loan.borrower;
  }
  if (!borrower) {
    throw new Error("Unable to resolve borrower");
  }

  const underwriting = getUnderwritingEngine();
  const handles = await underwriting.getScoreHandles(borrower);

  return {
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
  };
};

router.post("/verify", async (req, res) => {
  try {
    const report = await buildAuditReport(req.body as {
      loanId?: string | number;
      permitId?: string;
      auditorAddress?: string;
      borrowerAddress?: string;
    });
    return res.json(report);
  } catch (error) {
    const status =
      (error as Error & { status?: number }).status ??
      (error instanceof Error && (error.message.startsWith("Provide ") || error.message.startsWith("Unable "))
        ? 400
        : 500);
    return res.status(status).json({
      error: "Failed to verify audit",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post("/report", async (req, res) => {
  try {
    const report = await buildAuditReport(req.body);
    const doc = new PDFDocument({ size: "LETTER", margin: 48 });
    const filename = `cipherlend-audit-${report.loanId ?? report.borrower}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    doc.fontSize(20).text("CipherLend Audit Report", { underline: false });
    doc.moveDown();
    doc.fontSize(10).fillColor("#444").text(`Generated: ${new Date().toISOString()}`);
    doc.text(`Borrower: ${report.borrower}`);
    doc.text(`Loan ID: ${report.loanId ?? "N/A"}`);
    doc.text(`Score computed at: ${report.computedAt ? new Date(report.computedAt * 1000).toISOString() : "N/A"}`);
    doc.moveDown();

    doc.fillColor("#000").fontSize(14).text("Verification");
    doc.fontSize(10).text(`Score exists: ${report.exists ? "yes" : "no"}`);
    doc.text(`Score ID: ${report.scoreId}`);
    doc.text(`Proof hash: ${report.proofHash}`);
    doc.moveDown();

    doc.fontSize(14).text("Ciphertext Handles");
    for (const [name, value] of Object.entries(report.handles)) {
      doc.fontSize(9).text(`${name}: ${value}`);
    }
    doc.moveDown();

    doc.fontSize(14).text("Privacy Statement");
    doc
      .fontSize(10)
      .text(
        "This report does not disclose raw borrower financial data. It records ciphertext handles and proof metadata for authorized off-chain review through CoFHE permits."
      );

    doc.end();
  } catch (error) {
    const status =
      (error as Error & { status?: number }).status ??
      (error instanceof Error && (error.message.startsWith("Provide ") || error.message.startsWith("Unable "))
        ? 400
        : 500);
    return res.status(status).json({
      error: "Failed to generate audit report",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
