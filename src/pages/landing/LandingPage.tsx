import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  IconBarcode,
  IconBuildingBank,
  IconBuildingStore,
  IconCalendarCheck,
  IconPackage,
  IconShoppingBag,
  IconChevronDown,
  IconChartBar,
  IconCheck,
  IconCreditCard,
  IconDevices,
  IconKey,
  IconLayoutKanban,
  IconLock,
  IconReceipt,
  IconShieldCheck,
  IconSparkles,
  IconTrendingUp,
  IconUserPlus,
  IconStarFilled,
  IconTruckDelivery,
  IconUsers,
  IconUsersGroup,
  IconWallet,
} from "@tabler/icons-react";
import { ButtonLink } from "@/components/ui/Button";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { cn } from "@/lib/cn";
import { naira } from "@/lib/format";
import { FEATURE_LABELS } from "@/lib/subscription/api";
import { usePublicReviews } from "@/lib/reviews/api";
import { usePublicPlans, usePublicStats } from "@/lib/landing/api";
import { AuthCtas, Container, PublicLayout, reducedMotion } from "./PublicLayout";
import { FaqAccordion } from "./FaqAccordion";
import { FEATURED_FAQS } from "./faq";
import { Avatar } from "@/components/ui/Avatar";
import { FeliAvatar } from "@/components/feli/FeliAvatar";
import { IPHONE, IPHONE_APP_HEIGHT, IPhoneFrame, type PhoneChrome } from "./IPhoneFrame";

import heroImg from "@/assets/landing/hero.webp";
import heroSmImg from "@/assets/landing/hero-sm.webp";

// Product screenshots: the REAL app with the invented "Adunni Fashion House"
// sample data (scripts/marketing). Desktop: 2x WebP; phone: 3x WebP at the
// iPhone 18 Pro Max viewport (below its status bar); 1x PNG fallbacks.
const shots = import.meta.glob<string>("../../assets/landing/screens/*.{webp,png}", { eager: true, import: "default", query: "?url" });
const shot = (name: string, kind: "desktop" | "phone") => ({
  webp: shots[`../../assets/landing/screens/${name}-${kind}.webp`] ?? "",
  png: shots[`../../assets/landing/screens/${name}-${kind}.png`] ?? "",
});
// Per phone screen: status bar colour and glyph tone, measured at capture time.
const phoneChrome = (Object.values(import.meta.glob<Record<string, PhoneChrome>>("../../assets/landing/screens/phone-chrome.json", { eager: true, import: "default" }))[0] ?? {});
const collage = Object.entries(import.meta.glob<string>("../../assets/landing/collage-*.webp", { eager: true, import: "default", query: "?url" }))
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([, url]) => url);

// ── Motion helpers ────────────────────────────────────────────────────────

/**
 * Adds .lp-in to [data-reveal] elements as they scroll into view — including
 * elements added later (pricing, FAQ and reviews arrive from the API), so
 * nothing can stay hidden.
 */
function useReveal(root: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const all = () => [...el.querySelectorAll<HTMLElement>("[data-reveal]:not(.lp-in)")];
    if (typeof IntersectionObserver === "undefined" || typeof MutationObserver === "undefined" || reducedMotion()) {
      el.classList.add("lp-js");
      const show = () => all().forEach((i) => i.classList.add("lp-in"));
      show();
      if (typeof MutationObserver === "undefined") return;
      const mo = new MutationObserver(show);
      mo.observe(el, { childList: true, subtree: true });
      return () => mo.disconnect();
    }
    el.classList.add("lp-js");
    const seen = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("lp-in"); io.unobserve(e.target); } }),
      { rootMargin: "0px 0px -5% 0px", threshold: 0.05 }
    );
    const watch = () => all().forEach((i) => { if (!seen.has(i)) { seen.add(i); io.observe(i); } });
    watch();
    const mo = new MutationObserver(watch);
    mo.observe(el, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, [root]);
}

/** Counts up to a REAL number once visible (instant for reduced motion). */
function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion() || typeof IntersectionObserver === "undefined") { setN(to); return; }
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / 1200);
        setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to]);
  return <span ref={ref} className="tabular-nums">{n.toLocaleString("en-NG")}{suffix}</span>;
}

// ── Frames ────────────────────────────────────────────────────────────────

