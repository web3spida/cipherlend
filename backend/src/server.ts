import express from "express";
import dotenv from "dotenv";
import profileRoutes from "./routes/profile";
import underwritingRoutes from "./routes/underwriting";
import loansRoutes from "./routes/loans";
import auditRoutes from "./routes/audit";
import permitsRoutes from "./routes/permits";
import decryptRoutes from "./routes/decrypt";

dotenv.config();

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

app.use("/api/v1/profile", profileRoutes);
app.use("/api/v1/underwriting", underwritingRoutes);
app.use("/api/v1/loans", loansRoutes);
app.use("/api/v1/audit", auditRoutes);
app.use("/api/v1/permits", permitsRoutes);
app.use("/api/v1/decrypt", decryptRoutes);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: err.message });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`CipherLend backend listening on ${port}`);
});
