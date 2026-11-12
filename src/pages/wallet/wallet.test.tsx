import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";

// Wallet & payouts (Figma 06.01–06.10) against a fake API.

const WALLET = {
  balance: 100000,
  pendingBalance: 40000,
  totalEarned: 140000,
  totalWithdrawn: 0,
  totalCommissionPaid: 0,
  test: { balance: 4850, pendingBalance: 58200, totalEarned: 63050 },
  bank: { bankName: "GTBank", bankCode: "058", accountName: "ELIJAH APPAREL LTD", last4: "9921", verified: true },
  schedule: { interval: "weekly", days: 7, nextWithdrawalDate: "2026-11-01T00:00:00Z", eligibleNow: true, lastWithdrawalAt: null, notificationEmail: null, payoutReminder: true, timezone: "Africa/Lagos" },
  fees: { withdrawalRate: 0, paystackTransferFee: true, minWithdrawal: 1000 },
  paymentsMode: "live",
  payoutsCount: 2,
};
const quote = (amount: number, over = {}) => ({ amount, bimanageFee: 0, bimanageFeeRate: 0, paystackFee: amount > 50000 ? 50 : 25, fee: amount > 50000 ? 50 : 25, net: amount - (amount > 50000 ? 50 : 25), available: 100000, testBalance: 4850, canWithdraw: true, reasons: [], nextWithdrawalDate: "2026-11-01T00:00:00Z", bank: WALLET.bank, minWithdrawal: 1000, ...over });
const TX = (over = {}) => ({ _id: "t1", type: "credit", amount: 46075, grossAmount: null, fee: 0, bimanageFee: 0, paystackFee: 0, description: "Payment received for store order BM-AAAA-BBBB", reference: "BMS-1", status: "pending", balanceAfter: 0, mode: "live", failureReason: null, order: { _id: "o1", trackingNo: "BM-AAAA-BBBB" }, createdAt: "2026-11-12T09:00:00Z", completedAt: null, ...over });

let fb: FakeBackend;
beforeEach(() => {
  localStorage.clear();
  tokenStore.set("tok");
  serverStatus.set("up");
  fb = installFakeBackend();
  fb.handlers["GET /subscriptions/current"] = () => [200, { plan: "standard", status: "active", features: { store: true } }];
  fb.handlers["GET /wallet"] = () => [200, WALLET];
  fb.handlers["GET /wallet/transactions"] = () => [200, { transactions: [TX(), TX({ _id: "t2", type: "credit", mode: "test", reference: "BMS-2", order: { _id: "o2", trackingNo: "BM-WYYZ-KJDF" } })], total: 2, page: 1, totalPages: 1 }];
  fb.handlers["GET /wallet/banks"] = () => [200, { banks: [{ name: "Access Bank", code: "044" }, { name: "GTBank", code: "058" }] }];
  fb.handlers["GET /wallet/withdrawal-quote"] = (_b, _h, url) => [200, quote(Number(url.searchParams.get("amount") ?? 100000))];
});
afterEach(() => {
  vi.restoreAllMocks();
  tokenStore.clear();
});
const last = (key: string) => [...fb.calls].reverse().find((c) => c.key === key);

