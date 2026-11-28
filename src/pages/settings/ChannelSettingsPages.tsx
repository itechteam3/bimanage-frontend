import { useState, type ReactNode } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { IconArchive, IconBuildingStore, IconCircleCheck, IconLock, IconRefresh, IconShieldCheck, IconTruckDelivery, IconUsersGroup } from "@tabler/icons-react";
import { Button, ButtonLink, Spinner, Status } from "@/components/ui";
import { AuthNote } from "@/components/layout/AuthLayout";
import { FlowActions, FlowCard, FlowColumns, FlowFootnote, FlowHero, FlowPage, FlowRules, FlowTile, FlowTiles } from "@/components/page/FlowLayout";
import { errorMessage } from "@/lib/api/errorMessage";
import { count } from "@/lib/format";
import {
  CHANNEL_LABEL,
  STATUS_LABEL,
  useDeactivationCheck,
  useSellingChannels,
  useSwitchChannel,
  type ChannelAction,
  type ChannelId,
  type ChannelStatus,
  type SellingChannels,
} from "@/lib/workspace/channels";

// Settings → Selling channels (Figma 4370:2242 "Business selling channels",
// 4370:2563 "Activate or expand a channel", 4372:2594 "Activation complete",
// 4370:2884 "Review channel deactivation", 4372:2915 "Deactivation blocked",
// 4372:3236 "Confirm safe deactivation", 4370:3205 "Reactivate a selling
// channel", 4372:3821 "Reactivation complete"). Self-serve for the owner;
// team members see the channels but can't change them (backend #116).

const BASE = "/settings/channels";
const FOOT_TITLE = "Channel availability only changes after all safeguards pass.";
const FOOT_BODY = "Existing business records remain preserved. Switching never creates a second BiManage account or duplicates products, customers or history.";
const ico = "size-4";
const isChannel = (v: string | undefined): v is ChannelId => v === "retail" || v === "wholesale";
const other = (c: ChannelId): ChannelId => (c === "retail" ? "wholesale" : "retail");
const SELLS: Record<ChannelId, string> = { retail: "Sell directly to customers", wholesale: "Sell to trade buyers" };
const tone = (s: ChannelStatus) => (s === "active" ? "success" : s === "paused" ? "warning" : "neutral");

function Loading() {
  return (
    <div className="flex justify-center py-16 text-ink-brand" role="status">
      <Spinner className="size-8" />
      <span className="sr-only">Loading your selling channels…</span>
    </div>
  );
}

function modeLabel(c: SellingChannels) {
  return c.mode === "both" ? "Retail + Wholesale" : c.mode === "retail" ? "Retail only" : c.mode === "wholesale" ? "Wholesale only" : "No channel on";
}

/** The four summary tiles every channel screen shows. */
function ChannelTiles({ c }: { c: SellingChannels }) {
  return (
    <FlowTiles>
      <FlowTile tone="teal" label="Business channels" value="1 account" caption="One business profile" icon={<IconUsersGroup className={ico} />} />
      <FlowTile tone="violet" label="Shared records" value="Preserved" caption={modeLabel(c)} icon={<IconArchive className={ico} />} />
      <FlowTile tone="blue" label="Retail" value={STATUS_LABEL[c.retail.status] === "Available to activate" ? "Not on" : STATUS_LABEL[c.retail.status]} caption="Independent activation" icon={<IconBuildingStore className={ico} />} />
      <FlowTile tone="gold" label="Wholesale" value={STATUS_LABEL[c.wholesale.status] === "Available to activate" ? "Not on" : STATUS_LABEL[c.wholesale.status]} caption="Independent activation" icon={<IconTruckDelivery className={ico} />} />
    </FlowTiles>
  );
}

/** A channel row: label, a field-style status box with the right action. */
function ChannelRow({ id, c, isOwner }: { id: ChannelId; c: SellingChannels; isOwner: boolean }) {
  const st = c[id].status;
  const action = st === "active" ? { to: `${BASE}/${id}/deactivate`, label: `Turn off ${CHANNEL_LABEL[id]}` } : { to: `${BASE}/${id}/activate`, label: st === "paused" ? `Reactivate ${CHANNEL_LABEL[id]}` : `Activate ${CHANNEL_LABEL[id]}` };
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-medium leading-4 text-ink-strong">{CHANNEL_LABEL[id]} channel</span>
      <div className="flex flex-col gap-3 rounded-sm border border-line-card px-[11px] py-[10px] md:flex-row md:items-center md:justify-between">
        <span className="flex flex-wrap items-center gap-2 text-caption text-ink-strong">
          <Status tone={tone(st)}>{STATUS_LABEL[st]}</Status>
          {SELLS[id]}
        </span>
        {isOwner && (
          <ButtonLink to={action.to} size="md" variant={st === "active" ? "outlined" : "primary"}>
            {action.label}
          </ButtonLink>
        )}
      </div>
    </div>
  );
}

