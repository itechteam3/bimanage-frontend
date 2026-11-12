import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api, apiDownload } from "@/lib/api/client";

// Wallet & payouts (Figma 06.01–06.10, backend #28).
// Rules shown to the merchant: BiManage takes its commission at sale; payouts
// only pass through Paystack's transfer fee (shown before confirming). Money
// from Paystack TEST payments is kept apart and can never be withdrawn.

export interface WalletBank {
  bankName: string;
  bankCode: string;
  accountName: string;
  last4: string;
  verified: boolean;
}

export interface Wallet {
  balance: number;
  pendingBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  totalCommissionPaid: number;
  test: { balance: number; pendingBalance: number; totalEarned: number };
  bank: WalletBank | null;
  schedule: {
    interval: "weekly" | "biweekly" | "monthly" | "custom";
    days: number;
    nextWithdrawalDate: string;
    eligibleNow: boolean;
    lastWithdrawalAt: string | null;
    notificationEmail: string | null;
    payoutReminder: boolean;
    timezone: string;
  };
  fees: { withdrawalRate: number; paystackTransferFee: boolean; minWithdrawal: number };
  paymentsMode: "test" | "live" | null;
  payoutsCount?: number;
}

export interface WithdrawalQuote {
  amount: number;
  bimanageFee: number;
  bimanageFeeRate: number;
  paystackFee: number;
  fee: number;
  net: number;
  available: number;
  testBalance: number;
  canWithdraw: boolean;
  reasons: Array<{ code: "no_bank" | "not_yet" | "amount" | "test_mode" | string; message: string }>;
  nextWithdrawalDate: string;
  bank: WalletBank | null;
  minWithdrawal: number;
}

export type TxType = "credit" | "debit" | "commission" | "withdrawal" | "refund";
export type TxStatus = "pending" | "completed" | "failed";

export interface WalletTx {
  _id: string;
  type: TxType;
  amount: number;
  grossAmount: number | null;
  fee: number;
  bimanageFee: number;
  paystackFee: number;
  description: string;
  reference?: string;
  status: TxStatus;
  balanceAfter: number;
  mode: "test" | "live" | null;
  failureReason: string | null;
  order: { _id: string; trackingNo: string; customerName?: string } | string | null;
  createdAt: string;
  completedAt: string | null;
  related?: WalletTx[];
  bank?: WalletBank | null;
}

export const TX_TYPE: Record<TxType, string> = { credit: "Store sale", debit: "Debit", commission: "BiManage fee", withdrawal: "Payout", refund: "Refund" };

/** Plain-language status for a row (06.07: Pending / Available / Paid / Failed). */
export function txStatus(t: Pick<WalletTx, "type" | "status">): { label: string; tone: "success" | "warning" | "danger" | "neutral" | "live" } {
  if (t.status === "failed") return { label: t.type === "withdrawal" ? "Failed · refunded" : "Failed", tone: "danger" };
  if (t.type === "credit") return t.status === "pending" ? { label: "On hold", tone: "warning" } : { label: "Available", tone: "success" };
  if (t.type === "withdrawal") return t.status === "pending" ? { label: "Processing", tone: "warning" } : { label: "Paid", tone: "success" };
  return { label: t.status === "pending" ? "Pending" : "Settled", tone: "neutral" };
}

/** Test money: not real, never withdrawable. Older records without a mode count as test. */
export const isTestTx = (t: Pick<WalletTx, "mode">) => t.mode !== "live";

export const walletKeys = {
  wallet: ["wallet"] as const,
  banks: ["wallet", "banks"] as const,
  quote: (amount: number) => ["wallet", "quote", amount] as const,
  txs: (q: Record<string, string>) => ["wallet", "txs", q] as const,
  tx: (id: string) => ["wallet", "tx", id] as const,
};

/** null = no store yet (the wallet holds store earnings). */
export const useWallet = () =>
  useQuery({
    queryKey: walletKeys.wallet,
    queryFn: async () => {
      try {
        return await api<Wallet>("/wallet");
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  });

export const useBanks = (enabled = true) =>
  useQuery({ queryKey: walletKeys.banks, queryFn: () => api<{ banks: Array<{ name: string; code: string }> }>("/wallet/banks").then((r) => r.banks), enabled, staleTime: 24 * 60 * 60 * 1000 });

export const resolveAccount = (accountNumber: string, bankCode: string) => api<{ accountName: string }>("/wallet/resolve-account", { query: { accountNumber, bankCode } });

function useWalletMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ["wallet"] }) });
}

export const useSetupBank = () => useWalletMutation((v: { accountNumber: string; bankCode: string; bankName?: string }) => api<{ accountName: string; wallet: Wallet }>("/wallet/setup-bank", { method: "POST", body: v }));

export const useSaveSchedule = () =>
  useWalletMutation((v: { interval: Wallet["schedule"]["interval"]; days?: number; notificationEmail?: string; payoutReminder?: boolean }) => api<{ wallet: Wallet }>("/wallet/withdrawal-schedule", { method: "PUT", body: v }));

export const useWithdrawalQuote = (amount: number | null, enabled = true) =>
  useQuery({
    queryKey: walletKeys.quote(amount ?? -1),
    queryFn: () => api<WithdrawalQuote>("/wallet/withdrawal-quote", { query: amount === null ? {} : { amount } }),
    enabled,
    placeholderData: keepPreviousData,
  });

export const useWithdraw = () =>
  useWalletMutation((amount: number) => api<{ reference: string; transactionId: string; amount: number; fee: number; net: number; status: string; nextWithdrawalDate: string; wallet: Wallet }>("/wallet/withdraw", { method: "POST", body: { amount } }));

export const useWalletTransactions = (q: Record<string, string>) =>
  useQuery({ queryKey: walletKeys.txs(q), queryFn: () => api<{ transactions: WalletTx[]; total: number; page: number; totalPages: number }>("/wallet/transactions", { query: q }), placeholderData: keepPreviousData });

export const useWalletTransaction = (id: string) => useQuery({ queryKey: walletKeys.tx(id), queryFn: () => api<WalletTx>(`/wallet/transactions/${encodeURIComponent(id)}`) });

export const downloadTransactionsCsv = (q: Record<string, string>) => apiDownload("/wallet/transactions/export", { query: q });
export const downloadReceipt = (id: string) => apiDownload(`/wallet/transactions/${encodeURIComponent(id)}/receipt`);
