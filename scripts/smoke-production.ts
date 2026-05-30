const apiBase = process.env.SMOKE_API_BASE_URL ?? process.env.VITE_API_BASE_URL;
const webBase = process.env.SMOKE_WEB_BASE_URL;

if (!apiBase) {
  console.error("Set SMOKE_API_BASE_URL or VITE_API_BASE_URL.");
  process.exit(1);
}

const check = async (label: string, url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${label} failed with ${response.status}`);
  }
  return response;
};

try {
  const rootApi = apiBase.replace(/\/api\/v1\/?$/, "");
  await check("API health", `${rootApi}/health`);
  await check("API readiness", `${rootApi}/ready`);
  await check("Loan marketplace", `${apiBase.replace(/\/$/, "")}/loans/available`);
  if (webBase) {
    await check("Web root", webBase);
  }
  console.log("Production smoke checks passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