function Shot({ name, kind, alt, eager }: { name: string; kind: "desktop" | "phone"; alt: string; eager?: boolean }) {
  const s = shot(name, kind);
  const [w, h] = kind === "desktop" ? [1280, 800] : [IPHONE.width, IPHONE_APP_HEIGHT];
  return (
    <picture>
      <source type="image/webp" srcSet={s.webp} />
      <img src={s.png} alt={alt} width={w} height={h} loading={eager ? "eager" : "lazy"} decoding="async" fetchPriority={eager ? "high" : undefined} className="block h-auto w-full" />
    </picture>
  );
}

function BrowserFrame({ name, alt, path, eager, className }: { name: string; alt: string; path: string; eager?: boolean; className?: string }) {
  return (
    <figure className={cn("relative overflow-hidden rounded-xl border border-line-card bg-surface-card shadow-floating", className)}>
      <div className="flex items-center gap-2 border-b border-line-subtle bg-surface-pale px-3 py-2" aria-hidden="true">
        <span className="size-2.5 rounded-full bg-danger/70" />
        <span className="size-2.5 rounded-full bg-warning/70" />
        <span className="size-2.5 rounded-full bg-success/70" />
        <span className="ml-2 min-w-0 truncate rounded-sm bg-surface-card px-2 py-0.5 text-micro text-ink-muted">bimanage.com{path}</span>
      </div>
      <div className="relative">
        <Shot name={name} kind="desktop" alt={alt} eager={eager} />
      </div>
    </figure>
  );
}

function PhoneFrame({ name, alt, eager, className }: { name: string; alt: string; eager?: boolean; className?: string }) {
  return (
    <IPhoneFrame chrome={phoneChrome[name]} className={cn("max-w-[18rem]", className)}>
      <Shot name={name} kind="phone" alt={alt} eager={eager} />
    </IPhoneFrame>
  );
}

// ── Content (true claims only: what BiManage does today) ─────────────────

const FEATURES = [
  { key: "inventory", icon: IconBarcode, title: "Inventory and barcode", body: "Track stock across products, scan or type barcodes, get low-stock alerts and keep a full adjustment history.", path: "/inventory" },
  { key: "orders", icon: IconReceipt, title: "Sales, orders and invoices", body: "Record sales, follow payment and fulfilment, and send branded invoices as PDF or email.", path: "/orders", extra: "invoice" },
  { key: "store", icon: IconBuildingStore, title: "Online store with checkout", body: "Your own storefront with guest checkout, live order updates and order tracking for your shoppers.", path: "/s/adunnifashion", phone: "checkout" },
  { key: "wallet", icon: IconWallet, title: "Wallet and payouts", body: "See earnings, money on hold and payouts to your bank account, with every transaction recorded.", path: "/wallet" },
  { key: "customers", icon: IconUsers, title: "Customers", body: "Customer records built automatically from orders, store sales and invoices, with history, notes and tags.", path: "/customers" },
  { key: "projects", icon: IconLayoutKanban, title: "Projects and team", body: "Plan work on boards, assign tasks with due dates, and invite your team with roles and permissions.", path: "/projects/p1" },
  { key: "feli", icon: IconSparkles, title: "FELI, your AI assistant", body: "Ask about your business, get answers and suggested actions. Nothing changes until you approve it.", path: "/feli" },
  { key: "bisupplynet", icon: IconTruckDelivery, title: "BiSupplyNet wholesale", body: "Find verified wholesalers and buy in bulk, with your payment held in escrow until delivery is confirmed.", path: "/bisupplynet/suppliers" },
  { key: "reports", icon: IconChartBar, title: "Reports", body: "Revenue, stock and invoice collections over any period, with spreadsheet exports.", path: "/reports" },
] as const;

const STEPS = [
  { icon: IconUserPlus, title: "Sign up", body: "Create your account and verify your email. It takes minutes." },
  { icon: IconBuildingStore, title: "Set up your business", body: "Add your business details and products, and open your online store if you sell online." },
  { icon: IconTrendingUp, title: "Sell, manage and grow", body: "Record sales, take payments, track stock and customers, and see how you're doing." },
];

