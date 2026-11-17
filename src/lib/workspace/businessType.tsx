import { useState, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { IconBuildingWarehouse, IconShoppingCart } from "@tabler/icons-react";
import { api } from "@/lib/api/client";
import { Button, ButtonLink, EmptyState, Field, Spinner, Status, TextArea } from "@/components/ui";
import { Panel } from "@/components/page/Blocks";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useSubscription } from "./subscription";

// Retailer or wholesaler (BiSupplyNet rule, backend utils/businessType.js):
// retailers BUY on BiSupplyNet (to resell in their own online store),
// wholesalers only SELL. Every business starts as a retailer and becomes a
// wholesaler only when BiTechTeam approves its supplier application. The
// server enforces all of this; these helpers only adapt the pages.

export type BusinessType = "retailer" | "wholesaler";
export interface BusinessTypeRequest {
  to: BusinessType | null;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | null;
  requestedAt: string | null;
  decidedAt: string | null;
  note: string | null;
}

export function useBusinessType() {
  const sub = useSubscription();
  const type: BusinessType = sub.data?.businessType === "wholesaler" ? "wholesaler" : "retailer";
  return {
    type,
    isWholesaler: type === "wholesaler",
    isRetailer: type === "retailer",
    request: sub.data?.businessTypeRequest ?? null,
    /** Wholesalers may run a retail store (server setting; off by default). */
    retailStoreAllowed: type === "retailer" || Boolean(sub.data?.wholesalerRetailStore),
    loading: sub.isLoading,
  };
}

const Loading = () => (
  <div className="flex justify-center py-16 text-ink-brand" role="status">
    <Spinner className="size-8" />
    <span className="sr-only">Loading…</span>
  </div>
);

/** Online store pages (not its existing orders): retailers, or wholesalers when allowed. */
export function RetailStoreGate({ children }: { children: ReactNode }) {
  const { retailStoreAllowed, loading } = useBusinessType();
  if (loading) return <Loading />;
  if (retailStoreAllowed) return <>{children}</>;
  return (
    <EmptyState
      icon={<IconBuildingWarehouse className="size-7" aria-hidden="true" />}
      title="Wholesalers sell on BiSupplyNet"
      body="Wholesaler accounts don't run a retail online store. Your existing store orders are still under Store orders. If your business needs a store, ask BiTechTeam to switch you to a retailer in Settings."
      action={
        <div className="flex flex-wrap justify-center gap-3">
          <ButtonLink to="/bisupplynet/sell" size="md">Go to BiSupplyNet</ButtonLink>
          <ButtonLink to="/store/orders" variant="secondary" size="md">Store orders</ButtonLink>
        </div>
      }
    />
  );
}

/** New listings and buyer connections: approved wholesalers only (others go to Sell home). */
export function WholesalerGate({ children }: { children: ReactNode }) {
  const { isWholesaler, loading } = useBusinessType();
  if (loading) return <Loading />;
  return isWholesaler ? <>{children}</> : <Navigate to="/bisupplynet/sell" replace />;
}

/** Settings: the business type, and (for wholesalers) asking to switch back. */
export function BusinessTypeCard() {
  const { type, request, loading } = useBusinessType();
  const { workspace } = useAuth();
  const isOwner = !workspace || workspace.role === "owner";
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const ask = useMutation({
    mutationFn: () => api<{ message: string }>("/business-type/request", { method: "POST", body: { to: "retailer", reason: reason.trim() } }),
    onSuccess: () => {
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["subscription", "current"] });
    },
  });
  if (loading) return null;
  const pending = request?.status === "pending";
  return (
    <Panel title="Business type" subtitle="Retailers buy in bulk on BiSupplyNet and resell in their own online store. Wholesalers sell on BiSupplyNet.">
      <div className="flex flex-wrap items-center gap-3">
        {type === "wholesaler" ? <IconBuildingWarehouse aria-hidden="true" className="size-6 text-ink-brand" /> : <IconShoppingCart aria-hidden="true" className="size-6 text-ink-brand" />}
        <p className="text-body-lg font-semibold text-ink-strong">{type === "wholesaler" ? "Wholesaler" : "Retailer"}</p>
        {pending && <Status tone="warning">Change to {request?.to} waiting for BiTechTeam</Status>}
        {request?.status === "rejected" && <Status tone="neutral">Last request not approved{request.note ? `: ${request.note}` : ""}</Status>}
      </div>
      {type === "retailer" ? (
        <p className="mt-3 text-body-sm text-ink-muted">
          To sell on BiSupplyNet, <Link to="/bisupplynet/sell/apply" className="font-semibold text-ink-brand underline underline-offset-2">apply as a wholesaler</Link>. BiTechTeam reviews your business; wholesalers can't buy on BiSupplyNet.
        </p>
      ) : (
        <p className="mt-3 text-body-sm text-ink-muted">Wholesalers can't buy on BiSupplyNet or run a retail online store. Orders already placed always finish.</p>
      )}
      {type === "wholesaler" && isOwner && !pending && (
        <div className="mt-4">
          {!open ? (
            <Button variant="secondary" size="md" onClick={() => setOpen(true)}>Ask to switch to retailer</Button>
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                ask.mutate();
              }}
            >
              <Field label="Why do you want to switch?" hint="BiTechTeam reads this before deciding (at least 10 characters).">
                <TextArea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} required minLength={10} />
              </Field>
              <ErrorNote error={ask.error} fallback="We couldn't send your request. Please try again." />
              <div className="flex flex-wrap gap-3">
                <Button type="submit" size="md" loading={ask.isPending} loadingText="Sending…" disabled={reason.trim().length < 10}>Send request</Button>
                <Button type="button" variant="secondary" size="md" onClick={() => setOpen(false)}>Cancel</Button>
              </div>
            </form>
          )}
        </div>
      )}
      {ask.isSuccess && <p role="status" className="mt-3 text-body-sm text-success">Request sent. BiTechTeam will review it and let you know.</p>}
    </Panel>
  );
}
