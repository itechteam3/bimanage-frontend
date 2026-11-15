import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  IconBarcode,
  IconBuildingStore,
  IconChartBar,
  IconCheck,
  IconChevronDown,
  IconCreditCard,
  IconDevices,
  IconKey,
  IconLayoutKanban,
  IconLock,
  IconMenu2,
  IconMessageCircle,
  IconReceipt,
  IconSend,
  IconShieldCheck,
  IconSparkles,
  IconStarFilled,
  IconTruckDelivery,
  IconUsers,
  IconUsersGroup,
  IconWallet,
  IconX,
} from "@tabler/icons-react";
import { Logo } from "@/components/brand/Logo";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, SelectInput, TextArea, TextInput } from "@/components/ui/Field";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { cn } from "@/lib/cn";
import { naira } from "@/lib/format";
import { FEATURE_LABELS } from "@/lib/subscription/api";
import { usePublicReviews } from "@/lib/reviews/api";
import { useFaqs } from "@/lib/support/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useContactRequest, useNewsletterSignup, usePublicPlans, usePublicStats, type ContactTopic } from "@/lib/landing/api";
import "./landing.css";

import heroImg from "@/assets/landing/hero.webp";
import heroSmImg from "@/assets/landing/hero-sm.webp";
import stepSignup from "@/assets/landing/step-signup.webp";
import stepCustomize from "@/assets/landing/step-customize.webp";
import stepGrow from "@/assets/landing/step-grow.webp";

// Product screenshots: the REAL app with the invented "Adunni Fashion House"
// sample data (scripts/marketing). 2x WebP with a 1x PNG fallback.
const shots = import.meta.glob<string>("../../assets/landing/screens/*.{webp,png}", { eager: true, import: "default", query: "?url" });
const shot = (name: string, kind: "desktop" | "phone") => ({
  webp: shots[`../../assets/landing/screens/${name}-${kind}.webp`] ?? "",
  png: shots[`../../assets/landing/screens/${name}-${kind}.png`] ?? "",
});
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

const reducedMotion = () =>
  typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("reduce-motion"));

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
  const [w, h] = kind === "desktop" ? [1280, 800] : [390, 844];
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

function PhoneFrame({ name, alt, className }: { name: string; alt: string; className?: string }) {
  return (
    <figure className={cn("relative mx-auto w-full max-w-[17rem] overflow-hidden rounded-[2.25rem] border-[6px] border-ink-strong bg-ink-strong shadow-floating", className)}>
      <div className="relative overflow-hidden rounded-[1.75rem]">
        <Shot name={name} kind="phone" alt={alt} />
      </div>
    </figure>
  );
}

// ── Content (true claims only: what BiManage does today) ─────────────────

const NAV = [
  ["Features", "#features"],
  ["Pricing", "#pricing"],
  ["How it works", "#how-it-works"],
  ["FAQ", "#faq"],
] as const;

const FEATURES = [
  { key: "inventory", icon: IconBarcode, title: "Inventory and barcode", body: "Track stock across products, scan or type barcodes, get low-stock alerts and keep a full adjustment history.", path: "/inventory" },
  { key: "orders", icon: IconReceipt, title: "Sales, orders and invoices", body: "Record sales, follow payment and fulfilment, and send branded invoices as PDF or email.", path: "/orders", extra: "invoice" },
  { key: "store", icon: IconBuildingStore, title: "Online store with checkout", body: "Your own storefront with guest checkout, live order updates and order tracking for your shoppers.", path: "/s/adunnifashion", phone: "checkout" },
  { key: "wallet", icon: IconWallet, title: "Wallet and payouts", body: "See earnings, money on hold and payouts to your bank account, with every transaction recorded.", path: "/wallet" },
  { key: "customers", icon: IconUsers, title: "Customers", body: "Customer records built automatically from orders, store sales and invoices, with history, notes and tags.", path: "/customers" },
  { key: "projects", icon: IconLayoutKanban, title: "Projects and team", body: "Plan work on boards, assign tasks with due dates, and invite your team with roles and permissions.", path: "/projects/p1" },
  { key: "feli", icon: IconSparkles, title: "FELI, your AI assistant", body: "Ask about your business, get answers and suggested actions — nothing changes until you approve it.", path: "/feli" },
  { key: "bisupplynet", icon: IconTruckDelivery, title: "BiSupplyNet wholesale", body: "Find verified wholesalers and buy in bulk, with your payment held in escrow until delivery is confirmed.", path: "/bisupplynet/suppliers" },
  { key: "reports", icon: IconChartBar, title: "Reports", body: "Revenue, stock and invoice collections over any period, with spreadsheet exports.", path: "/reports" },
] as const;

