import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconAlertTriangle, IconCheck, IconDownload, IconLock, IconSearch, IconWallet } from "@tabler/icons-react";
import { BankPicker, Button, ButtonLink, EmptyState, Field, SelectInput, Spinner, Status, TextInput } from "@/components/ui";
import { DetailRows, HelpPanel, IntroCard, KpiCard, PageTitle, Panel } from "@/components/page/Blocks";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { UpdatedNote } from "@/components/feedback/UpdatedNote";
import { ApiError, saveBlob } from "@/lib/api/client";
import { applyFieldErrors } from "@/lib/api/errorMessage";
import { useAuth } from "@/lib/auth/AuthProvider";
import { count, naira, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useUrlState } from "@/lib/nav/useUrlState";
import { useLeaveGuard } from "@/lib/nav/useLeaveGuard";
import {
  TX_TYPE,
  downloadReceipt,
  downloadTransactionsCsv,
  isTestTx,
  resolveAccount,
  txStatus,
  useBanks,
  useSaveSchedule,
  useSetupBank,
  useWallet,
  useWalletTransaction,
  useWalletTransactions,
  useWithdraw,
  useWithdrawalQuote,
  walletFigures,
  type Wallet,
  type WalletTx,
} from "@/lib/wallet/api";

const EYEBROW = "Workspace / Wallet & payouts";
const Loading = () => (
  <div className="flex justify-center py-16 text-ink-brand" role="status">
    <Spinner className="size-8" />
    <span className="sr-only">Loading…</span>
  </div>
);
const masked = (w: Pick<Wallet, "bank">) => (w.bank ? `${w.bank.bankName} •••• ${w.bank.last4}` : "Not linked");