function SideStatus({ c, note }: { c: SellingChannels; note?: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-line-card bg-surface-card p-[17px]">
      {(["retail", "wholesale"] as const).map((id, i) => (
        <div key={id} className={i ? "border-t border-line-card pt-4" : ""}>
          <p className="text-[15px] font-semibold leading-[22px] text-ink-strong">{CHANNEL_LABEL[id]} channel</p>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] font-medium leading-5 text-accent-blue">
            {SELLS[id]} <Status tone={tone(c[id].status)}>{STATUS_LABEL[c[id].status]}</Status>
          </p>
        </div>
      ))}
      {note && <p className="text-caption font-medium text-ink-strong">{note}</p>}
      <p className="text-[11px] leading-4 text-ink-muted">One account · One profile · Shared records</p>
    </section>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────

export function ChannelSettingsPage() {
  const q = useSellingChannels();
  if (q.isLoading) return <Loading />;
  if (!q.data) return <AuthNote tone="danger">{errorMessage(q.error, "We couldn't load your selling channels. Check your connection and try again.")}</AuthNote>;
  const { channels: c, isOwner } = q.data;
  return (
    <FlowPage title="Business selling channels" lead="One BiManage account. Choose Retail, Wholesale or Both, and change your setup whenever your business needs to.">
      <FlowHero title="One account. Flexible selling." eyebrow="One business profile  ·  Two channels  ·  Records preserved" icon={<IconShieldCheck className="size-6" />}>
        Choose Retail, Wholesale or Both. Activate either channel now or add the other later, all within one business profile.
      </FlowHero>
      <ChannelTiles c={c} />
      <FlowColumns
        main={
          <FlowCard title="Your selling channels" subtitle="Activate or turn off each channel independently. Your account and business records remain shared.">
            <ChannelRow id="retail" c={c} isOwner={isOwner} />
            <ChannelRow id="wholesale" c={c} isOwner={isOwner} />
            {!isOwner && (
              <p className="flex items-center gap-2 text-caption text-ink-muted">
                <IconLock aria-hidden="true" className={ico} /> Only the business owner can change selling channels.
              </p>
            )}
          </FlowCard>
        }
        side={
          <>
            <FlowRules
              title="Channel management"
              rules={[
                { title: "One BiManage account", body: "No separate retailer or wholesaler profile." },
                { title: "Records stay together", body: "Products, stock, customers and history are preserved." },
                { title: "Independent controls", body: "Retail and Wholesale can be managed separately." },
              ]}
            />
            <SideStatus c={c} />
          </>
        }
      />
      <FlowActions>
        <ButtonLink to="/settings" variant="outlined">
          Back to business settings
        </ButtonLink>
      </FlowActions>
      <FlowFootnote title="A business can sell Retail, Wholesale or Both. Switching never creates a second BiManage account.">{FOOT_BODY}</FlowFootnote>
    </FlowPage>
  );
}

// ── Activate or reactivate ───────────────────────────────────────────────

export function ChannelActivatePage() {
  const { channel } = useParams();
  const navigate = useNavigate();
  const q = useSellingChannels();
  const sw = useSwitchChannel();
  const [error, setError] = useState<string | null>(null);
  if (!isChannel(channel)) return <Navigate to={BASE} replace />;
  if (q.isLoading) return <Loading />;
  if (!q.data) return <AuthNote tone="danger">{errorMessage(q.error, "We couldn't load your selling channels. Check your connection and try again.")}</AuthNote>;
  const { channels: c, isOwner } = q.data;
  if (!isOwner || c[channel].status === "active") return <Navigate to={BASE} replace />;
  const re = c[channel].status === "paused";
  const action: ChannelAction = re ? "reactivate" : "activate";
  const label = CHANNEL_LABEL[channel];
  const go = async () => {
    setError(null);
    try {
      const r = await sw.mutateAsync({ channel, action });
      navigate(`${BASE}/done`, { replace: true, state: { action, channel, message: r.message } });
    } catch (err) {
      setError(errorMessage(err, "We couldn't change your selling channels. Check your connection and try again."));
    }
  };
  const rules = re
    ? [
        { title: "Product and inventory records", body: "Use the existing catalogue and shared stock ledger." },
        { title: "Channel-specific pricing", body: `Restore ${channel === "wholesale" ? "wholesale prices, MOQ and tiers" : "retail prices and storefront settings"}.` },
        { title: "Business history", body: "Keep customers, orders, invoices and transactions." },
      ]
    : [
        { title: "Your business profile", body: "Same BiManage account and business identity." },
        { title: "Your existing records", body: "Products, stock, customers, orders and invoices stay." },
        { title: "Your stock ledger", body: "The same available stock is shared across channels." },
      ];
  return (
    <FlowPage
      title={re ? "Reactivate a selling channel" : "Activate or expand a channel"}
      lead={re ? "Restore a previously turned-off channel without rebuilding your business or losing its history." : "Add Retail or Wholesale at any time. You do not need another account or a new business profile."}
    >
      <FlowHero
        title={re ? "Restore without starting over." : "Add a channel. Keep your business."}
        eyebrow={re ? "Reactivation  ·  Existing records restored" : "Two-way activation  ·  No account duplication"}
        icon={re ? <IconRefresh className="size-6" /> : <IconCircleCheck className="size-6" />}
      >
        {re ? "Your saved products, channel pricing, minimum quantities, customers and transaction history remain available." : `${CHANNEL_LABEL[other(channel)]} can expand to Both, and you can also run ${label} on its own.`}
      </FlowHero>
      <ChannelTiles c={c} />
      <FlowColumns
        main={
          <FlowCard title={re ? `Reactivate ${label}` : `Activate ${label}`} subtitle={re ? "Review pricing and selling rules before you start taking orders again." : "Existing products and business records remain in place."}>
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-medium leading-4 text-ink-strong">{label} channel</span>
              <div className="rounded-sm border border-accent-navy bg-surface-tint-blue px-[11px] py-[10px] text-caption text-ink-strong">
                {re ? "Saved setup available · " : ""}
                {channel === "wholesale" ? "Turn on trade and bulk sales: wholesale pricing, MOQ and bulk tiers" : "Turn on direct-to-customer sales: retail pricing and storefront visibility"}
              </div>
            </div>
            {error && <AuthNote tone="danger">{error}</AuthNote>}
          </FlowCard>
        }
        side={
          <>
            <FlowRules title={re ? "What is restored" : "What stays unchanged"} rules={rules} />
            <SideStatus c={c} />
          </>
        }
      />
      <FlowActions>
        <Button onClick={() => void go()} loading={sw.isPending} loadingText="Saving…" className="md:min-w-[330px]">
          {re ? `Reactivate ${label}` : `Activate ${label}`}
        </Button>
        <ButtonLink to={BASE} variant="outlined">
          Not now
        </ButtonLink>
      </FlowActions>
      <FlowFootnote title={re ? "Reactivation restores the channel configuration. It does not create a new account or duplicate business data." : "Retail to Both and Wholesale to Both are both supported. No account migration or duplicate profile."}>
        {FOOT_TITLE} {FOOT_BODY}
      </FlowFootnote>
    </FlowPage>
  );
}

// ── Turn off: review → blocked or confirm ───────────────────────────────

export function ChannelDeactivatePage() {
  const { channel } = useParams();
  const navigate = useNavigate();
  const q = useSellingChannels();
  const check = useDeactivationCheck(isChannel(channel) ? channel : undefined);
  const sw = useSwitchChannel();
  const [error, setError] = useState<string | null>(null);
  if (!isChannel(channel)) return <Navigate to={BASE} replace />;
  if (q.isLoading || check.isLoading) return <Loading />;
  if (!q.data || !check.data) return <AuthNote tone="danger">{errorMessage(q.error ?? check.error, "We couldn't check this channel. Check your connection and try again.")}</AuthNote>;
  const { channels: c, isOwner } = q.data;
  if (!isOwner || c[channel].status !== "active") return <Navigate to={BASE} replace />;
  const label = CHANNEL_LABEL[channel];
  const b = check.data.blockers;
  const blocked = b.activeOrders + b.unsettledPayments + b.openDisputes > 0;
  const last = check.data.lastChannel;

  const go = async () => {
    setError(null);
    try {
      const r = await sw.mutateAsync({ channel, action: "deactivate" });
      navigate(`${BASE}/done`, { replace: true, state: { action: "deactivate", channel, message: r.message } });
    } catch (err) {
      setError(errorMessage(err, "We couldn't turn this channel off. Check your connection and try again."));
      void check.refetch();
    }
  };

  if (blocked || last) {
    const items = [
      b.activeOrders ? { title: "Active orders", body: `${count(b.activeOrders)} open order${b.activeOrders === 1 ? "" : "s"} still need${b.activeOrders === 1 ? "s" : ""} to be completed or cancelled.` } : null,
      b.unsettledPayments ? { title: "Unsettled payments", body: `${count(b.unsettledPayments)} payment${b.unsettledPayments === 1 ? " is" : "s are"} still awaiting settlement.` } : null,
      b.openDisputes ? { title: "Open disputes", body: `${count(b.openDisputes)} dispute${b.openDisputes === 1 ? " needs" : "s need"} a final resolution.` } : null,
      last ? { title: "Your only channel", body: `Keep at least one selling channel on. Activate ${CHANNEL_LABEL[other(channel)]} first if you want to stop ${label}.` } : null,
    ].filter(Boolean) as Array<{ title: string; body: string }>;
    return (
      <FlowPage title="Channel deactivation is blocked" lead={`Outstanding activity must be resolved before ${label} can be turned off.`}>
        <FlowHero title="Keep this channel active for now." eyebrow="Action required  ·  Deactivation blocked" icon={<IconLock className="size-6" />}>
          BiManage has found activity that could be interrupted by turning it off. Your channel remains active until everything is resolved.
        </FlowHero>
        <ChannelTiles c={c} />
        <FlowColumns
          main={
            <FlowCard title="Outstanding activity" subtitle="Resolve every blocking item before trying to turn this channel off again.">
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-medium leading-4 text-ink-strong">Selected channel</span>
                <div className="flex flex-wrap items-center gap-2 rounded-sm border border-line-card px-[11px] py-[10px] text-caption text-ink-strong">
                  <Status tone="warning">Deactivation blocked</Status> {label} remains active
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-medium leading-4 text-ink-strong">Protection status</span>
                <div className="rounded-sm border border-line-card px-[11px] py-[10px] text-caption text-ink-strong">No changes applied. Orders, payments and records are protected.</div>
              </div>
            </FlowCard>
          }
          side={
            <>
              <FlowRules title="Items that must be resolved" rules={items} />
              <SideStatus c={c} />
            </>
          }
        />
        <FlowActions>
          <ButtonLink to={channel === "retail" ? "/orders" : "/store/orders"} className="md:min-w-[330px]">
            View outstanding activity
          </ButtonLink>
          <ButtonLink to={BASE} variant="outlined">
            Keep channel active
          </ButtonLink>
        </FlowActions>
        <FlowFootnote title="Turning a channel off is blocked while active orders, unsettled payments or open disputes remain.">{FOOT_TITLE}</FlowFootnote>
      </FlowPage>
    );
  }

  return (
    <FlowPage title={`Confirm ${channel} deactivation`} lead="No blocking activity was found. Review the impact before turning off this selling channel.">
      <FlowHero title={`${label} is clear to turn off.`} eyebrow="Safe to proceed  ·  Final confirmation" icon={<IconShieldCheck className="size-6" />}>
        No active orders, unsettled payments or open disputes are blocking this change.
      </FlowHero>
      <ChannelTiles c={c} />
      <FlowColumns
        main={
          <FlowCard title="Final check" subtitle={`Only the ${label} selling channel will be turned off. Your BiManage account and business records will remain.`}>
            {(["retail", "wholesale"] as const).map((id) => (
              <div key={id} className="flex flex-col gap-2">
                <span className="text-[11px] font-medium leading-4 text-ink-strong">{CHANNEL_LABEL[id]} channel</span>
                <div className="flex flex-wrap items-center gap-2 rounded-sm border border-line-card px-[11px] py-[10px] text-caption text-ink-strong">
                  {id === channel ? <Status tone="warning">Ready to turn off</Status> : <Status tone="success">Remains active</Status>}
                  {id === channel ? "Only this selling channel will be turned off" : `No change to ${id} selling`}
                </div>
              </div>
            ))}
            {error && <AuthNote tone="danger">{error}</AuthNote>}
          </FlowCard>
        }
        side={
          <>
            <FlowRules
              title="What happens next"
              rules={[
                { title: `${label} selling stops`, body: `New ${channel} orders will be turned off.` },
                { title: `${CHANNEL_LABEL[other(channel)]} stays active`, body: `Your ${other(channel)} channel continues as normal.` },
                { title: "Records remain available", body: "Products, stock, customers, invoices and history are preserved." },
              ]}
            />
            <SideStatus c={c} note="No blocking activity" />
          </>
        }
      />
      <FlowActions>
        <Button variant="destructive" onClick={() => void go()} loading={sw.isPending} loadingText="Turning off…" className="md:min-w-[330px]">
          Turn off {label}
        </Button>
        <ButtonLink to={BASE} variant="outlined">
          Cancel and keep active
        </ButtonLink>
      </FlowActions>
      <FlowFootnote title="Turning a channel off changes channel availability only. It never deletes the business profile or historical records.">{FOOT_TITLE}</FlowFootnote>
    </FlowPage>
  );
}

// ── Result ───────────────────────────────────────────────────────────────

export function ChannelDonePage() {
  const state = useLocation().state as { action?: ChannelAction; channel?: ChannelId; message?: string } | null;
  const q = useSellingChannels();
  if (!state?.action || !state.channel) return <Navigate to={BASE} replace />;
  if (q.isLoading) return <Loading />;
  const c = q.data?.channels;
  const label = CHANNEL_LABEL[state.channel];
  const titles: Record<ChannelAction, string> = {
    activate: c?.mode === "both" ? "Retail + Wholesale activated" : `${label} activated`,
    reactivate: `${label} channel reactivated`,
    deactivate: `${label} channel turned off`,
  };
  const heroes: Record<ChannelAction, [string, string]> = {
    activate: ["Your business is ready to sell.", "Your selling channels use your existing account, product catalogue and shared inventory records."],
    reactivate: [`You're ready to sell ${state.channel} again.`, state.channel === "wholesale" ? "Your saved trade pricing, minimum quantities, bulk tiers and business history are available again." : "Your saved retail prices and business history are available again."],
    deactivate: ["Your records are safe.", "Products, stock, customers, invoices and history stay. You can reactivate the channel any time."],
  };
  const next =
    state.action === "deactivate"
      ? { to: BASE, label: "Go to channel settings" }
      : state.channel === "wholesale"
        ? { to: "/inventory/products", label: state.action === "reactivate" ? "Review wholesale listings" : "Set wholesale prices" }
        : { to: "/inventory/products", label: "View inventory" };
  return (
    <FlowPage title={titles[state.action]} lead={state.message}>
      <FlowHero title={heroes[state.action][0]} eyebrow={state.action === "deactivate" ? "Channel turned off  ·  Records preserved" : "Channel status updated  ·  One business profile"} icon={<IconCircleCheck className="size-6" />}>
        {heroes[state.action][1]}
      </FlowHero>
      {c && <ChannelTiles c={c} />}
      {c && (
        <FlowColumns
          main={
            <FlowCard title="Channel status updated" subtitle="Your business profile and existing records were not duplicated or reset.">
              <ChannelRow id="retail" c={c} isOwner={false} />
              <ChannelRow id="wholesale" c={c} isOwner={false} />
            </FlowCard>
          }
          side={
            <FlowRules
              title="What remains connected"
              rules={[
                { title: "One business profile", body: "Your original BiManage account remains unchanged." },
                { title: "Shared product and stock records", body: "Every channel draws from the same available inventory." },
                { title: "Separate selling rules", body: "Retail and wholesale prices, MOQ and bulk tiers remain independent." },
              ]}
            />
          }
        />
      )}
      <FlowActions>
        <ButtonLink to={next.to} className="md:min-w-[330px]">
          {next.label}
        </ButtonLink>
        {next.to !== BASE && (
          <ButtonLink to={BASE} variant="outlined">
            Back to channel settings
          </ButtonLink>
        )}
      </FlowActions>
      <FlowFootnote title="Changing channels never creates another account or duplicates products, customers or transaction history.">{FOOT_TITLE}</FlowFootnote>
    </FlowPage>
  );
}