const STEPS = [
  { img: stepSignup, title: "Sign up", body: "Create your account and verify your email — it takes minutes." },
  { img: stepCustomize, title: "Set up your business", body: "Add your business details and products, and open your online store if you sell online." },
  { img: stepGrow, title: "Sell, manage and grow", body: "Record sales, take payments, track stock and customers, and see how you're doing." },
];

const WHY = [
  { title: "All-in-one platform", body: "Sales, inventory, invoices, your online store, customers, projects and wholesale buying in one place — no more switching between apps and spreadsheets." },
  { title: "Works on your phone", body: "Every screen works on phones, tablets and laptops, so you can check sales, update orders and reply to customers wherever you are." },
  { title: "For solo founders and teams", body: "Start on your own and invite your team when you're ready, with roles and permissions that control what each person can see and do." },
];

const TRUST = [
  { icon: IconCreditCard, title: "Payments through Paystack", body: "Online payments are processed by Paystack, and every payment is verified on our server before an order is marked paid." },
  { icon: IconShieldCheck, title: "Escrow on BiSupplyNet", body: "Wholesale payments are held until the buyer confirms delivery, with a dispute process if something goes wrong." },
  { icon: IconUsersGroup, title: "Roles and permissions", body: "Give each team member only the access they need — from owner and admin to manager and staff." },
  { icon: IconLock, title: "Your data stays yours", body: "Each business sees only its own data. Every request is checked against your business on the server." },
  { icon: IconKey, title: "Stronger passwords", body: "Common and breached passwords are blocked, and you can't reuse your recent passwords." },
  { icon: IconDevices, title: "Session control", body: "See where your account is signed in and sign out other devices from your security settings." },
];

const BASE_FAQS = [
  { q: "Is there a free plan?", a: "Yes. Freemium is free and uses daily credits, so you can try BiManage before you pay. Paid plans unlock more modules — see Plans and pricing above." },
  { q: "Can I take payments online?", a: "Yes. Your online store has a checkout powered by Paystack. Earnings go to your BiManage wallet and are paid out to your bank account." },
  { q: "Does it work on my phone?", a: "Yes. BiManage works in the browser on phones, tablets and laptops — there's nothing to install." },
  { q: "Can my team use it?", a: "Yes. Invite team members and choose their role and permissions; each person only sees what they're allowed to." },
];

// ── Sections ──────────────────────────────────────────────────────────────

function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[75rem] px-5 md:px-8", className)}>{children}</div>;
}

function SectionTitle({ eyebrow, title, subtitle, light }: { eyebrow?: string; title: string; subtitle?: string; light?: boolean }) {
  return (
    <div className="mx-auto max-w-[44rem] text-center" data-reveal>
      {eyebrow && <p className={cn("text-caption font-semibold uppercase tracking-wide", light ? "text-ink-on-brand-accent" : "text-ink-brand")}>{eyebrow}</p>}
      <h2 className={cn("mt-2 text-title-lg md:text-page-title", light ? "text-ink-on-brand" : "text-ink-strong")}>{title}</h2>
      {subtitle && <p className={cn("mt-3 text-body-lg", light ? "text-ink-on-brand-muted" : "text-ink-muted")}>{subtitle}</p>}
    </div>
  );
}