// Wallet sections (06.xx mobile tabs: Wallet · Payout · History · More).
function WalletTabs() {
  const tabs: Array<[string, string, boolean?]> = [
    ["/wallet", "Overview", true],
    ["/wallet/withdraw", "Payout"],
    ["/wallet/transactions", "History"],
    ["/wallet/bank", "Bank account"],
    ["/wallet/schedule", "Schedule"],
  ];
  return (
    <nav aria-label="Wallet" className="-mx-5 overflow-x-auto px-5 lg:mx-0 lg:px-0">
      <ul className="flex w-max gap-1 rounded-md bg-surface-pale p-1">
        {tabs.map(([to, label, end]) => (
          <li key={to}>
            <NavLink to={to} end={end} className={({ isActive }) => cn("flex min-h-11 items-center rounded-sm px-4 text-action font-semibold", isActive ? "bg-surface-card text-ink-brand shadow-card" : "text-ink-muted hover:text-ink-brand")}>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Owner-only (payouts and bank details). No store yet → explain. */
function WithWallet({ children }: { children: (w: Wallet) => ReactNode }) {
  const { workspace } = useAuth();
  const isOwner = !workspace || workspace.role === "owner";
  const wallet = useWallet();
  if (!isOwner) return <EmptyState className="max-w-xl" icon={<IconLock className="size-7" />} title="Only the business owner can see the wallet" body="Payouts and bank details are limited to the owner." />;
  if (wallet.isLoading) return <Loading />;
  if (wallet.error) return <ErrorNote error={wallet.error} fallback="We couldn't load your wallet. Please try again." onRetry={() => void wallet.refetch()} />;
  if (!wallet.data)
    return (
      <EmptyState
        className="max-w-xl"
        icon={<IconWallet className="size-7" />}
        title="Your wallet starts with your online store"
        body="Earnings from store orders land here. Create your store to start selling."
        action={
          <ButtonLink to="/store/create" size="md">
            Create your store
          </ButtonLink>
        }
      />
    );
  return <>{children(wallet.data)}</>;
}

/** "Includes ₦X test money: not real, can't be withdrawn, cleared when payments go live." */
const testNote = (amount: number) => (amount > 0 ? `Includes ${naira(amount)} test money: not real, can't be withdrawn, cleared when payments go live.` : undefined);

/** Payments are live but test money hasn't been cleared yet: show it apart from the real figures. */
function TestMoneyNote({ w }: { w: Wallet }) {
  const t = w.test;
  if (!walletFigures(w).separateTest || !t) return null;
  return (
    <section aria-label="Test money" className="flex flex-col gap-1 rounded-xl border border-dashed border-line-strong bg-surface-pale px-5 py-4">
      <p className="flex items-center gap-2 font-semibold text-ink-strong">
        <Status tone="neutral">Test</Status> Test money: {naira(t.balance + t.pendingBalance)}
      </p>
      <p className="text-body-sm text-ink-secondary">
        From Paystack test payments ({naira(t.balance)} available, {naira(t.pendingBalance)} on hold). It isn&apos;t real money, can&apos;t be withdrawn, and is cleared when payments go live.
      </p>
    </section>
  );
}

// ── 06.01 Overview ────────────────────────────────────────────────────────

export function WalletOverviewPage() {
  return <WithWallet>{(w) => <Overview w={w} />}</WithWallet>;
}

function Overview({ w }: { w: Wallet }) {
  const { dataUpdatedAt } = useWallet();
  const txs = useWalletTransactions({ limit: "5" });
  const f = walletFigures(w);
  const total = Math.max(f.available.value + f.onHold.value, 0);
  const availPct = total ? Math.round((f.available.value / total) * 100) : 0;
  const badge = (part: { test: number }) => (part.test > 0 ? "TEST" : undefined);
  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        actions={
          <ButtonLink to="/wallet/withdraw" size="md">
            Request payout
          </ButtonLink>
        }
      >
        Wallet overview
      </PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Track earnings, money on hold and payouts.</p>
      <WalletTabs />
      <IntroCard eyebrow={EYEBROW} title="Store earnings become available when an order is completed (or 7 days after delivery)." />
      <UpdatedNote updatedAt={dataUpdatedAt} className="-mb-2" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard tone="stock" label="Total earnings" value={naira(f.totalEarned.value)} caption="Store payments (after BiManage's 3%)" badge={badge(f.totalEarned)} note={testNote(f.totalEarned.test)} />
        <KpiCard tone="revenue" label="Available" value={naira(f.available.value)} caption={f.includeTest ? `Available to withdraw: ${naira(f.withdrawable)}` : "Ready to withdraw"} badge={badge(f.available)} note={testNote(f.available.test)} />
        <KpiCard tone="invoices" label="On hold" value={naira(f.onHold.value)} caption="Orders not completed yet" badge={badge(f.onHold)} note={testNote(f.onHold.test)} />
        <KpiCard tone="orders" label="Payouts" value={count(w.payoutsCount ?? 0)} caption="Completed transfers" />
      </div>
      <TestMoneyNote w={w} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Transaction activity" subtitle="Latest money in and out.">
          {txs.isLoading ? <Loading /> : txs.error ? <ErrorNote error={txs.error} fallback="We couldn't load your transactions." onRetry={() => void txs.refetch()} /> : <TxList items={txs.data?.transactions ?? []} empty="No transactions yet. Store sales appear here." />}
          <Link to="/wallet/transactions" className="mt-3 inline-block text-action font-semibold text-ink-brand hover:underline">
            See all transactions
          </Link>
        </Panel>
        <Panel tone="pale" title="Next actions and insights">
          <dl className="flex flex-col gap-3">
            {[
              ["Next payout", w.schedule.eligibleNow ? "Available now" : shortDate(w.schedule.nextWithdrawalDate)],
              ["Payout interval", `Every ${w.schedule.days} days`],
              ["Fees", w.fees.withdrawalRate ? `${w.fees.withdrawalRate}% + Paystack transfer fee` : "BiManage's 3% is taken at sale. Payouts: Paystack's transfer fee only."],
              ["Linked account", masked(w)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md bg-surface-card px-3 py-2">
                <dt className="text-caption font-semibold uppercase text-ink-muted">{k}</dt>
                <dd className="text-body-lg text-ink-strong">{v}</dd>
              </div>
            ))}
          </dl>
          <section aria-labelledby="dist" className="mt-5 rounded-xl border border-line-card bg-surface-card p-4">
            <h3 id="dist" className="text-caption font-semibold uppercase text-ink-brand">
              Balance distribution
            </h3>
            <p className="mt-1 text-caption text-ink-muted">{f.includeTest ? `${naira(total)} · includes ${naira(f.testTotal)} test money` : `Real money · ${naira(total)}`}</p>
            <div className="mt-3 flex h-3 gap-0.5 overflow-hidden rounded-full bg-surface-pale" aria-hidden="true">
              {f.available.value > 0 && <span className="h-full rounded-full bg-success" style={{ width: `${availPct}%` }} />}
              {f.onHold.value > 0 && <span className="h-full flex-1 rounded-full bg-warning" />}
            </div>
            <ul className="mt-3 flex flex-col gap-1 text-body-sm">
              <li className="flex items-center gap-2 text-ink-strong">
                <span aria-hidden="true" className="size-2.5 rounded-full bg-success" /> Available {naira(f.available.value)}
              </li>
              <li className="flex items-center gap-2 text-ink-strong">
                <span aria-hidden="true" className="size-2.5 rounded-full bg-warning" /> On hold {naira(f.onHold.value)}
              </li>
            </ul>
          </section>
        </Panel>
      </div>
    </div>
  );
}

function TxList({ items, empty }: { items: WalletTx[]; empty: string }) {
  if (!items.length) return <p className="text-body-sm text-ink-muted">{empty}</p>;
  return (
    <ul className="flex flex-col divide-y divide-line-subtle">
      {items.map((t) => {
        const s = txStatus(t);
        const out = t.type === "withdrawal" || t.type === "commission" || t.type === "debit" || t.type === "refund";
        return (
          <li key={t._id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-3 md:grid-cols-[1.2fr_1fr_auto_auto]">
            <Link to={`/wallet/transactions/${t._id}`} className="truncate font-semibold text-ink-strong hover:underline">
              {t.order && typeof t.order === "object" ? t.order.trackingNo : t.reference || TX_TYPE[t.type]}
            </Link>
            <span className="text-right font-semibold text-ink-strong md:order-3">
              {out ? "−" : ""}
              {naira(t.amount)}
            </span>
            <span className="flex flex-wrap items-center gap-2 text-body-sm text-ink-muted md:order-2">
              {TX_TYPE[t.type]} · {shortDate(t.createdAt)}
              {isTestTx(t) && <Status tone="neutral">Test</Status>}
            </span>
            <span className="justify-self-end md:order-4">
              <Status tone={s.tone}>{s.label}</Status>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ── 06.02 / 06.09 Bank account ────────────────────────────────────────────

const bankSchema = z.object({
  bankCode: z.string().min(1, "Choose your bank."),
  accountNumber: z.string().trim().regex(/^\d{10}$/, "Enter the 10-digit account number (NUBAN)."),
});

export function BankAccountPage() {
  return <WithWallet>{(w) => <BankAccount w={w} />}</WithWallet>;
}

function BankAccount({ w }: { w: Wallet }) {
  const banks = useBanks();
  const save = useSetupBank();
  const [holder, setHolder] = useState<{ state: "idle" | "checking" | "ok" | "failed"; name?: string; message?: string }>({ state: "idle" });
  const [formError, setFormError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const { register, handleSubmit, watch, setError, setValue, formState, reset } = useForm<z.infer<typeof bankSchema>>({ resolver: zodResolver(bankSchema), defaultValues: { bankCode: w.bank?.bankCode ?? "", accountNumber: "" } });
  const guard = useLeaveGuard(formState.isDirty && !formState.isSubmitSuccessful);
  const bankCode = watch("bankCode");
  const accountNumber = watch("accountNumber");

  // Look up the account holder as soon as both are filled in (06.02 "ACCOUNT HOLDER").
  useEffect(() => {
    if (!bankCode || !/^\d{10}$/.test(accountNumber ?? "")) {
      setHolder({ state: "idle" });
      return;
    }
    let live = true;
    setHolder({ state: "checking" });
    resolveAccount(accountNumber, bankCode).then(
      (r) => live && setHolder({ state: "ok", name: r.accountName }),
      (err) => live && setHolder({ state: "failed", message: err instanceof ApiError && err.status === 400 ? err.message : "We couldn't check this account right now." })
    );
    return () => {
      live = false;
    };
  }, [bankCode, accountNumber]);

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    setSaved(false);
    try {
      const bankName = banks.data?.find((b) => b.code === v.bankCode)?.name;
      await save.mutateAsync({ ...v, bankName });
      guard.allow();
      reset({ bankCode: v.bankCode, accountNumber: "" });
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && (err.data as { code?: string }).code === "bank_validation_failed") setHolder({ state: "failed", message: err.message });
      if (!applyFieldErrors(err, setError, ["accountNumber", "bankCode"])) setFormError(err);
    }
  });
  const paymentsOff = banks.error instanceof ApiError && banks.error.status === 503;

  return (
    <div className="flex flex-col gap-6">
      {guard.dialog}
      <PageTitle>Link a bank account</PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Where your payouts are sent. We check the account name with your bank.</p>
      <WalletTabs />
      <IntroCard eyebrow={EYEBROW} title={w.bank ? `Payouts go to ${masked(w)} (${w.bank.accountName}).` : "Add the account your payouts should go to."} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
          <Panel title={w.bank ? "Change bank account" : "Bank details"} subtitle="Nigerian bank accounts in naira.">
            {paymentsOff ? (
              <p className="text-body-sm text-ink-secondary">Payouts aren&apos;t available yet, so bank accounts can&apos;t be linked. Please check back later.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 md:gap-x-10 md:gap-y-6">
                <Field label="Bank name" required error={formState.errors.bankCode?.message} hint="Type to search">
                  <BankPicker banks={banks.data ?? []} loading={banks.isLoading} disabled={banks.isLoading} value={bankCode} onChange={(code) => setValue("bankCode", code, { shouldDirty: true, shouldValidate: true })} />
                </Field>
                <Field label="Account number" required error={formState.errors.accountNumber?.message} hint="10 digits (NUBAN)">
                  <TextInput inputMode="numeric" autoComplete="off" maxLength={10} {...register("accountNumber")} />
                </Field>
                <Field label="Account holder" hint="Filled in from your bank.">
                  <TextInput readOnly value={holder.state === "ok" ? holder.name ?? "" : holder.state === "checking" ? "Checking…" : ""} aria-live="polite" />
                </Field>
                <Field label="Currency">
                  <TextInput readOnly value="NGN (Nigerian naira)" />
                </Field>
              </div>
            )}
            {holder.state === "failed" && (
              <section role="alert" className="mt-5 flex gap-3 rounded-xl bg-danger-bg px-4 py-3">
                <IconAlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger" />
                <div>
                  <p className="font-semibold text-ink-strong">We couldn&apos;t verify this account</p>
                  <p className="text-body-sm text-ink-secondary">{holder.message} Check the bank and the 10-digit number, then try again.</p>
                </div>
              </section>
            )}
            {holder.state === "ok" && (
              <p role="status" className="mt-4 flex items-center gap-2 text-body-sm text-success-ink">
                <IconCheck aria-hidden="true" className="size-4" /> Verified: {holder.name}
              </p>
            )}
          </Panel>
          {banks.error && !paymentsOff && <ErrorNote error={banks.error} fallback="We couldn't load the list of banks." onRetry={() => void banks.refetch()} />}
          <ErrorNote error={formError} fallback="We couldn't link this account. Please try again." />
          {saved && (
            <p role="status" className="text-body-sm text-success-ink">
              Bank account linked.
            </p>
          )}
          {!paymentsOff && (
            <Button type="submit" className="md:self-end md:px-10" loading={save.isPending} loadingText="Verifying…" disabled={holder.state === "checking" || holder.state === "failed"}>
              Save bank account
            </Button>
          )}
        </form>
        <HelpPanel
          items={[
            ["Verification", "Account name checked with your bank"],
            ["Payout provider", "Paystack"],
            ["Current account", masked(w)],
            ["Privacy", "Only the last 4 digits are shown"],
          ]}
        />
      </div>
    </div>
  );
}

// ── 06.03 Withdrawal schedule ─────────────────────────────────────────────

const scheduleSchema = z
  .object({
    interval: z.enum(["weekly", "biweekly", "monthly", "custom"]),
    days: z.string().optional(),
    notificationEmail: z.union([z.literal(""), z.string().trim().email("Enter a valid email address.")]),
    payoutReminder: z.enum(["on", "off"]),
  })
  .superRefine((v, ctx) => {
    if (v.interval === "custom" && !(Number(v.days) >= 7 && Number(v.days) <= 90)) ctx.addIssue({ code: "custom", path: ["days"], message: "Choose between 7 and 90 days." });
  });

export function SchedulePage() {
  return <WithWallet>{(w) => <Schedule w={w} />}</WithWallet>;
}

function Schedule({ w }: { w: Wallet }) {
  const save = useSaveSchedule();
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);
  const defaults = (x: Wallet) => ({ interval: x.schedule.interval, days: String(x.schedule.days), notificationEmail: x.schedule.notificationEmail ?? "", payoutReminder: x.schedule.payoutReminder ? ("on" as const) : ("off" as const) });
  const { register, handleSubmit, watch, setError, reset, formState } = useForm<z.infer<typeof scheduleSchema>>({ resolver: zodResolver(scheduleSchema), defaultValues: defaults(w) });
  const guard = useLeaveGuard(formState.isDirty);
  const interval = watch("interval");

  const onSubmit = handleSubmit(async (v) => {
    setSaved(false);
    setFormError(null);
    try {
      const res = await save.mutateAsync({ interval: v.interval, days: v.interval === "custom" ? Number(v.days) : undefined, notificationEmail: v.notificationEmail, payoutReminder: v.payoutReminder === "on" });
      reset(defaults(res.wallet));
      setSaved(true);
    } catch (err) {
      if (!applyFieldErrors(err, setError, ["interval", "days", "notificationEmail"])) setFormError(err);
    }
  });

  return (
    <div className="flex flex-col gap-6">
      {guard.dialog}
      <PageTitle>Withdrawal schedule</PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Choose how often you can request a payout.</p>
      <WalletTabs />
      <IntroCard eyebrow={EYEBROW} title="A minimum seven-day interval protects against customer disputes." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
          <Panel title="Withdrawal timing" subtitle="Only available (completed-order) money can be paid out.">
            <div className="grid gap-4 md:grid-cols-2 md:gap-x-10 md:gap-y-6">
              <Field label="Payout interval" required>
                <SelectInput {...register("interval")}>
                  <option value="weekly">Every 7 days</option>
                  <option value="biweekly">Every 14 days</option>
                  <option value="monthly">Every 30 days</option>
                  <option value="custom">Custom</option>
                </SelectInput>
              </Field>
              {interval === "custom" ? (
                <Field label="Days between payouts" required error={formState.errors.days?.message} hint="7 to 90">
                  <TextInput inputMode="numeric" {...register("days")} />
                </Field>
              ) : (
                <Field label="Next eligible date" hint="From your last payout">
                  <TextInput readOnly value={w.schedule.eligibleNow ? "Available now" : shortDate(w.schedule.nextWithdrawalDate)} />
                </Field>
              )}
              <Field label="Business timezone">
                <TextInput readOnly value={w.schedule.timezone} />
              </Field>
              <Field label="Destination account">
                <TextInput readOnly value={masked(w)} />
              </Field>
              <Field label="Notification email" error={formState.errors.notificationEmail?.message} hint="Leave empty to use your sign-in email.">
                <TextInput type="email" {...register("notificationEmail")} />
              </Field>
              <Field label="Payout reminder">
                <SelectInput {...register("payoutReminder")}>
                  <option value="on">Enabled: remind me when I can withdraw</option>
                  <option value="off">Off</option>
                </SelectInput>
              </Field>
            </div>
          </Panel>
          <ErrorNote error={formError} fallback="We couldn't save your schedule. Please try again." />
          {saved && (
            <p role="status" className="text-body-sm text-success-ink">
              Schedule saved. Next eligible date: {shortDate(save.data?.wallet.schedule.nextWithdrawalDate)}.
            </p>
          )}
          <Button type="submit" className="md:self-end md:px-10" loading={save.isPending} loadingText="Saving…">
            Save schedule
          </Button>
        </form>
        <HelpPanel
          items={[
            ["Minimum interval", "7 days"],
            ["Money on hold", "Stays unavailable until the order completes"],
            ["Fees", "Paystack's transfer fee, shown before you confirm"],
          ]}
        />
      </div>
    </div>
  );
}

// ── 06.04 Request withdrawal ──────────────────────────────────────────────

const toAmount = (s: string) => Number(String(s).replace(/[₦,\s]/g, ""));

export function WithdrawPage() {
  return <WithWallet>{(w) => <Withdraw w={w} />}</WithWallet>;
}

function Withdraw({ w }: { w: Wallet }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [typed, setTyped] = useState(params.get("amount") ?? (w.balance > 0 ? String(w.balance) : ""));
  const [debounced, setDebounced] = useState(typed);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(typed), 300);
    return () => clearTimeout(t);
  }, [typed]);
  const amount = toAmount(debounced);
  const quote = useWithdrawalQuote(Number.isFinite(amount) ? amount : 0, Number.isFinite(amount));
  const q = quote.data;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        actions={
          <ButtonLink to="/wallet/transactions" size="md" variant="secondary">
            Transaction history
          </ButtonLink>
        }
      >
        Withdraw available funds
      </PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Transfer available earnings to your bank account.</p>
      <WalletTabs />
      <IntroCard eyebrow={EYEBROW} title="Money on hold and test money can't be withdrawn." />
      <TestMoneyNote w={w} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (q?.canWithdraw) navigate(`/wallet/withdraw/review?amount=${encodeURIComponent(q.amount)}`);
          }}
          className="flex flex-col gap-5"
        >
          <Panel title="Withdrawal details" subtitle="Confirm the amount, fees and recipient.">
            <div className="grid gap-4 md:grid-cols-2 md:gap-x-10 md:gap-y-6">
              <Field label="Available to withdraw" hint={walletFigures(w).testTotal > 0 ? `Test money (${naira(walletFigures(w).testTotal)}) can't be withdrawn.` : undefined}>
                <TextInput readOnly value={naira(w.balance)} />
              </Field>
              <Field label="Amount to withdraw" required hint={`Minimum ${naira(w.fees.minWithdrawal)}`}>
                <TextInput inputMode="decimal" value={typed} onChange={(e) => setTyped(e.target.value)} />
              </Field>
              <Field label="Paystack transfer fee">
                <TextInput readOnly value={q ? naira(q.paystackFee) : "…"} />
              </Field>
              <Field label="Net payout">
                <TextInput readOnly value={q ? naira(q.net) : "…"} aria-live="polite" />
              </Field>
              {q && q.bimanageFee > 0 && (
                <Field label={`BiManage fee (${q.bimanageFeeRate}%)`}>
                  <TextInput readOnly value={naira(q.bimanageFee)} />
                </Field>
              )}
              <Field label="Receiving bank">
                <TextInput readOnly value={w.bank?.bankName ?? "Not linked"} />
              </Field>
              <Field label="Account">
                <TextInput readOnly value={w.bank ? `•••• ${w.bank.last4}` : "—"} />
              </Field>
              <Field label="Account name">
                <TextInput readOnly value={w.bank?.accountName ?? "—"} />
              </Field>
              <Field label="Next payout date">
                <TextInput readOnly value={w.schedule.eligibleNow ? "Available now" : shortDate(w.schedule.nextWithdrawalDate)} />
              </Field>
            </div>
            {q && q.reasons.length > 0 && (
              <ul role="status" className="mt-5 flex flex-col gap-2 rounded-xl bg-surface-tint-warm px-4 py-3 text-body-sm text-ink-strong">
                {q.reasons.map((r) => (
                  <li key={r.code + r.message} className="flex flex-wrap items-center gap-2">
                    {r.message}
                    {r.code === "no_bank" && (
                      <Link to="/wallet/bank" className="font-semibold text-ink-brand hover:underline">
                        Link a bank account
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <ErrorNote error={quote.error} fallback="We couldn't work out this payout. Please try again." />
          <Button type="submit" className="md:self-end md:px-10" disabled={!q?.canWithdraw || quote.isFetching}>
            Review payout
          </Button>
        </form>
        <HelpPanel
          items={[
            ["Available to withdraw", naira(w.balance)],
            ["Hold period", "Until the order is completed"],
            ["Payout provider", "Paystack"],
            ["Notification", "Email and in-app alert"],
          ]}
          callout={{ title: "Before you submit", body: "Check the bank, the account and the fee." }}
        />
      </div>
    </div>
  );
}

// ── 06.05 Review → 06.06 Submitted ────────────────────────────────────────

export function ReviewWithdrawalPage() {
  return <WithWallet>{(w) => <Review w={w} />}</WithWallet>;
}

function Review({ w }: { w: Wallet }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const amount = Number(params.get("amount"));
  const quote = useWithdrawalQuote(Number.isFinite(amount) ? amount : 0, Number.isFinite(amount) && amount > 0);
  const withdraw = useWithdraw();
  const [error, setError] = useState<unknown>(null);
  const q = quote.data;
  if (!Number.isFinite(amount) || amount <= 0) return <ErrorNote error fallback="Choose an amount to withdraw first." />;
  if (quote.isLoading || !q) return <Loading />;

  const confirm = async () => {
    setError(null);
    try {
      const res = await withdraw.mutateAsync(q.amount);
      navigate(`/wallet/withdraw/submitted?tx=${encodeURIComponent(res.transactionId)}`, { replace: true });
    } catch (err) {
      const txId = err instanceof ApiError ? (err.data as { transactionId?: string }).transactionId : undefined;
      if (txId) navigate(`/wallet/transactions/${txId}`, { replace: true });
      else setError(err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Review your payout</PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Nothing is sent until you confirm.</p>
      <IntroCard eyebrow={EYEBROW} title="Check the bank, the account and the fee before submitting." />
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-line-card bg-surface-card p-5 shadow-card lg:p-8">
        <h2 className="text-title-md text-ink-strong">Payout to {w.bank?.bankName ?? "your bank"}</h2>
        <div className="mt-5">
          <DetailRows
            rows={[
              ["Amount", naira(q.amount)],
              ["Paystack transfer fee", `− ${naira(q.paystackFee)}`],
              ...(q.bimanageFee > 0 ? ([[`BiManage fee (${q.bimanageFeeRate}%)`, `− ${naira(q.bimanageFee)}`]] as Array<[string, string]>) : []),
              ["You receive", <strong key="n">{naira(q.net)}</strong>],
              ["Bank", w.bank?.bankName ?? "—"],
              ["Account", w.bank ? `${w.bank.accountName} •••• ${w.bank.last4}` : "—"],
              ["After this, next payout", shortDate(new Date(Date.now() + w.schedule.days * 86400000))],
            ]}
          />
        </div>
        {!q.canWithdraw && (
          <ul role="alert" className="mt-5 rounded-xl bg-surface-tint-warm px-4 py-3 text-body-sm text-ink-strong">
            {q.reasons.map((r) => (
              <li key={r.message}>{r.message}</li>
            ))}
          </ul>
        )}
        <ErrorNote error={error} fallback="We couldn't request this payout. Please try again." className="mt-4" />
        <div className="mt-6 flex flex-col gap-3 md:flex-row">
          <Button onClick={() => void confirm()} loading={withdraw.isPending} loadingText="Requesting…" disabled={!q.canWithdraw}>
            Confirm request
          </Button>
          <ButtonLink to={`/wallet/withdraw?amount=${encodeURIComponent(q.amount)}`} variant="secondary">
            Change amount
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}

export function WithdrawalSubmittedPage() {
  const [params] = useSearchParams();
  const id = params.get("tx") ?? "";
  const tx = useWalletTransaction(id);
  const t = tx.data;
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Payout requested</PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">It usually arrives within one business day.</p>
      <IntroCard eyebrow={EYEBROW} title="We'll email you and show an alert when the transfer completes." />
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-line-card bg-surface-card p-5 shadow-card lg:p-8">
        <h2 className="flex items-center gap-2 text-title-md text-ink-strong">
          <IconCheck aria-hidden="true" className="size-6 text-success" /> Your payout is on its way
        </h2>
        {tx.isLoading ? (
          <Loading />
        ) : t ? (
          <div className="mt-5">
            <DetailRows
              rows={[
                ["Reference", t.reference ?? "—"],
                ["Amount", naira(t.grossAmount ?? t.amount)],
                ["Fees", naira(t.fee)],
                ["You receive", naira(t.amount)],
                ["Status", <Status key="s" tone={txStatus(t).tone}>{txStatus(t).label}</Status>],
              ]}
            />
          </div>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 md:flex-row">
          {id && <ButtonLink to={`/wallet/transactions/${id}`}>View payout status</ButtonLink>}
          <ButtonLink to="/wallet" variant="secondary">
            Back to wallet
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}

// ── 06.07 Transactions ────────────────────────────────────────────────────

export function TransactionsPage() {
  return <WithWallet>{(w) => <Transactions w={w} />}</WithWallet>;
}

function Transactions({ w }: { w: Wallet }) {
  const [type, setType] = useUrlState<string>("type", "", ["", "credit", "withdrawal", "commission", "refund"]);
  const [status, setStatus] = useUrlState<string>("status", "", ["", "pending", "completed", "failed"]);
  const [search, setSearch] = useUrlState<string>("q", "");
  const [pageKey, setPageKey] = useUrlState<string>("page", "1");
  const [typed, setTyped] = useState(search);
  const page = Math.max(1, Number(pageKey) || 1);
  const q: Record<string, string> = { page: String(page) };
  if (type) q.type = type;
  if (status) q.status = status;
  if (search) q.search = search;
  const txs = useWalletTransactions(q);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<unknown>(null);

  const onExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const { page: _p, ...filters } = q;
      void _p;
      const { blob, filename } = await downloadTransactionsCsv(filters);
      saveBlob(blob, filename === "download" ? "wallet-transactions.csv" : filename);
    } catch (err) {
      setExportError(err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        actions={
          <Button size="md" onClick={() => void onExport()} loading={exporting} loadingText="Preparing CSV…">
            <IconDownload aria-hidden="true" className="size-4" /> Export CSV
          </Button>
        }
      >
        Wallet transactions
      </PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">Find store payments, fees, refunds and payouts.</p>
      <WalletTabs />
      <IntroCard eyebrow={EYEBROW} title="Download complete transaction records for reconciliation." />
      <ErrorNote error={exportError} fallback="We couldn't prepare the CSV. Please try again." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)]">
        <Panel title="Transaction ledger">
          <div className="flex flex-col gap-3 md:flex-row">
            <form
              role="search"
              className="flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                setSearch(typed.trim());
                setPageKey("1");
              }}
            >
              <label className="flex h-control-lg items-center gap-2 rounded-md bg-surface-pale px-3">
                <IconSearch aria-hidden="true" className="size-icon text-ink-muted" />
                <span className="sr-only">Search reference or description</span>
                <input
                  type="search"
                  value={typed}
                  onChange={(e) => {
                    setTyped(e.target.value);
                    if (!e.target.value) setSearch("");
                  }}
                  placeholder="Search reference or order"
                  className="h-full flex-1 bg-transparent text-input text-ink-strong outline-none placeholder:text-ink-muted"
                />
              </label>
            </form>
            <label className="md:w-48">
              <span className="sr-only">Type</span>
              <SelectInput
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setPageKey("1");
                }}
              >
                <option value="">All types</option>
                <option value="credit">Store sales</option>
                <option value="withdrawal">Payouts</option>
                <option value="commission">Fees</option>
                <option value="refund">Refunds</option>
              </SelectInput>
            </label>
            <label className="md:w-44">
              <span className="sr-only">Status</span>
              <SelectInput
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPageKey("1");
                }}
              >
                <option value="">Any status</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </SelectInput>
            </label>
          </div>
          <div className="mt-4">
            {txs.isLoading ? <Loading /> : txs.error ? <ErrorNote error={txs.error} fallback="We couldn't load your transactions." onRetry={() => void txs.refetch()} /> : <TxList items={txs.data?.transactions ?? []} empty={search || type || status ? "No transactions match." : "No transactions yet."} />}
          </div>
          {txs.data && txs.data.totalPages > 1 && (
            <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3">
              <Button variant="secondary" size="md" disabled={page <= 1} onClick={() => setPageKey(String(page - 1))}>
                Previous
              </Button>
              <span className="text-body-sm text-ink-muted">
                Page {page} of {txs.data.totalPages}
              </span>
              <Button variant="secondary" size="md" disabled={page >= txs.data.totalPages} onClick={() => setPageKey(String(page + 1))}>
                Next
              </Button>
            </nav>
          )}
        </Panel>
        <HelpPanel
          items={[
            ["Total received", walletFigures(w).includeTest ? `${naira(walletFigures(w).totalEarned.value)} (incl. ${naira(walletFigures(w).totalEarned.test)} test)` : naira(w.totalEarned)],
            ["Paid out", naira(w.totalWithdrawn)],
            ["On hold", walletFigures(w).includeTest ? `${naira(walletFigures(w).onHold.value)} (incl. ${naira(walletFigures(w).onHold.test)} test)` : naira(w.pendingBalance)],
            ...(walletFigures(w).testTotal > 0 ? ([["Test money", "Not real, can't be withdrawn, cleared when payments go live"]] as Array<[string, string]>) : []),
          ]}
        />
      </div>
    </div>
  );
}

// ── 06.08 / 06.10 Transaction details ─────────────────────────────────────

export function TransactionDetailPage() {
  const { id = "" } = useParams();
  return <WithWallet>{() => <TransactionDetail id={id} />}</WithWallet>;
}

function TransactionDetail({ id }: { id: string }) {
  const tx = useWalletTransaction(id);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  if (tx.isLoading) return <Loading />;
  if (!tx.data) return <ErrorNote error={tx.error ?? true} fallback="We couldn't find this transaction." onRetry={() => void tx.refetch()} />;
  const t = tx.data;
  const s = txStatus(t);
  const failedPayout = t.type === "withdrawal" && t.status === "failed";

  const receipt = async () => {
    setDownloading(true);
    setError(null);
    try {
      const { blob, filename } = await downloadReceipt(t._id);
      saveBlob(blob, filename === "download" ? "bimanage-receipt.pdf" : filename);
    } catch (err) {
      setError(err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        actions={
          failedPayout ? (
            <ButtonLink to={`/wallet/withdraw?amount=${encodeURIComponent(t.grossAmount ?? t.amount)}`} size="md">
              Retry transfer
            </ButtonLink>
          ) : (
            <Button size="md" variant="secondary" onClick={() => void receipt()} loading={downloading} loadingText="Preparing…">
              <IconDownload aria-hidden="true" className="size-4" /> Download receipt
            </Button>
          )
        }
      >
        {failedPayout ? "Payout could not be completed" : `${TX_TYPE[t.type]} ${t.reference ? `· ${t.reference}` : ""}`}
      </PageTitle>
      <IntroCard eyebrow={EYEBROW} title={failedPayout ? "The money, including fees, is back in your wallet. Check your bank details, then retry." : t.description} />
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-line-card bg-surface-card p-5 shadow-card lg:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-title-md text-ink-strong">{failedPayout ? "Transfer was unsuccessful" : naira(t.amount)}</h2>
          <Status tone={s.tone}>{s.label}</Status>
          {isTestTx(t) && <Status tone="neutral">Test money (not real)</Status>}
        </div>
        <div className="mt-5">
          <DetailRows
            rows={[
              ["Date", shortDate(t.createdAt)],
              ["Type", TX_TYPE[t.type]],
              ...(t.reference ? ([["Reference", t.reference]] as Array<[string, string]>) : []),
              ...(t.order && typeof t.order === "object" ? ([["Order", <Link key="o" to={`/store/orders/${t.order._id}`} className="text-ink-brand hover:underline">{t.order.trackingNo}</Link>]] as Array<[string, ReactNode]>) : []),
              ...(t.grossAmount ? ([["Amount", naira(t.grossAmount)], ["Fees", naira(t.fee)], ["Net payout", naira(t.amount)]] as Array<[string, string]>) : ([["Amount", naira(t.amount)]] as Array<[string, string]>)),
              ...(t.bank && t.type === "withdrawal" ? ([["Bank", `${t.bank.bankName} •••• ${t.bank.last4}`]] as Array<[string, string]>) : []),
              ...(t.failureReason ? ([["Reason", t.failureReason]] as Array<[string, string]>) : []),
              ...(t.completedAt ? ([["Completed", shortDate(t.completedAt)]] as Array<[string, string]>) : []),
            ]}
          />
        </div>
        {failedPayout && (
          <div className="mt-5 rounded-xl bg-surface-tint-blue px-4 py-3">
            <p className="text-caption font-semibold uppercase text-ink-brand">Safe retry</p>
            <p className="mt-1 text-body-sm text-ink-strong">This payout was not completed and nothing left your wallet. Retrying starts a new transfer.</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <ButtonLink to="/wallet/bank" size="md" variant="secondary">
                Edit bank details
              </ButtonLink>
              <Link to="/support" className="inline-flex min-h-11 items-center text-action font-semibold text-ink-brand hover:underline">
                Contact support
              </Link>
            </div>
          </div>
        )}
        <ErrorNote error={error} fallback="We couldn't prepare the receipt." className="mt-4" />
      </section>
    </div>
  );
}
