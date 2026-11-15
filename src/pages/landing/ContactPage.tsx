import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IconCircleCheck, IconMail } from "@tabler/icons-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, SelectInput, TextArea, TextInput } from "@/components/ui/Field";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { ApiError } from "@/lib/api/client";
import { SUPPORT_EMAIL } from "@/config/links";
import { useContactRequest, type ContactTopic } from "@/lib/landing/api";
import { Container, PublicLayout } from "./PublicLayout";

// Public contact page (/contact): works signed in or out. POST /public/contact.

const TOPICS: Array<[ContactTopic, string]> = [
  ["demo", "Book a demo"],
  ["sales", "Plans and pricing"],
  ["support", "Help with my account"],
  ["partnership", "Partnership"],
  ["other", "Something else"],
];
const isTopic = (v: string | null): v is ContactTopic => TOPICS.some(([t]) => t === v);

type Form = { name: string; email: string; phone: string; company: string; topic: ContactTopic; message: string; website: string };
type Errors = Partial<Record<keyof Form, string>>;

function validate(f: Form): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = "Enter your name.";
  if (!f.email.trim()) e.email = "Enter your email address.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "Enter a valid email address.";
  const m = f.message.trim().length;
  if (m < 10) e.message = "Tell us a little more (at least 10 characters).";
  else if (m > 2000) e.message = "Keep your message under 2,000 characters.";
  return e;
}

export default function ContactPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialTopic = params.get("topic");
  const send = useContactRequest();
  const [form, setForm] = useState<Form>({ name: "", email: "", phone: "", company: "", topic: isTopic(initialTopic) ? initialTopic : "demo", message: "", website: "" });
  const [errors, setErrors] = useState<Errors>({});
  const set = (k: keyof Form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  // A 400 names the field the server rejected; show it on that field too.
  const serverField = send.error instanceof ApiError && send.error.status === 400 ? String(send.error.data.field ?? "") : "";
  const fieldError = (k: keyof Form) => errors[k] ?? (serverField === k && send.error ? send.error.message : undefined);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    send.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      company: form.company.trim() || undefined,
      phone: form.phone.trim() || undefined,
      topic: form.topic,
      message: form.message.trim(),
      website: form.website,
    });
  };

  const back = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/");
  };

  return (
    <PublicLayout>
      <section className="bg-surface-page py-12 md:py-16 lg:py-20">
        <Container className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-12">
          <div>
            <h1 className="text-title-lg text-ink-strong md:text-page-title">Contact us</h1>
            <p className="mt-3 text-body-lg text-ink-muted">
              Questions about BiManage, a demo for your team, or help with your account? Send us a message and we'll reply by email.
            </p>
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-line-card bg-surface-card p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-tint-blue text-ink-brand" aria-hidden="true">
                <IconMail className="size-5" />
              </span>
              <p className="min-w-0 text-body text-ink-muted">
                Prefer email?{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="break-all font-semibold text-ink-brand underline underline-offset-2">{SUPPORT_EMAIL}</a>
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-line-card bg-surface-card p-5 shadow-card md:p-8">
            {send.isSuccess ? (
              <div role="status" className="flex flex-col items-start gap-4">
                <span className="flex size-12 items-center justify-center rounded-full bg-success-bg text-success" aria-hidden="true">
                  <IconCircleCheck className="size-7" />
                </span>
                <h2 className="text-title-sm text-ink-strong">Message sent</h2>
                <p className="text-body-lg text-ink-muted">{send.data.message}</p>
                <div className="mt-2 flex w-full flex-col-reverse gap-3 md:flex-row md:[&>*]:flex-1">
                  <Button variant="secondary" onClick={() => { send.reset(); setForm((f) => ({ ...f, message: "" })); }}>Send another message</Button>
                  <ButtonLink to="/">Back to home</ButtonLink>
                </div>
              </div>
            ) : (
              <form noValidate onSubmit={submit} className="flex flex-col gap-4" aria-label="Contact form">
                <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
                  <Field label="Your name" required error={fieldError("name")}><TextInput value={form.name} onChange={set("name")} autoComplete="name" maxLength={80} /></Field>
                  <Field label="Email" required error={fieldError("email")}><TextInput type="email" value={form.email} onChange={set("email")} autoComplete="email" /></Field>
                  <Field label="Phone (optional)" error={fieldError("phone")}><TextInput type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" maxLength={30} /></Field>
                  <Field label="Business name (optional)" error={fieldError("company")}><TextInput value={form.company} onChange={set("company")} autoComplete="organization" maxLength={100} /></Field>
                </div>
                <Field label="What can we help with?" required error={fieldError("topic")}>
                  <SelectInput value={form.topic} onChange={set("topic")}>{TOPICS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</SelectInput>
                </Field>
                <Field label="Message" required hint="At least 10 characters." error={fieldError("message")}>
                  <TextArea rows={5} value={form.message} onChange={set("message")} maxLength={2000} />
                </Field>
                {/* Honeypot: hidden from people and assistive tech. */}
                <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={set("website")} className="absolute left-[-9999px] h-px w-px opacity-0" />
                <ErrorNote error={send.error} fallback="We couldn't send your message. Please try again." />
                <div className="mt-2 flex flex-col-reverse gap-3 md:flex-row md:[&>*]:flex-1">
                  <Button type="button" variant="secondary" onClick={back}>Back</Button>
                  <Button type="submit" loading={send.isPending} loadingText="Sending…">Send message</Button>
                </div>
              </form>
            )}
          </div>
        </Container>
      </section>
    </PublicLayout>
  );
}
