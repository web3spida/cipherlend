import { Router } from "express";
import { FheTypes } from "@cofhe/sdk";
import type { Permit } from "@cofhe/sdk/permits";
import {
  buildPublishDecryptResultArgs,
  decryptForTxWithPermit,
  decryptForTxWithoutPermit,
  decryptForView,
} from "../lib/fhenix";

const router = Router();

type ViewDecryptBody = {
  ctHash?: string;
  type?: string | number;
  permit?: string | Permit;
};

type TxDecryptBody = {
  ctHash?: string;
  permit?: string | Permit;
  withoutPermit?: boolean;
};

const typeAliasMap: Record<string, FheTypes> = {
  bool: FheTypes.Bool,
  uint8: FheTypes.Uint8,
  uint16: FheTypes.Uint16,
  uint32: FheTypes.Uint32,
  uint64: FheTypes.Uint64,
  uint128: FheTypes.Uint128,
  address: FheTypes.Uint160,
  uint160: FheTypes.Uint160,
};

const jsonSafe = (value: unknown): unknown => {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, jsonSafe(v)]));
  }
  return value;
};

const resolveFheType = (input: string | number | undefined): FheTypes | null => {
  if (input === undefined || input === null) return null;
  if (typeof input === "number") {
    return Number.isInteger(input) ? (input as FheTypes) : null;
  }
  const normalized = input.trim().toLowerCase();
  if (normalized in typeAliasMap) {
    return typeAliasMap[normalized];
  }
  if (/^\d+$/.test(normalized)) {
    return Number(normalized) as FheTypes;
  }
  return null;
};

router.post("/view", async (req, res) => {
  try {
    const { ctHash, type, permit } = req.body as ViewDecryptBody;
    if (!ctHash) {
      return res.status(400).json({ error: "ctHash is required" });
    }

    const resolvedType = resolveFheType(type);
    if (resolvedType === null) {
      return res.status(400).json({
        error: "Invalid or missing type. Use one of: bool, uint8, uint16, uint32, uint64, uint128, address, or a numeric FheTypes value.",
      });
    }

    const decryptedValue = await decryptForView(ctHash, resolvedType, permit);
    return res.json({
      ctHash,
      type: resolvedType,
      decryptedValue: jsonSafe(decryptedValue),
      mode: "decryptForView",
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to decrypt for view",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post("/tx", async (req, res) => {
  try {
    const { ctHash, permit, withoutPermit } = req.body as TxDecryptBody;
    if (!ctHash) {
      return res.status(400).json({ error: "ctHash is required" });
    }
    if (withoutPermit && permit) {
      return res.status(400).json({ error: "Use either permit or withoutPermit=true, not both" });
    }

    const result = withoutPermit
      ? await decryptForTxWithoutPermit(ctHash)
      : await decryptForTxWithPermit(ctHash, permit);
    const publishArgs = buildPublishDecryptResultArgs(result);

    return res.json({
      mode: "decryptForTx",
      usedPermit: !withoutPermit,
      result: jsonSafe(result),
      publishArgs: jsonSafe(publishArgs),
      nextStep: "Call FHE.publishDecryptResult(ctHash, decryptedValue, signature) on-chain.",
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to decrypt for tx",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
