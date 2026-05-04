const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api/v1';

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.details || body.error || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
};

export type LoanOpportunity = {
  loanId: number;
  borrower: string;
  amount: string;
  rateBps: string;
  ltvBps: string;
  riskBand: number;
  termMonths: number;
};

export const api = {
  runUnderwriting: (borrowerAddress: string) =>
    request<{ txHash: string; scoreId: string; proofHash: string; computedAt: number; exists: boolean }>(
      '/underwriting/run',
      {
        method: 'POST',
        body: JSON.stringify({ borrowerAddress }),
      }
    ),
  getAvailableLoans: () => request<LoanOpportunity[]>('/loans/available'),
  getPortfolio: (address: string) => request<{ loans: LoanOpportunity[]; note?: string }>(`/loans/portfolio/${address}`),
  verifyAudit: (body: { loanId?: string; borrowerAddress?: string; permitId: string; auditorAddress: string }) =>
    request<{
      borrower: string;
      proofHash: string;
      computedAt: number;
      exists: boolean;
      handles: Record<string, string>;
      nextStep: string;
    }>('/audit/verify', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
