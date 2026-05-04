import { Router } from "express";
import { getUnderwritingEngine } from "../lib/contracts";

const router = Router();

type DecryptedTermsBody = {
  riskBand?: number;
  maxLoanSize?: number;
  interestRateBps?: number;
  ltvBps?: number;
  riskBandSignature?: string;
  maxLoanSizeSignature?: string;
  interestRateSignature?: string;
  ltvSignature?: string;
};

const normalizeTerms = (terms: DecryptedTermsBody) => {
  const required = [
    "riskBand",
    "maxLoanSize",
    "interestRateBps",
    "ltvBps",
    "riskBandSignature",
    "maxLoanSizeSignature",
    "interestRateSignature",
    "ltvSignature",
  ] as const;

  for (const key of required) {
    if (terms[key] === undefined) {
      throw new Error(`terms.${key} is required`);
    }
  }

  return {
    riskBand: Number(terms.riskBand),
    maxLoanSize: Number(terms.maxLoanSize),
    interestRateBps: Number(terms.interestRateBps),
    ltvBps: Number(terms.ltvBps),
    riskBandSignature: String(terms.riskBandSignature),
    maxLoanSizeSignature: String(terms.maxLoanSizeSignature),
    interestRateSignature: String(terms.interestRateSignature),
    ltvSignature: String(terms.ltvSignature),
  };
};

router.post("/run", async (req, res) => {
  try {
    const { borrowerAddress } = req.body as { borrowerAddress?: string };
    if (!borrowerAddress) {
      return res.status(400).json({ error: "borrowerAddress is required" });
    }
    const underwriting = getUnderwritingEngine();
    const tx = await underwriting.runUnderwriting(borrowerAddress);
    const receipt = await tx.wait();
    const metadata = await underwriting.getScoreMetadata(borrowerAddress);

    return res.json({
      scoreId: metadata[1],
      proofHash: metadata[2],
      txHash: receipt.hash,
      computedAt: Number(metadata[0]),
      exists: Boolean(metadata[3]),
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to run underwriting",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get("/handles/:address", async (req, res) => {
  try {
    const underwriting = getUnderwritingEngine();
    const handles = await underwriting.getScoreHandles(req.params.address);

    return res.json({
      riskBand: handles[0].toString(),
      maxLoanSize: handles[1].toString(),
      interestRateBps: handles[2].toString(),
      ltvBps: handles[3].toString(),
      revenueBucket: handles[4].toString(),
      dscrAboveThreshold: handles[5].toString(),
      leverageWithinPolicy: handles[6].toString(),
      covenantCompliant: handles[7].toString(),
      computedAt: Number(handles[8]),
      scoreId: handles[9],
      proofHash: handles[10],
      exists: Boolean(handles[11]),
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch score handles",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post("/verify-terms/:address", async (req, res) => {
  try {
    const underwriting = getUnderwritingEngine();
    const terms = normalizeTerms(req.body.terms ?? req.body);
    const result = await underwriting.verifyDecryptedTerms(req.params.address, terms);

    return res.json({
      computedAt: Number(result[0]),
      scoreId: result[1],
      proofHash: result[2],
      valid: Boolean(result[3]),
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to verify underwriting terms",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