const WHY = [
  { title: "All-in-one platform", body: "Sales, inventory, invoices, your online store, customers, projects and wholesale buying in one place. No more switching between apps and spreadsheets." },
  { title: "Works on your phone", body: "Every screen works on phones, tablets and laptops, so you can check sales, update orders and reply to customers wherever you are." },
  { title: "For solo founders and teams", body: "Start on your own and invite your team when you're ready, with roles and permissions that control what each person can see and do." },
];

const TRUST = [
  { icon: IconCreditCard, title: "Payments through Paystack", body: "Online payments are processed by Paystack, and every payment is verified on our server before an order is marked paid." },
  { icon: IconShieldCheck, title: "Escrow on BiSupplyNet", body: "Wholesale payments are held until the buyer confirms delivery, with a dispute process if something goes wrong." },
  { icon: IconUsersGroup, title: "Roles and permissions", body: "Give each team member only the access they need, from owner and admin to manager and staff." },
  { icon: IconLock, title: "Your data stays yours", body: "Each business sees only its own data. Every request is checked against your business on the server." },
  { icon: IconKey, title: "Stronger passwords", body: "Common and breached passwords are blocked, and you can't reuse your recent passwords." },
  { icon: IconDevices, title: "Session control", body: "Sign out of all other devices from your security settings, and get an email whenever your password changes." },
];

// ── Sections ──────────────────────────────────────────────────────────────

function SectionTitle({ eyebrow, title, subtitle, light }: { eyebrow?: string; title: string; subtitle?: string; light?: boolean }) {
  return (
    <div className="mx-auto max-w-[44rem] text-center" data-reveal>
      {eyebrow && <p className={cn("text-caption font-semibold uppercase tracking-wide", light ? "text-ink-on-brand-accent" : "text-ink-brand")}>{eyebrow}</p>}
      <h2 className={cn("mt-2 text-title-lg md:text-page-title", light ? "text-ink-on-brand" : "text-ink-strong")}>{title}</h2>
      {subtitle && <p className={cn("mt-3 text-body-lg", light ? "text-ink-on-brand-muted" : "text-ink-muted")}>{subtitle}</p>}
    </div>
  );
}

// Hero trust row: short, TRUE facts only.
//   14-day free trial: backend onboardingController.startTrial (+14 days), FAQ "How does the free trial work?"
//   Paystack: backend src/utils/paystack.js (store checkout, subscriptions, escrow), Trust section below
//   Phone and laptop: every screen is checked at 360 to 1440px (scripts/check-layout.mjs)
const HERO_TRUST = [
  { icon: IconCalendarCheck, text: "14-day free trial" },
  { icon: IconCreditCard, text: "Payments through Paystack" },
  { icon: IconDevices, text: "Works on phone and laptop" },
] as const;

// Floating "live" cards beside the hero text. Sample values, styled like the
// app's cards; the whole cluster is decorative (aria-hidden), so screen
// readers never hear made-up amounts.
type HeroCard = { key: string; icon?: typeof IconReceipt; tone?: string; title: string; value?: string; meta: string; live?: boolean };
const HERO_CARDS: HeroCard[] = [
  { key: "order", icon: IconShoppingBag, tone: "bg-kpi-orders-bg text-kpi-orders-fg", title: "New order", value: "₦45,000", meta: "Paid online · just now", live: true },
  { key: "stock", icon: IconPackage, tone: "bg-kpi-stock-bg text-kpi-stock-fg", title: "Low stock: Ankara dress", meta: "3 left · time to restock" },
  { key: "payout", icon: IconBuildingBank, tone: "bg-success-bg text-success-ink", title: "Payout sent to your bank", value: "₦120,000", meta: "Today, 10:42" },
  { key: "feli", title: "FELI suggested 3 tasks", meta: "Waiting for your approval" },
];

