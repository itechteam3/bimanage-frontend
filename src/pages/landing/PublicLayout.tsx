import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { IconSend } from "@tabler/icons-react";
import { Logo } from "@/components/brand/Logo";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useNewsletterSignup } from "@/lib/landing/api";
import { FeliGuestChat } from "./FeliGuestChat";
import "./landing.css";

// The public site's shared frame: navbar and footer used by the landing page
// ("/", "/home") and the other public pages (/contact).

export const reducedMotion = () =>
  typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("reduce-motion"));

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[75rem] px-5 md:px-8", className)}>{children}</div>;
}

const NAV = [
  ["Features", "#features"],
  ["Pricing", "#pricing"],
  ["How it works", "#how-it-works"],
  ["FAQ", "#faq"],
] as const;

/** Where the landing page's #sections live: in-page on "/", otherwise "/" (the landing page for everyone). */
function useSectionBase() {
  const { pathname } = useLocation();
  return pathname === "/" ? "" : "/";
}

/** Sign up + Sign in for visitors; "Go to dashboard" for signed-in people. */
export function AuthCtas({ size, className }: { size?: "md" | "lg"; className?: string }) {
  const signedIn = useAuth().status === "authenticated";
  if (signedIn) return <ButtonLink to="/start" variant="tonal" size={size} className={className}>Go to dashboard</ButtonLink>;
  return (
    <>
      <ButtonLink to="/register" variant="tonal" size={size} className={className}>Get started free</ButtonLink>
      <ButtonLink to="/login" variant="secondary" size={size} className={className}>Sign in</ButtonLink>
    </>
  );
}

/** Matches the menu's CSS transition (landing.css .lp-menu). */
const MENU_MS = 260;

export function NavBar() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const signedIn = useAuth().status === "authenticated";
  const base = useSectionBase();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);

  // Keep the panel mounted while it animates out, then unmount it.
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (reducedMotion()) {
      setMounted(false);
      return;
    }
    const t = setTimeout(() => setMounted(false), MENU_MS);
    return () => clearTimeout(t);
  }, [open]);

  // Focus the first link once the panel is in the page.
  useEffect(() => {
    if (open && mounted) menuRef.current?.querySelector<HTMLElement>("a, button")?.focus();
  }, [open, mounted]);

  // Lock the page behind while open; Escape closes; the desktop layout closes it.
  useLayoutEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    const onResize = () => { if (window.innerWidth >= 1024) setOpen(false); };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const close = () => setOpen(false);
  const show = open && mounted;
  const item = (i: number) => ({ className: "lp-menu-item flex min-h-11 items-center text-nav text-ink-on-brand", style: { ["--lp-i" as string]: i } });

  return (
    <>
      {mounted && <div className={cn("lp-menu-backdrop fixed inset-0 z-20 bg-surface-overlay lg:hidden", show && "lp-open")} aria-hidden="true" onClick={close} data-testid="menu-backdrop" />}
      <header className="sticky top-0 z-30 bg-brand-navy/95 backdrop-blur">
        <Container className="flex h-mobile-header items-center justify-between gap-4 lg:h-header">
          <Link to="/" aria-label="BiManage home" className="shrink-0">
            <Logo tone="on-brand" />
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
            {NAV.map(([label, href]) => (
              <a key={href} href={`${base}${href}`} className="text-nav text-ink-on-brand-muted transition-colors hover:text-ink-on-brand">{label}</a>
            ))}
            <Link to="/contact" className="text-nav text-ink-on-brand-muted transition-colors hover:text-ink-on-brand">Contact us</Link>
          </nav>
          <div className="hidden items-center gap-3 lg:flex">
            {signedIn ? (
              <ButtonLink to="/start" variant="tonal" size="md">Go to dashboard</ButtonLink>
            ) : (
              <>
                <ButtonLink to="/login" variant="secondary" size="md">Sign in</ButtonLink>
                <ButtonLink to="/register" variant="tonal" size="md">Get started</ButtonLink>
              </>
            )}
          </div>
          <button
            ref={toggleRef}
            type="button"
            className={cn("lp-burger relative flex size-11 items-center justify-center rounded-md text-ink-on-brand lg:hidden", open && "lp-open")}
            aria-expanded={open}
            aria-controls="lp-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span aria-hidden="true" className="lp-burger-bar" />
            <span aria-hidden="true" className="lp-burger-bar" />
            <span aria-hidden="true" className="lp-burger-bar" />
          </button>
        </Container>
        {mounted && (
          <nav
            ref={menuRef}
            id="lp-menu"
            aria-label="Menu"
            className={cn("lp-menu absolute inset-x-0 top-full max-h-[calc(100dvh-var(--spacing-mobile-header))] overflow-y-auto border-t border-line-on-brand bg-brand-navy shadow-floating lg:hidden", show && "lp-open")}
          >
            <Container className="flex flex-col items-start gap-1 py-5">
              {NAV.map(([label, href], i) => (
                <a key={href} href={`${base}${href}`} onClick={close} {...item(i)}>{label}</a>
              ))}
              <Link to="/contact" onClick={close} {...item(NAV.length)}>Contact us</Link>
              <div className="lp-menu-item mt-4 flex w-full max-w-[20rem] flex-col gap-3" style={{ ["--lp-i" as string]: NAV.length + 1 }}>
                {signedIn ? (
                  <ButtonLink to="/start" variant="tonal" fullWidth onClick={close}>Go to dashboard</ButtonLink>
                ) : (
                  <>
                    <ButtonLink to="/register" variant="tonal" fullWidth onClick={close}>Get started</ButtonLink>
                    <ButtonLink to="/login" variant="secondary" fullWidth onClick={close}>Sign in</ButtonLink>
                  </>
                )}
              </div>
            </Container>
          </nav>
        )}
      </header>
    </>
  );
}

export function Footer() {
  const signup = useNewsletterSignup();
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const base = useSectionBase();
  const linkClass = "inline-flex min-h-11 items-center text-body text-ink-on-brand-muted hover:text-ink-on-brand";
  return (
    <footer className="bg-brand-navy text-ink-on-brand">
      <Container className="grid grid-cols-[minmax(0,1fr)] gap-10 py-12 md:grid-cols-2">
        <div>
          <Logo tone="on-brand" size="panel" />
          <p className="mt-4 max-w-[26rem] text-body text-ink-on-brand-muted">Run your whole business in one place: sales, inventory, invoices, your online store, customers and payouts.</p>
          <nav aria-label="Footer" className="mt-6 flex flex-wrap gap-x-6 gap-y-1">
            {(useAuth().status === "authenticated" ? ([["Go to dashboard", "/start"], ["Reviews", "/reviews"]] as const) : ([["Sign in", "/login"], ["Create an account", "/register"], ["Reviews", "/reviews"]] as const)).map(([l, to]) => (
              <Link key={to} to={to} className={linkClass}>{l}</Link>
            ))}
            <a href={`${base}#faq`} className={linkClass}>FAQ</a>
            <Link to="/contact" className={linkClass}>Contact us</Link>
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

/** Skip link + navbar + main + footer, for public pages. */
export function PublicLayout({ children, className, rootRef }: { children: ReactNode; className?: string; rootRef?: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={rootRef} className={cn("lp-root min-h-dvh bg-surface-page font-sans text-ink-strong", className)}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface-card focus:px-4 focus:py-2">Skip to content</a>
      <NavBar />
      <main id="main">{children}</main>
      <Footer />
      <FeliGuestChat />
    </div>
  );
}