function NavBar({ onContact }: { onContact: () => void }) {
  const [open, setOpen] = useState(false);
  const signedIn = useAuth().status === "authenticated";
  return (
    <header className="sticky top-0 z-30 bg-brand-navy/95 backdrop-blur">
      <Container className="flex h-mobile-header items-center justify-between gap-4 lg:h-header">
        <Link to="/" aria-label="BiManage home" className="shrink-0">
          <Logo tone="on-brand" />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
          {NAV.map(([label, href]) => (
            <a key={href} href={href} className="text-nav text-ink-on-brand-muted transition-colors hover:text-ink-on-brand">{label}</a>
          ))}
          <button type="button" onClick={onContact} className="text-nav text-ink-on-brand-muted transition-colors hover:text-ink-on-brand">Contact us</button>
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          {signedIn ? (
            <ButtonLink to="/dashboard" variant="tonal" size="md">Go to dashboard</ButtonLink>
          ) : (
            <>
              <ButtonLink to="/login" variant="secondary" size="md">Sign in</ButtonLink>
              <ButtonLink to="/register" variant="tonal" size="md">Get started</ButtonLink>
            </>
          )}
        </div>
        <button type="button" className="flex size-11 items-center justify-center rounded-md text-ink-on-brand lg:hidden" aria-expanded={open} aria-controls="lp-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((v) => !v)}>
          {open ? <IconX className="size-6" aria-hidden="true" /> : <IconMenu2 className="size-6" aria-hidden="true" />}
        </button>
      </Container>
      {open && (
        <div id="lp-menu" className="border-t border-line-on-brand bg-brand-navy lg:hidden">
          <Container className="flex flex-col items-center gap-2 py-6">
            {NAV.map(([label, href]) => (
              <a key={href} href={href} onClick={() => setOpen(false)} className="flex min-h-11 items-center text-nav text-ink-on-brand">{label}</a>
            ))}
            <button type="button" onClick={() => { setOpen(false); onContact(); }} className="flex min-h-11 items-center text-nav text-ink-on-brand">Contact us</button>
            <div className="mt-3 flex w-full max-w-[20rem] flex-col gap-3">
              {signedIn ? (
                <ButtonLink to="/dashboard" variant="tonal" fullWidth>Go to dashboard</ButtonLink>
              ) : (
                <>
                  <ButtonLink to="/register" variant="tonal" fullWidth>Get started</ButtonLink>
                  <ButtonLink to="/login" variant="secondary" fullWidth>Sign in</ButtonLink>
                </>
              )}
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    // Full-bleed hero: the Figma city photo across the whole width, navy shade
    // for legible text, then the real dashboard rising in below the buttons.
    <section className="relative isolate overflow-hidden bg-brand-navy text-ink-on-brand">
      <picture>
        <source media="(min-width: 768px)" srcSet={heroImg} />
        <img src={heroSmImg} alt="" width={1600} height={809} fetchPriority="high" decoding="async" className="absolute inset-0 -z-20 h-full w-full object-cover" />
      </picture>
      <div className="lp-hero-shade absolute inset-0 -z-10" aria-hidden="true" />
      <Container className="pb-14 pt-14 md:pb-20 md:pt-20 lg:pt-24">
        <div className="max-w-[42rem]">
          <h1 className="lp-rise text-title-lg md:text-display lg:text-hero" style={{ ["--lp-delay" as string]: "60ms" }}>
            Smart business starts with BiManage
          </h1>
          <p className="lp-rise mt-4 text-body-lg text-ink-on-brand-muted" style={{ ["--lp-delay" as string]: "160ms" }}>
            Sales, inventory, invoices, your online store, customers, payouts and wholesale buying — in one dashboard built for Nigerian businesses.
          </p>
          <div className="lp-rise mt-6 flex flex-wrap gap-3" style={{ ["--lp-delay" as string]: "260ms" }}>
            <ButtonLink to="/register" variant="tonal">Get started free</ButtonLink>
            <ButtonLink to="/login" variant="secondary">Sign in</ButtonLink>
          </div>
        </div>
        <div className="lp-preview mx-auto mt-12 max-w-[62rem] md:mt-16">
          <div className="lp-float">
            <BrowserFrame name="dashboard" path="/dashboard" alt="The BiManage business dashboard: revenue, orders, open invoices, low stock and recent orders." eager className="hidden md:block" />
            <PhoneFrame name="dashboard" alt="The BiManage dashboard on a phone." className="md:hidden" />
          </div>
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
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-md", on ? "bg-brand-navy text-ink-on-brand" : "bg-surface-tint-blue text-ink-brand")}>
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
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
        <ol className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} data-reveal style={{ ["--lp-delay" as string]: `${i * 120}ms` }} className="lp-lift flex flex-col items-center rounded-2xl bg-gradient-brand-panel p-6 text-center text-ink-on-brand shadow-card">
              <span className="text-caption font-semibold uppercase text-ink-on-brand-accent">Step {i + 1}</span>
              <img src={s.img} alt="" width={80} height={80} loading="lazy" decoding="async" className="mt-3 size-20 rounded-full bg-surface-card object-cover" />
              <h3 className="mt-4 text-title-sm">{s.title}</h3>
              <p className="mt-2 text-body text-ink-on-brand-muted">{s.body}</p>
            </li>
          ))}
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
  if (!reviews.length) return null; // Only approved, real reviews — otherwise no section.
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
              <figcaption className="mt-4 text-body-sm font-semibold text-ink-secondary">{r.reviewer?.name}{r.businessName ? ` · ${r.businessName}` : ""}</figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-6 text-center"><Link to="/reviews" className="inline-flex min-h-11 items-center text-action font-semibold text-ink-brand hover:underline">Read all reviews</Link></p>
      </Container>
    </section>
  );
}

