import { Router } from "express";
import { getBorrowerRegistry } from "../lib/contracts";

const router = Router();

type EncryptedUint32Input = {
  ctHash: string | bigint;
  securityZone: number;
  utype: number;
  signature: string;
};

const requiredInputKeys = ["ctHash", "securityZone", "utype", "signature"] as const;

const normalizeEncryptedInput = (value: unknown, name: string): EncryptedUint32Input => {
  if (!value || typeof value !== "object") {
    throw new Error(`${name} must be a CoFHE encrypted input object`);
  }

  const record = value as Record<string, unknown>;
  for (const key of requiredInputKeys) {
    if (record[key] === undefined) {
      throw new Error(`${name}.${key} is required`);
    }
  }

  return {
    ctHash: BigInt(String(record.ctHash)),
    securityZone: Number(record.securityZone),
    utype: Number(record.utype),
    signature: String(record.signature),
  };
};

router.post("/submit", async (req, res) => {
  try {
    const { encryptedInputs, sector, borrowerAddress } = req.body;
    if (
      !encryptedInputs ||
      encryptedInputs.revenue === undefined ||
      encryptedInputs.debt === undefined ||
      encryptedInputs.burnRate === undefined ||
      encryptedInputs.receivables === undefined ||
      encryptedInputs.cash === undefined ||
      encryptedInputs.businessAge === undefined ||
      sector === undefined
    ) {
      return res.status(400).json({ error: "Missing encryptedInputs or sector" });
    }

    const registry = getBorrowerRegistry();
    const inputs = {
      revenue: normalizeEncryptedInput(encryptedInputs.revenue, "encryptedInputs.revenue"),
      debt: normalizeEncryptedInput(encryptedInputs.debt, "encryptedInputs.debt"),
      burnRate: normalizeEncryptedInput(encryptedInputs.burnRate, "encryptedInputs.burnRate"),
      receivables: normalizeEncryptedInput(encryptedInputs.receivables, "encryptedInputs.receivables"),
      cash: normalizeEncryptedInput(encryptedInputs.cash, "encryptedInputs.cash"),
      businessAge: normalizeEncryptedInput(encryptedInputs.businessAge, "encryptedInputs.businessAge"),
    };

    const tx = await registry.submitProfile(
      inputs.revenue,
      inputs.debt,
      inputs.burnRate,
      inputs.receivables,
      inputs.cash,
      inputs.businessAge,
      Number(sector)
    );
    const receipt = await tx.wait();
    const signerAddress = borrowerAddress ?? (await (registry.runner as any).getAddress());
    const metadata = await registry.getProfileMetadata(signerAddress);

    return res.json({
      txHash: receipt.hash,
      profileVersion: Number(metadata[2]),
      submittedFor: signerAddress,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to submit profile",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