function HeroCardView({ c, compact }: { c: HeroCard; compact?: boolean }) {
  const Icon = c.icon;
  return (
    <div className={cn("lp-hcard flex items-center gap-3 rounded-xl border border-line-card bg-surface-card text-left shadow-floating", compact ? "h-full p-2.5" : "p-3.5")}>
      {Icon ? (
        <span className={cn("flex shrink-0 items-center justify-center rounded-md", c.tone, compact ? "size-8" : "size-10")}>
          <Icon className={compact ? "size-4" : "size-5"} />
        </span>
      ) : (
        <FeliAvatar size={compact ? "sm" : "md"} decorative />
      )}
      <span className="min-w-0 flex-1">
        <span className={cn("flex items-center gap-1.5 font-semibold text-ink-strong", compact ? "text-caption" : "text-body-sm")}>
          {c.live && <span className="lp-live-dot size-2 shrink-0 rounded-full bg-success" />}
          <span className="min-w-0">{c.title}</span>
        </span>
        {!compact && <span className="mt-0.5 block text-caption text-ink-muted">{c.meta}</span>}
        {compact && c.value && <span className="block text-caption text-ink-muted">{c.value}</span>}
      </span>
      {!compact && c.value && <span className="shrink-0 text-body-sm font-semibold tabular-nums text-ink-brand">{c.value}</span>}
    </div>
  );
}