function Faq() {
  const { data } = useFaqs("", "");
  const items = [...(data ?? []).slice(0, 6).map((f) => ({ q: f.question, a: f.answer })), ...BASE_FAQS].slice(0, 8);
  return (
    <section id="faq" className="scroll-mt-20 bg-surface-card py-16 lg:py-24">
      <Container className="max-w-[50rem]">
        <SectionTitle eyebrow="FAQ" title="Questions, answered" />
        <div className="mt-10 flex flex-col gap-3">
          {items.map((f) => (
            <details key={f.q} className="group rounded-xl border border-line-card bg-surface-page px-5" data-reveal>
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-card-heading text-ink-strong">
                {f.q}
                <IconChevronDown className="size-5 shrink-0 text-ink-muted transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="whitespace-pre-line pb-4 text-body text-ink-muted">{f.a}</p>
            </details>
          ))}
        </div>
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
            <ButtonLink to="/register" variant="tonal">Get started free</ButtonLink>
            <ButtonLink to="/login" variant="secondary">Sign in</ButtonLink>
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

function Footer() {
  const signup = useNewsletterSignup();
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  return (
    <footer className="bg-brand-navy text-ink-on-brand">
      <Container className="grid grid-cols-[minmax(0,1fr)] gap-10 py-12 md:grid-cols-2">
        <div>
          <Logo tone="on-brand" size="panel" />
          <p className="mt-4 max-w-[26rem] text-body text-ink-on-brand-muted">Run your whole business in one place: sales, inventory, invoices, your online store, customers and payouts.</p>
          <nav aria-label="Footer" className="mt-6 flex flex-wrap gap-x-6 gap-y-1">
            {([["Sign in", "/login"], ["Create an account", "/register"], ["Reviews", "/reviews"]] as const).map(([l, to]) => (
              <Link key={to} to={to} className="inline-flex min-h-11 items-center text-body text-ink-on-brand-muted hover:text-ink-on-brand">{l}</Link>
            ))}
            <a href="#faq" className="inline-flex min-h-11 items-center text-body text-ink-on-brand-muted hover:text-ink-on-brand">FAQ</a>
          </nav>
        </div>
        <div>
          <h2 className="text-title-sm">Join our newsletter</h2>
          <p className="mt-2 text-body text-ink-on-brand-muted">Business tips and product updates, now and then. We'll ask you to confirm by email.</p>
          {signup.isSuccess ? (
            <p className="mt-4 rounded-lg bg-brand-navy-panel p-4 text-body" role="status">{signup.data.message}</p>
          ) : (
            <form
              className="mt-4 flex flex-col gap-3 md:flex-row"
              onSubmit={(e) => { e.preventDefault(); if (email.trim()) signup.mutate({ email: email.trim(), website }); }}
            >
              <label className="sr-only" htmlFor="lp-newsletter">Email address</label>
              <input id="lp-newsletter" type="email" required autoComplete="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-control-lg min-h-11 w-full min-w-0 shrink-0 rounded-md border border-line-on-brand bg-brand-navy-panel md:w-auto md:flex-1 px-4 text-input text-ink-on-brand outline-none placeholder:text-ink-on-brand-soft focus:border-ink-on-brand" />
              {/* Honeypot: hidden from people and assistive tech. */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} className="absolute left-[-9999px] h-px w-px opacity-0" />
              <Button type="submit" variant="tonal" loading={signup.isPending} loadingText="Sending…" icon={<IconSend className="size-4" aria-hidden="true" />}>Subscribe</Button>
            </form>
          )}
          <ErrorNote error={signup.error} fallback="We couldn't sign you up. Please try again." className="mt-3" />
        </div>
      </Container>
      <div className="border-t border-line-on-brand">
        <Container className="py-5">
          <p className="text-body-sm text-ink-on-brand-muted">© {new Date().getFullYear()} BiManage by BiTechTeam. All rights reserved.</p>
        </Container>
      </div>
    </footer>
  );
}

const TOPICS: Array<[ContactTopic, string]> = [["demo", "Book a demo"], ["sales", "Plans and pricing"], ["support", "Help with my account"], ["partnership", "Partnership"], ["other", "Something else"]];

function ContactDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const send = useContactRequest();
  const [form, setForm] = useState({ name: "", email: "", company: "", phone: "", topic: "demo" as ContactTopic, message: "", website: "" });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const close = () => { onClose(); if (send.isSuccess) { send.reset(); setForm((f) => ({ ...f, message: "" })); } };
  return (
    <Dialog open={open} onClose={close} title={send.isSuccess ? "Message sent" : "Contact us"} description={send.isSuccess ? send.data.message : "Ask a question or book a demo. We reply by email."}
      actions={send.isSuccess ? <Button onClick={close}>Done</Button> : undefined}>
      {!send.isSuccess && (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate({ ...form, company: form.company || undefined, phone: form.phone || undefined });
          }}
        >
          <Field label="Your name" required><TextInput value={form.name} onChange={set("name")} autoComplete="name" maxLength={80} /></Field>
          <Field label="Email" required><TextInput type="email" value={form.email} onChange={set("email")} autoComplete="email" /></Field>
          <Field label="Business name"><TextInput value={form.company} onChange={set("company")} autoComplete="organization" maxLength={100} /></Field>
          <Field label="Phone"><TextInput type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" maxLength={30} /></Field>
          <Field label="What can we help with?" required>
            <SelectInput value={form.topic} onChange={set("topic")}>{TOPICS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</SelectInput>
          </Field>
          <Field label="Message" required hint="At least 10 characters."><TextArea rows={4} value={form.message} onChange={set("message")} maxLength={2000} /></Field>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={set("website")} className="absolute left-[-9999px] h-px w-px opacity-0" />
          <ErrorNote error={send.error} fallback="We couldn't send your message. Please try again." />
          <div className="flex flex-col-reverse gap-3 md:flex-row [&>*]:flex-1">
            <Button type="button" variant="secondary" onClick={close}>Cancel</Button>
            <Button type="submit" loading={send.isPending} loadingText="Sending…">Send message</Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

export default function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  const [contact, setContact] = useState(false);
  useReveal(root);
  return (
    <div ref={root} className="lp-root min-h-dvh bg-surface-page font-sans text-ink-strong">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface-card focus:px-4 focus:py-2">Skip to content</a>
      <NavBar onContact={() => setContact(true)} />
      <main id="main">
        <Hero />
        <RealNumbers />
        <Features />
        <HowItWorks />
        <WhyBiManage />
        <Pricing />
        <Trust />
        <Reviews />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <button type="button" onClick={() => setContact(true)} aria-label="Contact us" className="fixed bottom-5 right-5 z-20 flex size-14 items-center justify-center rounded-full bg-brand-navy text-ink-on-brand shadow-floating transition-transform hover:scale-105">
        <IconMessageCircle className="size-7" aria-hidden="true" />
      </button>
      <ContactDialog open={contact} onClose={() => setContact(false)} />
    </div>
  );
}
