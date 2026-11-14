import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconPhoto } from "@tabler/icons-react";
import { Button, Field, SelectInput, TextArea, TextInput } from "@/components/ui";
import { Panel } from "@/components/page/Blocks";
import { AuthNote } from "@/components/layout/AuthLayout";
import { BUSINESS_CATEGORIES, BUSINESS_TYPES, useSaveBusinessProfile, useUploadLogo, type BusinessProfile } from "@/lib/workspace/api";
import { applyFieldErrors, errorMessage } from "@/lib/api/errorMessage";
import { useLeaveGuard } from "@/lib/nav/useLeaveGuard";

// The business identity form, shared by onboarding (02.03) and
// Settings → Edit business profile (13.02). `extended` adds the website and
// description that the settings screen also edits.

/** "elijahapparel.com" → "https://elijahapparel.com" (the server wants a full web address). */
export const withScheme = (v: string) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v);

const schema = z.object({
  businessName: z.string().trim().min(2, "Enter your legal business name.").max(100, "Keep it under 100 characters."),
  businessType: z.string().min(1, "Choose your business type."),
  businessCategory: z.string().min(1, "Choose a category."),
  cacNumber: z.string().trim().max(30).optional(),
  businessPhone: z.string().trim().min(7, "Enter a phone number.").max(20, "That phone number looks too long."),
  businessEmail: z.string().trim().min(1, "Enter a business email.").email("Enter a valid email address."),
  businessAddress: z.string().trim().max(200).optional(),
  businessWebsite: z
    .string()
    .trim()
    .max(200)
    .optional()
    .refine((v) => !v || /^(https?:\/\/)?[^\s/]+\.[^\s]{2,}$/i.test(v), "Enter a web address, for example elijahapparel.com."),
  businessDescription: z.string().trim().max(500, "Keep it under 500 characters.").optional(),
});
type Values = z.infer<typeof schema>;
const FIELDS = Object.keys(schema.shape) as Array<keyof Values>;