/** Desktop: four cards, staggered in, each floating on its own slow loop. */
function HeroCards() {
  return (
    <div className="lp-hcards relative hidden flex-col gap-4 lg:flex" aria-hidden="true">
      {HERO_CARDS.map((c, i) => (
        <div key={c.key} className={cn("lp-rise w-[19rem]", i % 2 ? "ml-10" : "ml-0", i === 3 && "lp-hcard-extra")} style={{ ["--lp-delay" as string]: `${420 + i * 160}ms` }}>
          <div className="lp-hcard-float" style={{ ["--lp-fdur" as string]: `${5.5 + i * 0.7}s`, ["--lp-fdelay" as string]: `${1.4 + i * 0.45}s` }}>
            <HeroCardView c={c} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Phones and tablets: two small cards under the buttons (short phones: the order card only, so the Talk to FELI bubble covers nothing). */
function HeroCardsCompact() {
  const pick = HERO_CARDS.filter((c) => c.key === "order" || c.key === "feli");
  return (
    <div className="mt-6 grid max-w-[26rem] grid-cols-2 gap-3 lg:hidden" aria-hidden="true">
      {pick.map((c, i) => (
        <div key={c.key} data-hcard={c.key} className={cn("lp-rise h-full min-w-0", c.key === "feli" && "lp-hcard-short-hide")} style={{ ["--lp-delay" as string]: `${420 + i * 160}ms` }}>
          <div className="lp-hcard-float h-full" style={{ ["--lp-fdur" as string]: `${5.5 + i * 0.9}s`, ["--lp-fdelay" as string]: `${1.4 + i * 0.5}s` }}>
            <HeroCardView c={c} compact />
          </div>
        </div>
      ))}
    </div>
  );
}

function Hero() {
  return (
    // Full-bleed hero, on its own: the Figma city photo across the whole
    // width, a navy shade for legible text, the headline, the buttons and a
    // trust row; on desktop a cluster of sample "live" cards on the right.
    <section className="lp-hero-full relative isolate flex items-center overflow-hidden bg-brand-navy text-ink-on-brand">
      <picture>
        <source media="(min-width: 768px)" srcSet={heroImg} />
        <img src={heroSmImg} alt="" width={1600} height={809} fetchPriority="high" decoding="async" className="absolute inset-0 -z-20 h-full w-full object-cover" />
      </picture>
      <div className="lp-hero-shade absolute inset-0 -z-10" aria-hidden="true" />
      <Container className="lp-hero-pad w-full py-12 md:py-20 lg:py-14">
        <div className="lp-hero-inner grid grid-cols-[minmax(0,1fr)] items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="max-w-[42rem]">
            <p className="lp-rise inline-flex max-w-full items-center gap-2 rounded-full bg-brand-navy-panel py-1 pl-1 pr-3 text-body-sm text-ink-on-brand ring-1 ring-line-on-brand" style={{ ["--lp-delay" as string]: "0ms" }}>
              <FeliAvatar size="xs" decorative />
              <span className="rounded-full bg-surface-tint-feli px-2 text-caption font-semibold text-ink-brand">New</span>
              <span className="min-w-0">Meet FELI, your AI business assistant</span>
            </p>
            <h1 className="lp-rise mt-5 text-title-lg md:text-display lg:text-hero" style={{ ["--lp-delay" as string]: "60ms" }}>
              Smart business starts with BiManage
            </h1>
            <p className="lp-rise mt-4 text-body-lg text-ink-on-brand-muted" style={{ ["--lp-delay" as string]: "160ms" }}>
              Sales, inventory, invoices, your online store, customers, payouts and wholesale buying, in one dashboard built for Nigerian businesses.
            </p>
            <div className="lp-rise mt-6 flex flex-wrap gap-3" style={{ ["--lp-delay" as string]: "260ms" }}>
              <AuthCtas />
            </div>
            <ul aria-label="Why it's easy to start" className="lp-rise mt-5 flex flex-wrap gap-x-5 gap-y-2 text-body-sm text-ink-on-brand-muted" style={{ ["--lp-delay" as string]: "340ms" }}>
              {HERO_TRUST.map((t) => {
                const Icon = t.icon;
                return (
                  <li key={t.text} className="flex items-center gap-1.5">
                    <Icon aria-hidden="true" className="size-4 shrink-0 text-ink-on-brand-accent" />
                    {t.text}
                  </li>
                );
              })}
            </ul>
            <HeroCardsCompact />
          </div>
          <HeroCards />
        </div>
      </Container>
      <a href="#lp-dashboard" aria-label="Scroll to the dashboard" className="lp-scroll-hint absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 flex size-11 -translate-x-1/2 items-center justify-center rounded-full text-ink-on-brand-muted hover:text-ink-on-brand md:bottom-6">
        <IconChevronDown aria-hidden="true" className="size-7" />
      </a>
    </section>
  );
}

function DashboardPreview() {
  return (
    // The real dashboard, in its own white section right after the hero:
    // desktop frame, with the phone version beside it on wide screens (phones
    // see the phone version only). Rises in as the section enters the screen.
    <section id="lp-dashboard" aria-labelledby="lp-dashboard-h" className="scroll-mt-20 bg-surface-card py-16 lg:py-24">
      <Container>
        <div className="mx-auto max-w-[44rem] text-center" data-reveal>
          <h2 id="lp-dashboard-h" className="text-title-lg text-ink-strong md:text-page-title">Everything your business needs, in one dashboard</h2>
          <p className="mt-3 text-body-lg text-ink-muted">Revenue, orders, open invoices and low stock at a glance, on your laptop or your phone.</p>
        </div>
        <div className="mx-auto mt-10 flex max-w-[72rem] items-end justify-center gap-8 md:mt-12" data-reveal style={{ ["--lp-delay" as string]: "120ms" }}>
          <div className="lp-float min-w-0 flex-1 max-md:hidden">
            <BrowserFrame name="dashboard" path="/dashboard" alt="The BiManage business dashboard: revenue, orders, open invoices, low stock and recent orders." />
          </div>
          <PhoneFrame name="dashboard" alt="The BiManage dashboard on a phone." className="w-full shrink-0 md:hidden lg:block lg:w-[15rem]" />
        </div>
      </Container>
    </section>
  );
}

function RealNumbers() {
  const { data } = usePublicStats();
  if (!data) return null;
  const items = [
    data.businesses.show && { label: "businesses on BiManage", value: data.businesses.count },
    data.storesLive.show && { label: "online stores live", value: data.storesLive.count },
    data.ordersProcessed.show && { label: "orders processed", value: data.ordersProcessed.count },
  ].filter(Boolean) as Array<{ label: string; value: number }>;
  if (!items.length) return null;
  return (
    <section aria-label="BiManage in numbers" className="border-b border-line-subtle bg-surface-card py-10">
      <Container className="grid grid-cols-[minmax(0,1fr)] gap-6 text-center md:grid-cols-3">
        {items.map((i) => (
          <div key={i.label} data-reveal>
            <p className="text-page-title text-ink-brand"><CountUp to={i.value} /></p>
            <p className="mt-1 text-body text-ink-muted">{i.label}</p>
          </div>
        ))}
      </Container>
    </section>
  );
}

function Features() {
  const [active, setActive] = useState(0);
  const f = FEATURES[active] ?? FEATURES[0];
  return (
    <section id="features" className="scroll-mt-20 bg-surface-page py-16 lg:py-24">
      <Container>
        <SectionTitle eyebrow="Key features" title="Powerful tools, one simple interface" subtitle="Everything below is in BiManage today. Pick a feature to see the real screen." />
        <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
          <div role="tablist" aria-label="Features" aria-orientation="vertical" className="flex flex-col gap-2" data-reveal>
            {FEATURES.map((x, i) => {
              const Icon = x.icon;
              const on = i === active;
              return (
                <button
                  key={x.key}
                  type="button"
                  role="tab"
                  id={`lp-tab-${x.key}`}
                  aria-selected={on}
                  aria-controls="lp-feature-panel"
                  onClick={() => setActive(i)}
                  className={cn("flex min-h-11 items-start gap-3 rounded-lg border p-3 text-left transition-colors", on ? "border-brand-navy bg-surface-card shadow-card" : "border-transparent hover:bg-surface-card")}
                >
                  {x.key === "feli" ? (
                    <FeliAvatar size="md" decorative />
                  ) : (
                    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-md", on ? "bg-brand-navy text-ink-on-brand" : "bg-surface-tint-blue text-ink-brand")}>
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block text-card-heading text-ink-strong">{x.title}</span>
                    {on && <span className="mt-1 block text-body-sm text-ink-muted">{x.body}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <div id="lp-feature-panel" role="tabpanel" aria-labelledby={`lp-tab-${f.key}`} className="min-w-0">
            <div key={f.key} className="lp-fade">
              <BrowserFrame name={f.key} path={f.path} alt={`${f.title} in BiManage.`} className="hidden md:block" />
              <PhoneFrame name={"phone" in f ? f.phone : f.key} alt={`${f.title} in BiManage on a phone.`} className="md:hidden" />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-surface-card py-16 lg:py-24">
      <Container>
        <SectionTitle eyebrow="How it works" title="Up and running in three steps" />
        <ol className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-10 md:mt-14 md:grid-cols-3 md:gap-6">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.title} data-reveal style={{ ["--lp-delay" as string]: `${i * 140}ms` }} className="relative flex flex-col items-center px-2 text-center">
                {/* A light connecting line to the next step (side by side only). */}
                {i < STEPS.length - 1 && <span aria-hidden="true" className="lp-step-line absolute left-[calc(50%+3.5rem)] right-[calc(-50%+3.5rem)] top-10 hidden md:block" />}
                <span className="relative flex size-20 items-center justify-center rounded-full bg-surface-tint-blue text-ink-brand ring-8 ring-surface-tint-blue/40">
                  <Icon aria-hidden="true" className="size-9" stroke={1.6} />
                </span>
                <span className="mt-5 text-caption font-semibold uppercase tracking-wide text-ink-brand">Step {i + 1}</span>
                <h3 className="mt-1 text-title-sm text-ink-strong">{s.title}</h3>
                <p className="mt-2 max-w-[20rem] text-body text-ink-muted">{s.body}</p>
              </li>
            );
          })}
        </ol>
      </Container>
    </section>
  );
}

function WhyBiManage() {
  return (
    <section className="bg-brand-navy py-16 text-ink-on-brand lg:py-24">
      <Container>
        <SectionTitle eyebrow="Why BiManage" title="Why growing businesses choose BiManage" light />
        <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-3">
          {WHY.map((w, i) => (
            <article key={w.title} data-reveal style={{ ["--lp-delay" as string]: `${i * 120}ms` }} className="lp-lift rounded-3xl bg-brand-navy-panel p-6 ring-1 ring-line-on-brand">
              <span className="flex size-12 items-center justify-center rounded-full bg-surface-tint-warm text-kpi-invoices-fg" aria-hidden="true">
                <IconStarFilled className="size-6" />
              </span>
              <h3 className="mt-4 text-title-sm">{w.title}</h3>
              <p className="mt-2 text-body text-ink-on-brand-muted">{w.body}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Pricing() {
  const { data, isLoading, error, refetch } = usePublicPlans();
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const plans = data?.plans ?? [];
  const provisional = plans.some((p) => !p.pricesConfirmed);
  return (
    <section id="pricing" className="scroll-mt-20 bg-surface-page py-16 lg:py-24">
      <Container>
        <SectionTitle eyebrow="Plans and pricing" title="Start free, upgrade when you're ready" subtitle="Prices are in naira and come straight from our billing system." />
        <div className="mt-8 flex justify-center" data-reveal>
          <div role="radiogroup" aria-label="Billing period" className="flex rounded-md bg-surface-card p-1 shadow-card">
            {(["monthly", "yearly"] as const).map((c) => (
              <button key={c} type="button" role="radio" aria-checked={cycle === c} onClick={() => setCycle(c)} className={cn("min-h-11 rounded-sm px-5 text-action font-semibold capitalize", cycle === c ? "bg-brand-navy text-ink-on-brand" : "text-ink-muted")}>
                {c}
              </button>
            ))}
          </div>
        </div>
        {isLoading && (
          <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-3" role="status" aria-label="Loading plans">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex h-[26rem] animate-pulse flex-col gap-4 rounded-2xl border border-line-card bg-surface-card p-6">
                <div className="h-6 w-1/3 rounded-sm bg-surface-pale" />
                <div className="h-4 w-2/3 rounded-sm bg-surface-pale" />
                <div className="h-9 w-1/2 rounded-sm bg-surface-pale" />
                <div className="mt-2 flex flex-col gap-2">{[0, 1, 2, 3].map((j) => <div key={j} className="h-4 rounded-sm bg-surface-pale" />)}</div>
              </div>
            ))}
          </div>
        )}
        <ErrorNote error={error} fallback="We couldn't load the plans right now." onRetry={() => void refetch()} className="mx-auto mt-10 max-w-[32rem]" />
        {plans.length > 0 && (
          <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-3">
            {plans.map((p, i) => {
              const price = p.price[cycle];
              const featured = p.id === "standard";
              return (
                <article key={p.id} data-reveal style={{ ["--lp-delay" as string]: `${i * 100}ms` }} className={cn("lp-lift flex flex-col rounded-2xl border bg-surface-card p-6 shadow-card", featured ? "border-brand-navy" : "border-line-card")}>
                  <h3 className="text-title-sm text-ink-strong">{p.name}</h3>
                  <p className="mt-1 min-h-12 text-body-sm text-ink-muted">{p.description}</p>
                  <p className="mt-4 text-metric text-ink-brand">
                    {price ? naira(price) : "Free"}
                    {price ? <span className="text-body text-ink-muted"> /{cycle === "yearly" ? "year" : "month"}</span> : null}
                  </p>
                  <p className="mt-1 text-body-sm text-ink-secondary">{p.credits === "unlimited" ? "Unlimited use" : `${p.credits} daily credits`}</p>
                  <ul className="mt-5 flex flex-1 flex-col gap-2">
                    {FEATURE_LABELS.filter(([k]) => p.features[k]).map(([k, label]) => (
                      <li key={k} className="flex items-start gap-2 text-body-sm text-ink-strong">
                        <IconCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                        <span>{label}{p.features[k] === "view_only" ? " (view only)" : ""}</span>
                      </li>
                    ))}
                  </ul>
                  <ButtonLink to="/register" variant={featured ? "primary" : "outlined"} fullWidth className="mt-6">
                    {price ? `Choose ${p.name}` : "Start free"}
                  </ButtonLink>
                </article>
              );
            })}
          </div>
        )}
        {provisional && <p className="mt-4 text-center text-body-sm text-ink-muted">Some prices are introductory and may change; you'll always see the price before you pay.</p>}
        {data?.startupPackages && data.startupPackages.length > 0 && (
          <div className="mt-12" data-reveal>
            <h3 className="text-center text-section-title text-ink-strong">One-time startup packages</h3>
            <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-3">
              {data.startupPackages.map((s) => (
                <div key={s.id} className="rounded-xl border border-line-card bg-surface-card p-5">
                  <p className="text-card-heading text-ink-strong">{s.name}</p>
                  <p className="mt-1 text-title-sm text-ink-brand">{naira(s.amount)}{s.days ? <span className="text-body-sm text-ink-muted"> for {s.days} days</span> : null}</p>
                  {s.summary && <p className="mt-2 text-body-sm text-ink-muted">{s.summary}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </Container>
    </section>
  );
}

function Trust() {
  return (
    <section className="bg-surface-card py-16 lg:py-24">
      <Container>
        <SectionTitle eyebrow="Security and trust" title="Built to protect your money and your data" />
        <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-2 lg:grid-cols-3">
          {TRUST.map((t, i) => {
            const Icon = t.icon;
            return (
              <div key={t.title} data-reveal style={{ ["--lp-delay" as string]: `${(i % 3) * 100}ms` }} className="rounded-2xl border border-line-card bg-surface-page p-6">
                <span className="flex size-11 items-center justify-center rounded-md bg-surface-tint-blue text-ink-brand" aria-hidden="true"><Icon className="size-6" /></span>
                <h3 className="mt-4 text-card-heading text-ink-strong">{t.title}</h3>
                <p className="mt-2 text-body-sm text-ink-muted">{t.body}</p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

function Reviews() {
  const { data } = usePublicReviews({ sort: "recent" });
  const reviews = (data?.reviews ?? []).slice(0, 3);
  if (!reviews.length) return null; // Only approved, real reviews; otherwise no section.
  return (
    <section className="bg-surface-page py-16 lg:py-24">
      <Container>
        <SectionTitle eyebrow="Reviews" title="What businesses say" />
        <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-3">
          {reviews.map((r) => (
            <figure key={r._id} data-reveal className="rounded-2xl border border-line-card bg-surface-card p-6 shadow-card">
              <p className="flex gap-0.5 text-kpi-invoices-fg" aria-label={`${r.rating} out of 5`}>
                {Array.from({ length: 5 }, (_, i) => <IconStarFilled key={i} className={cn("size-4", i >= r.rating && "opacity-25")} aria-hidden="true" />)}
              </p>
              <blockquote className="mt-3">
                <p className="text-card-heading text-ink-strong">{r.headline}</p>
                <p className="mt-2 text-body-sm text-ink-muted">{r.review}</p>
              </blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                {/* The photo they uploaded in BiManage (initials if none). */}
                <Avatar name={r.reviewer?.name || r.businessName || "BiManage user"} src={r.reviewer?.avatar} />
                <span className="min-w-0">
                  <span className="block text-body-sm font-semibold text-ink-strong">{r.reviewer?.name || "BiManage user"}</span>
                  {r.businessName && <span className="block text-caption text-ink-muted">{r.businessName}</span>}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-6 text-center"><Link to="/reviews" className="inline-flex min-h-11 items-center text-action font-semibold text-ink-brand hover:underline">Read all reviews</Link></p>
      </Container>
    </section>
  );
}

// A short preview: the featured questions from the shared FAQ (faq.ts). The
// full list, topic links, search and the FAQPage structured data are on /faq.
function Faq() {
  const { data: plans } = usePublicPlans();
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <section id="faq" className="scroll-mt-20 bg-surface-card py-16 lg:py-24">
      <Container className="max-w-[50rem]">
        <SectionTitle eyebrow="FAQ" title="Questions, answered" />
        <div className="mt-10" data-reveal>
          <FaqAccordion items={FEATURED_FAQS} plans={plans} openId={openId} onToggle={(id) => setOpenId((cur) => (cur === id ? null : id))} />
        </div>
        <p className="mt-8 flex flex-col items-center gap-2">
          <ButtonLink to="/faq" variant="outlined">See all FAQs</ButtonLink>
          <Link to="/help" className="inline-flex min-h-11 items-center text-action font-semibold text-ink-brand hover:underline">Browse the help centre</Link>
        </p>
      </Container>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-surface-page py-16 lg:py-24">
      <Container>
        <div className="overflow-hidden rounded-3xl bg-gradient-brand-panel px-5 pt-10 text-center text-ink-on-brand md:px-10" data-reveal>
          <h2 className="text-title-lg md:text-page-title">Ready to simplify your business?</h2>
          <p className="mx-auto mt-3 max-w-[36rem] text-body-lg text-ink-on-brand-muted">Set up in minutes and run sales, stock, payments and customers from one place.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <AuthCtas />
          </div>
          {/* Figma collage (stock photos). */}
          <div className="mt-10 flex justify-center gap-3" aria-hidden="true">
            {collage.slice(0, 7).map((src, i) => (
              <img key={src} src={src} alt="" width={135} height={140} loading="lazy" decoding="async" className={cn("h-28 w-24 shrink-0 rounded-md object-cover md:h-36 md:w-32", i % 2 ? "translate-y-6" : "translate-y-2", i > 2 && "hidden md:block", i > 4 && "md:hidden lg:block")} />
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

export default function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  useReveal(root);
  return (
    <PublicLayout rootRef={root}>
      <Hero />
      <DashboardPreview />
      <RealNumbers />
      <Features />
      <HowItWorks />
      <WhyBiManage />
      <Pricing />
      <Trust />
      <Reviews />
      <Faq />
      <FinalCta />
    </PublicLayout>
  );
}