describe("wallet", () => {
  it("06.01: balances, payouts and test money shown apart (never as withdrawable)", async () => {
    renderApp("/wallet");
    expect(await screen.findByRole("heading", { name: "Wallet overview" })).toBeInTheDocument();
    expect(screen.getByText("₦100,000")).toBeInTheDocument();
    expect(screen.getByText("Test money: ₦63,050")).toBeInTheDocument();
    expect(screen.getByText(/can't be withdrawn, and is cleared when payments go live/)).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "BM-WYYZ-KJDF" })).toBeInTheDocument();
    expect(screen.getAllByText("Test").length).toBeGreaterThan(0);
    expect(screen.getByText(/BiManage's 3% is taken at sale. Payouts: Paystack's transfer fee only/)).toBeInTheDocument();
  });

  it("team members can't see the wallet; no store explains how to start", async () => {
    fb.handlers["GET /settings/my-role"] = () => [200, { role: "staff", permissions: {}, businessId: "u9" }];
    renderApp("/wallet");
    expect(await screen.findByText("Only the business owner can see the wallet")).toBeInTheDocument();
  });

  it("no store yet → create your store", async () => {
    fb.handlers["GET /wallet"] = () => [404, { message: "Create your online store first.", code: "no_store" }];
    renderApp("/wallet");
    expect(await screen.findByRole("link", { name: "Create your store" })).toHaveAttribute("href", "/store/create");
  });

  it("06.02: the account holder is looked up before saving; a bad account shows the 06.09 message", async () => {
    fb.handlers["GET /wallet/resolve-account"] = (_b, _h, url) =>
      url.searchParams.get("accountNumber") === "0123459921" ? [200, { accountName: "ELIJAH APPAREL LTD" }] : [400, { message: "We couldn't find an account with that number at this bank. Check both and try again.", field: "accountNumber", code: "bank_validation_failed" }];
    fb.handlers["POST /wallet/setup-bank"] = () => [200, { accountName: "ELIJAH APPAREL LTD", wallet: WALLET }];
    const user = userEvent.setup();
    renderApp("/wallet/bank");
    await user.selectOptions(await screen.findByLabelText(/bank name/i), "058");
    await user.type(screen.getByLabelText(/account number/i), "0000000000");
    expect(await screen.findByText("We couldn't verify this account")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save bank account" })).toBeDisabled();
    await user.clear(screen.getByLabelText(/account number/i));
    await user.type(screen.getByLabelText(/account number/i), "0123459921");
    expect(await screen.findByText("Verified: ELIJAH APPAREL LTD")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save bank account" }));
    await waitFor(() => expect(last("POST /wallet/setup-bank")?.body).toEqual({ bankCode: "058", accountNumber: "0123459921", bankName: "GTBank" }));
    expect(await screen.findByText("Bank account linked.")).toBeInTheDocument();
  });

  it("06.04 → 06.05 → 06.06: amount, Paystack fee and net shown; nothing sent until Confirm", async () => {
    fb.handlers["POST /wallet/withdraw"] = (b) => [200, { reference: "BMW-1", transactionId: "w1", ...quote(Number(b.amount)), status: "pending", nextWithdrawalDate: "2026-11-19T00:00:00Z", wallet: WALLET }];
    fb.handlers["GET /wallet/transactions/w1"] = () => [200, TX({ _id: "w1", type: "withdrawal", amount: 49975, grossAmount: 50000, fee: 25, paystackFee: 25, reference: "BMW-1", order: null })];
    const user = userEvent.setup();
    const router = renderApp("/wallet/withdraw");
    const amount = await screen.findByLabelText(/amount to withdraw/i);
    await user.clear(amount);
    await user.type(amount, "50000");
    await waitFor(() => expect(screen.getByLabelText(/net payout/i)).toHaveValue("₦49,975"));
    expect(screen.getByLabelText(/paystack transfer fee/i)).toHaveValue("₦25");
    await user.click(screen.getByRole("button", { name: "Review payout" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/wallet/withdraw/review"));
    expect(await screen.findByText("₦49,975")).toBeInTheDocument();
    expect(last("POST /wallet/withdraw")).toBeUndefined();
    await user.click(screen.getByRole("button", { name: "Confirm request" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/wallet/withdraw/submitted"));
    expect(last("POST /wallet/withdraw")?.body).toEqual({ amount: 50000 });
    expect(await screen.findByText("Your payout is on its way")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View payout status" })).toHaveAttribute("href", "/wallet/transactions/w1");
  });

  it("when payouts aren't possible, the reasons are shown and Review is disabled (e.g. test mode)", async () => {
    fb.handlers["GET /wallet/withdrawal-quote"] = (_b, _h, url) => [200, quote(Number(url.searchParams.get("amount") ?? 0), { canWithdraw: false, reasons: [{ code: "test_mode", message: "Payouts are only possible with real (live) payments. Test money can't be withdrawn." }] })];
    renderApp("/wallet/withdraw");
    expect(await screen.findByText(/Test money can't be withdrawn\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review payout" })).toBeDisabled();
  });

  it("06.10: a refused transfer lands on the failed payout with Retry and Edit bank details", async () => {
    fb.handlers["POST /wallet/withdraw"] = () => [502, { message: "Paystack couldn't send this payout. The money is back in your wallet; you can try again.", code: "transfer_failed", transactionId: "w9" }];
    fb.handlers["GET /wallet/transactions/w9"] = () => [200, TX({ _id: "w9", type: "withdrawal", status: "failed", amount: 49975, grossAmount: 50000, fee: 25, reference: "BMW-9", failureReason: "Account closed", order: null, bank: WALLET.bank })];
    const user = userEvent.setup();
    const router = renderApp("/wallet/withdraw/review?amount=50000");
    await user.click(await screen.findByRole("button", { name: "Confirm request" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/wallet/transactions/w9"));
    expect(await screen.findByRole("heading", { name: "Payout could not be completed" })).toBeInTheDocument();
    expect(screen.getByText("Account closed")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Retry transfer" })[0]).toHaveAttribute("href", "/wallet/withdraw?amount=50000");
    expect(screen.getByRole("link", { name: "Edit bank details" })).toHaveAttribute("href", "/wallet/bank");
  });

  it("06.07: filters and search go to the API and stay in the URL; test rows are labelled", async () => {
    const user = userEvent.setup();
    const router = renderApp("/wallet/transactions");
    await screen.findByRole("link", { name: "BM-AAAA-BBBB" });
    await user.selectOptions(screen.getByRole("combobox", { name: "Type" }), "withdrawal");
    await user.type(screen.getByRole("searchbox", { name: /search reference/i }), "BMW{Enter}");
    await waitFor(() => expect(router.state.location.search).toContain("type=withdrawal"));
    expect(router.state.location.search).toContain("q=BMW");
    const row = screen.getByRole("link", { name: "BM-WYYZ-KJDF" }).closest("li")!;
    expect(within(row).getByText("Test")).toBeInTheDocument();
  });

  it("06.03: custom interval needs 7–90 days; saving sends the schedule", async () => {
    fb.handlers["PUT /wallet/withdrawal-schedule"] = (b) => [200, { wallet: { ...WALLET, schedule: { ...WALLET.schedule, interval: b.interval, days: b.days ?? 30, nextWithdrawalDate: "2026-12-10T09:00:00Z", eligibleNow: false } } }];
    const user = userEvent.setup();
    renderApp("/wallet/schedule");
    await user.selectOptions(await screen.findByLabelText(/payout interval/i), "custom");
    await user.clear(screen.getByLabelText(/days between payouts/i));
    await user.type(screen.getByLabelText(/days between payouts/i), "3");
    await user.click(screen.getByRole("button", { name: "Save schedule" }));
    expect(await screen.findByText("Choose between 7 and 90 days.")).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/days between payouts/i));
    await user.type(screen.getByLabelText(/days between payouts/i), "14");
    await user.click(screen.getByRole("button", { name: "Save schedule" }));
    await waitFor(() => expect(last("PUT /wallet/withdrawal-schedule")?.body).toMatchObject({ interval: "custom", days: 14, payoutReminder: true }));
    expect(await screen.findByText(/Schedule saved/)).toBeInTheDocument();
  });
});

describe("test money in the headline figures", () => {
  const TEST_MODE = { ...WALLET, balance: 0, pendingBalance: 0, totalEarned: 0, test: { balance: 140650, pendingBalance: 0, totalEarned: 140650 }, paymentsMode: "test", bank: null };

  it("test mode: figures include test money, with a TEST badge and a note; withdrawable stays ₦0", async () => {
    fb.handlers["GET /wallet"] = () => [200, TEST_MODE];
    renderApp("/wallet");
    const total = (await screen.findByRole("heading", { name: /total earnings/i })).closest("section")!;
    expect(within(total).getByText("₦140,650")).toBeInTheDocument();
    expect(within(total).getByTestId("kpi-badge")).toHaveTextContent("TEST");
    expect(within(total).getByText("Includes ₦140,650 test money: not real, can't be withdrawn, cleared when payments go live.")).toBeInTheDocument();
    const available = screen.getByRole("heading", { name: /^available/i }).closest("section")!;
    expect(within(available).getByText("₦140,650")).toBeInTheDocument();
    expect(within(available).getByText("Available to withdraw: ₦0")).toBeInTheDocument();
    const onHold = screen.getByRole("heading", { name: /on hold/i }).closest("section")!;
    expect(within(onHold).queryByTestId("kpi-badge")).toBeNull(); // no test money on hold
    expect(screen.queryByLabelText("Test money")).toBeNull(); // no separate card in test mode
  });

  it("the payout screen only ever offers live money", async () => {
    fb.handlers["GET /wallet"] = () => [200, TEST_MODE];
    fb.handlers["GET /wallet/withdrawal-quote"] = () => [200, quote(0, { available: 0, canWithdraw: false, reasons: [{ code: "test_mode", message: "Payouts are only possible with real (live) payments. Test money can't be withdrawn." }] })];
    renderApp("/wallet/withdraw");
    expect(await screen.findByLabelText(/available to withdraw/i)).toHaveValue("₦0");
    expect(screen.getByText("Test money (₦140,650) can't be withdrawn.")).toBeInTheDocument();
    expect(screen.getByLabelText(/amount to withdraw/i)).toHaveValue("");
    expect(screen.getByRole("button", { name: "Review payout" })).toBeDisabled();
  });

  it("live with test money not yet cleared: real figures only, test shown apart", async () => {
    fb.handlers["GET /wallet"] = () => [200, { ...TEST_MODE, paymentsMode: "live", balance: 5000, totalEarned: 5000 }];
    renderApp("/wallet");
    const total = (await screen.findByRole("heading", { name: /total earnings/i })).closest("section")!;
    expect(within(total).getByText("₦5,000")).toBeInTheDocument();
    expect(within(total).queryByTestId("kpi-badge")).toBeNull();
    expect(screen.getByLabelText("Test money")).toBeInTheDocument();
  });

  it("live and cleared: no badges, no notes", async () => {
    fb.handlers["GET /wallet"] = () => [200, { ...WALLET, test: { balance: 0, pendingBalance: 0, totalEarned: 0 } }];
    renderApp("/wallet");
    await screen.findByRole("heading", { name: /total earnings/i });
    expect(screen.queryAllByTestId("kpi-badge")).toHaveLength(0);
    expect(screen.queryByText(/\btest money\b/i)).toBeNull();
  });
});