export function BusinessProfileForm({
  profile,
  title,
  subtitle,
  extended = false,
  submitLabel,
  onSaved,
  children,
}: {
  profile: BusinessProfile | undefined;
  title: string;
  subtitle?: string;
  extended?: boolean;
  submitLabel: string;
  onSaved: () => void;
  /** Shown inside the panel under the fields. */
  children?: ReactNode;
}) {
  const save = useSaveBusinessProfile();
  const upload = useUploadLogo();
  const fileRef = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, formState } = useForm<Values>({ resolver: zodResolver(schema) });
  const guard = useLeaveGuard(formState.isDirty && !formState.isSubmitSuccessful);

  useEffect(() => {
    if (!profile) return;
    const p = profile;
    reset(
      {
        businessName: p.businessName ?? "",
        businessType: p.businessType ?? "",
        businessCategory: p.businessCategory ?? "",
        cacNumber: p.cacNumber ?? "",
        businessPhone: p.businessPhone ?? "",
        businessEmail: p.businessEmail ?? "",
        businessAddress: p.businessAddress ?? "",
        businessWebsite: p.businessWebsite ?? "",
        businessDescription: p.businessDescription ?? "",
      },
      { keepDirtyValues: true }
    );
  }, [profile, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const all = { ...values, businessWebsite: withScheme(values.businessWebsite ?? "") };
    // Onboarding sends only what's filled in; settings can also clear the optional fields.
    const body = extended
      ? all
      : Object.fromEntries(Object.entries(values).filter(([k, v]) => v !== "" && v !== undefined && k !== "businessWebsite" && k !== "businessDescription"));
    try {
      await save.mutateAsync(body);
      guard.allow();
      onSaved();
    } catch (err) {
      if (!applyFieldErrors(err, setError, FIELDS)) setFormError(errorMessage(err, "We couldn't save your business details. Please try again."));
    }
  });

  const onLogo = async (file: File | undefined) => {
    setLogoError(null);
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.type)) return setLogoError("Use a PNG, JPG, WebP or SVG image.");
    if (file.size > 2 * 1024 * 1024) return setLogoError("Keep the logo under 2 MB.");
    try {
      await upload.mutateAsync(file);
    } catch (err) {
      setLogoError(errorMessage(err));
    }
  };

  const logo = profile?.logo;

  return (
    <form noValidate onSubmit={onSubmit} className="flex min-w-0 flex-col gap-5">
      {guard.dialog}
      <Panel title={title} subtitle={subtitle ?? "Required details are marked with an asterisk."}>
        <div className="grid gap-4 md:grid-cols-2 md:gap-x-10 md:gap-y-6">
          <Field label="Legal business name" required error={formState.errors.businessName?.message}>
            <TextInput autoComplete="organization" placeholder="Elijah Apparel Ltd" {...register("businessName")} />
          </Field>
          <Field label="Business type" required error={formState.errors.businessType?.message}>
            <SelectInput {...register("businessType")}>
              <option value="">Choose…</option>
              {BUSINESS_TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Business category" required error={formState.errors.businessCategory?.message}>
            <SelectInput {...register("businessCategory")}>
              <option value="">Choose…</option>
              {BUSINESS_CATEGORIES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="CAC number" error={formState.errors.cacNumber?.message}>
            <TextInput placeholder="RC 1234567" {...register("cacNumber")} />
          </Field>
          <Field label="Phone number" required error={formState.errors.businessPhone?.message}>
            <TextInput type="tel" autoComplete="tel" inputMode="tel" placeholder="+234 803 555 0190" {...register("businessPhone")} />
          </Field>
          <Field label="Email address" required error={formState.errors.businessEmail?.message}>
            <TextInput type="email" autoComplete="email" inputMode="email" placeholder="hello@yourbusiness.com" {...register("businessEmail")} />
          </Field>
          <Field label="Business address" error={formState.errors.businessAddress?.message}>
            <TextInput autoComplete="street-address" placeholder="14 Adebayo St, Yaba" {...register("businessAddress")} />
          </Field>
          {extended && (
            <Field label="Business website" error={formState.errors.businessWebsite?.message}>
              <TextInput type="url" inputMode="url" autoComplete="url" placeholder="elijahapparel.com" {...register("businessWebsite")} />
            </Field>
          )}
          <Field label="Business logo" error={logoError ?? undefined} hint={upload.isPending ? "Uploading…" : logo ? "Logo uploaded." : undefined}>
            <div className="flex items-center gap-3 lg:h-control-lg lg:rounded-sm lg:border lg:border-line-default lg:bg-surface-card lg:pl-2 lg:pr-1.5">
              {logo ? <img src={logo} alt="Current logo" className="size-9 rounded-md object-contain" /> : <IconPhoto aria-hidden="true" className="size-6 text-ink-muted" />}
              <button type="button" onClick={() => fileRef.current?.click()} className="min-w-0 flex-1 text-left text-input font-normal text-ink-strong lg:font-medium" disabled={upload.isPending}>
                {upload.isPending ? "Uploading…" : logo ? "Replace logo" : "Upload brand logo"}
              </button>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" tabIndex={-1} onChange={(e) => void onLogo(e.target.files?.[0])} />
            </div>
          </Field>
          {extended && (
            <Field label="About the business" className="md:col-span-2" error={formState.errors.businessDescription?.message} hint="A sentence or two. Shown on your store and supplier profile.">
              <TextArea rows={3} {...register("businessDescription")} />
            </Field>
          )}
        </div>
        {children}
      </Panel>
      {formError && <AuthNote tone="danger">{formError}</AuthNote>}
      <Button type="submit" className="self-end" loading={formState.isSubmitting} loadingText="Saving…">
        {submitLabel}
      </Button>
    </form>
  );
}
