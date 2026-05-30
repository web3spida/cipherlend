import { Router } from "express";
import { getReineiraConfigStatus, getReineiraSdk } from "../lib/reineira";

const router = Router();

router.get("/status", async (_req, res) => {
  try {
    const status = getReineiraConfigStatus();
    let coordinator = null;
    if (status.enabled && status.coordinatorConfigured && status.missing.length === 0) {
      const sdk = getReineiraSdk();
      coordinator = await sdk.bridge.checkHealth().catch((error: unknown) => ({
        reachable: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    }

    return res.json({
      ...status,
      coordinator,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to check Reineira status",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get("/balances/:address", async (req, res) => {
  try {
    const sdk = getReineiraSdk();
    const balances = await sdk.balances(req.params.address);
    return res.json({
      address: req.params.address,
      confidentialUSDC: balances.confidentialUSDC.toString(),
      usdc: balances.usdc.toString(),
      eth: balances.eth.toString(),
      formattedUsdc: sdk.formatUsdc(balances.usdc),
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch Reineira balances",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post("/plain-escrows", async (req, res) => {
  try {
    const { amountUsdc, owner, resolver, resolverData, autoFund } = req.body as {
      amountUsdc?: string;
      owner?: string;
      resolver?: string;
      resolverData?: string;
      autoFund?: boolean;
    };

    if (!amountUsdc || !owner) {
      return res.status(400).json({ error: "amountUsdc and owner are required" });
    }

    const sdk = getReineiraSdk();
    const escrow = await sdk.escrowPlain.create({
      amount: sdk.usdc(amountUsdc),
      owner,
      resolver,
      resolverData,
    });

    let funding = null;
    if (autoFund) {
      funding = await escrow.fund(sdk.usdc(amountUsdc), { autoApprove: true });
    }

    return res.json({
      escrowId: escrow.id.toString(),
      createTx: escrow.createTx
        ? {
            hash: escrow.createTx.hash,
            blockNumber: escrow.createTx.blockNumber,
            gasUsed: escrow.createTx.gasUsed.toString(),
          }
        : null,
      funding: funding
        ? {
            hash: funding.hash,
            blockNumber: funding.blockNumber,
            gasUsed: funding.gasUsed.toString(),
          }
        : null,
      nextStep: autoFund ? "Escrow created and funded." : "Call fund() when lender settlement is ready.",
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to create Reineira plain escrow",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
