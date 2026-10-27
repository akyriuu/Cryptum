const API_URL = '/api';

export interface Money {
  amount: string;
  currency: string;
}

export interface Wallet {
  id: string;
  playerId: string;
  balance: Money;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatedWallet {
  id: string;
  playerId: string;
  balance: Money;
  version: number;
}

export interface LedgerEntry {
  id: string;
  transactionId: string;
  direction: string;
  money: Money;
  balanceBefore: Money;
  balanceAfter: Money;
  createdAt: string;
}

export interface LedgerPage {
  entries: LedgerEntry[];
  nextCursor: string | null;
}

async function readError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();

    if (typeof body === 'object' && body !== null && 'message' in body) {
      const message = (body as { message: unknown }).message;

      if (typeof message === 'string') return message;
      if (Array.isArray(message)) return message.join(', ');
    }
  } catch {
    // Usa a mensagem padrão se a resposta não contiver JSON.
  }

  return `Erro na API (${response.status})`;
}

export async function getWallet(walletId: string): Promise<Wallet> {
  const response = await fetch(
    `${API_URL}/wallets/${encodeURIComponent(walletId)}`,
  );

  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<Wallet>;
}

export async function createWallet(input: {
  playerId: string;
  initialBalance: Money;
}): Promise<CreatedWallet> {
  const response = await fetch(`${API_URL}/wallets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<CreatedWallet>;
}

export async function getWalletLedger(
  walletId: string,
  cursor?: string,
): Promise<LedgerPage> {
  const params = new URLSearchParams({ limit: '20' });
  if (cursor) params.set('cursor', cursor);

  const response = await fetch(
    `${API_URL}/wallets/${encodeURIComponent(walletId)}/ledger?${params}`,
  );

  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<LedgerPage>;
}

export async function reconcileWallet(walletId: string): Promise<{
  walletId: string;
  storedBalance: Money;
  calculatedBalance: Money;
  difference: Money;
  consistent: boolean;
  checkedEntries: number;
}> {
  const response = await fetch(
    `${API_URL}/wallets/${encodeURIComponent(walletId)}/reconciliation`,
    { method: 'POST' },
  );

  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/health/ready`);
    return response.ok;
  } catch {
    return false;
  }
}

export function formatMoney(money: Money): string {
  const amount = Number(money.amount);

  if (!Number.isFinite(amount)) {
    return `${money.amount} ${money.currency}`;
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: money.currency,
  }).format(amount);
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}
