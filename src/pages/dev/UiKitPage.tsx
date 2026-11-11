import { useState } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { IconCheck, IconPlus, IconSparkles, IconTrash } from "@tabler/icons-react";
import {
  Button,
  Card,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  InfoCard,
  MetricCard,
  OtpInput,
  PasswordInput,
  Status,
  TextInput,
} from "@/components/ui";
import { AppShell } from "@/components/layout/AppShell";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { apiEvents } from "@/lib/api/events";

// Living reference for the design system (Phase 1). Compare against
// Figma "00 — Design System" and the screen PNGs in docs/figma/.
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-4">
    <h2 className="text-section-title text-ink-strong">{title}</h2>
    {children}
  </section>
);

function Gallery() {
  const [otp, setOtp] = useState("");
  const [dialog, setDialog] = useState(false);
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-5 py-8 lg:px-10">
      <header className="flex flex-col gap-2">
        <p className="text-body-sm font-semibold uppercase text-ink-brand">BiManage design system</p>
        <h1 className="text-page-title">Components</h1>
        <nav className="flex gap-4 text-body-sm font-semibold text-ink-brand">
          <Link to="auth">Auth layout →</Link>
          <Link to="app">App shell →</Link>
        </nav>
      </header>

      <Section title="Buttons (2154:205)">
        <div className="grid gap-3 md:grid-cols-3">
          <Button>Continue</Button>
          <Button variant="tonal">Continue</Button>
          <Button variant="outlined">Go back</Button>
          <Button variant="secondary" size="md">Forgot password?</Button>
          <Button variant="destructive" icon={<IconTrash className="size-icon" />}>Delete item</Button>
          <Button disabled>Unavailable</Button>
          <Button loading>Continue</Button>
          <Button success>Continue</Button>
          <div className="flex gap-3">
            <IconButton label="Add" icon={<IconPlus className="size-icon" />} />
            <IconButton label="Add (disabled)" disabled icon={<IconPlus className="size-icon" />} />
          </div>
        </div>
      </Section>

      <Section title="Fields (1850:1352) — filled on mobile, outlined from lg">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Email address" required>
            <TextInput type="email" placeholder="Enter your email" autoComplete="email" />
          </Field>
          <Field label="Password" required>
            <PasswordInput placeholder="Your password" />
          </Field>
          <Field label="Email address" error="Enter a valid email">
            <TextInput type="email" defaultValue="samuel@" />
          </Field>
          <Field label="Business name" hint="Shown on invoices and your store.">
            <TextInput disabled placeholder="Not available" />
          </Field>
        </div>
      </Section>

      <Section title="OTP input (1930:1422)">
        <Card className="max-w-xl">
          <p className="text-body-sm font-semibold uppercase text-ink-brand">Verify your email</p>
          <p className="mb-4 mt-1 text-card-heading">Enter your six-digit security code</p>
          <OtpInput value={otp} onChange={setOtp} />
          <p className="mt-3 text-body-sm text-ink-muted">Code expires in 10 minutes. Resend when needed.</p>
        </Card>
      </Section>

      <Section title="Status (1850:1361)">
        <div className="flex flex-wrap gap-3">
          <Status tone="success">Success</Status>
          <Status tone="warning">Needs review</Status>
          <Status tone="danger">Payment failed</Status>
          <Status tone="neutral">Pending</Status>
          <Status tone="live">Live</Status>
        </div>
      </Section>

      <Section title="Cards (1917:1431)">
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Net revenue" value="₦1,280,400" change={{ value: "12.8% this month", direction: "up" }} footnote="Compared with the previous month" />
          <InfoCard eyebrow="Online store" title="Your business, open 24/7." body="Publish products and securely accept customer orders without friction." action={{ label: "Open storefront", to: "/ui-kit" }} />
          <EmptyState icon={<IconSparkles className="size-7" />} title="Ready when you are." body="Your next step is one click away." action={<Button size="md" variant="tonal">Get started →</Button>} />
        </div>
      </Section>

      <Section title="Dialog (2186:12052)">
        <div className="flex flex-wrap gap-3">
          <Button variant="outlined" onClick={() => setDialog(true)}>Open dialog</Button>
          <Button
            variant="outlined"
            onClick={() => apiEvents.emit("upgrade-required", { kind: "credits", creditsRemaining: 0, creditsNeeded: 5, message: "" })}
          >
            Simulate “out of credits”
          </Button>
        </div>
        <Dialog
          open={dialog}
          onClose={() => setDialog(false)}
          title="Confirm the next step"
          description="Review what will happen before making this change. Nothing will be submitted until you confirm."
          icon={<IconCheck className="size-7" />}
          actions={
            <>
              <Button variant="outlined" onClick={() => setDialog(false)}>Go back</Button>
              <Button onClick={() => setDialog(false)}>Confirm action</Button>
            </>
          }
        />
      </Section>
    </div>
  );
}

function AuthDemo() {
  return (
    <AuthLayout kicker="Welcome back" title="Sign in to BiManage" subtitle="Access your business workspace securely." footer="Your connection is encrypted.">
      <form className="flex flex-col gap-4 rounded-lg border border-line-default bg-surface-card p-5 lg:gap-5 lg:border-0 lg:bg-transparent lg:p-0" onSubmit={(e) => e.preventDefault()}>
        <Field label="Email address" required>
          <TextInput type="email" autoComplete="email" defaultValue="samuel@elijahapparel.com" />
        </Field>
        <Field label="Password" required hint="Security: repeated incorrect sign-in attempts trigger a temporary cooldown.">
          <PasswordInput defaultValue="password12" />
        </Field>
        <Button type="submit" fullWidth>Sign in</Button>
      </form>
    </AuthLayout>
  );
}

function AppDemo() {
  return (
    <AppShell section="Dashboard" user={{ name: "Samuel Inyima", businessName: "Elijah Apparel" }} unreadCount={3}>
      <h1 className="text-title-lg lg:text-page-title">Business overview</h1>
      <p className="mt-1 text-body text-ink-muted">Revenue, orders and operations at a glance.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Revenue" value="₦198,000" change={{ value: "37.8% this month", direction: "up" }} />
        <MetricCard label="Net sales" value="₦2,400" change={{ value: "2% this month", direction: "down" }} />
        <MetricCard label="Receivables" value="₦89,000" change={{ value: "11% this week", direction: "up" }} />
      </div>
    </AppShell>
  );
}

export default function UiKitPage() {
  return (
    <Routes>
      <Route index element={<Gallery />} />
      <Route path="auth" element={<AuthDemo />} />
      <Route path="app/*" element={<AppDemo />} />
    </Routes>
  );
}
