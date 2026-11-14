import { IconDeviceMobile, IconPlus, IconQrcode, IconNumbers, IconBrandApple, IconBrandGooglePlay } from "@tabler/icons-react";

// Step-by-step help for setting up an authenticator app (two-step sign-in).
// Shown on the set-up screen; the same steps are in the invite email.

const STEPS = [
  {
    icon: IconDeviceMobile,
    title: "Install an authenticator app",
    body: (
      <>
        On your phone, install <strong>Google Authenticator</strong> or <strong>Microsoft Authenticator</strong> (both free). Already use one, like 1Password or Authy? That works too.
        <span className="mt-2 flex flex-wrap gap-2">
          <a className="inline-flex items-center gap-1 rounded-md bg-surface-card px-2 py-1 text-body-sm font-semibold text-ink-brand" href="https://apps.apple.com/app/google-authenticator/id388497605" target="_blank" rel="noreferrer noopener">
            <IconBrandApple aria-hidden="true" className="size-4" /> App Store
          </a>
          <a className="inline-flex items-center gap-1 rounded-md bg-surface-card px-2 py-1 text-body-sm font-semibold text-ink-brand" href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2" target="_blank" rel="noreferrer noopener">
            <IconBrandGooglePlay aria-hidden="true" className="size-4" /> Google Play
          </a>
        </span>
      </>
    ),
  },
  { icon: IconPlus, title: "Add a new code", body: <>Open the app and tap the <strong>+</strong> button (Google Authenticator: <em>+ → Scan a QR code</em>; Microsoft Authenticator: <em>+ → Other account</em>).</> },
  { icon: IconQrcode, title: "Scan the QR code", body: <>Point your phone's camera at the QR code on this page. "BiManage Admin" appears in the app with your email.</> },
  { icon: IconNumbers, title: "Type the 6-digit code", body: <>The app shows a new 6-digit code every 30 seconds. Type the current one below. Next, you'll save 10 recovery codes in case you lose your phone.</> },
];

export function AuthenticatorGuide({ open = false }: { open?: boolean }) {
  return (
    <details open={open} className="rounded-xl border border-line-card bg-surface-pale p-4">
      <summary className="cursor-pointer text-body-lg font-semibold text-ink-brand">New to authenticator apps? Step-by-step help</summary>
      <ol className="mt-3 flex flex-col gap-3">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-navy text-ink-on-brand" aria-hidden="true">
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 text-body-sm text-ink-strong">
              <p className="font-semibold">
                {i + 1}. {title}
              </p>
              <p className="mt-0.5 text-ink-secondary">{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
