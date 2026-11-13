import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconCamera } from "@tabler/icons-react";
import { Avatar, Button, Field, TextInput } from "@/components/ui";
import { PageTitle, Panel } from "@/components/page/Blocks";
import { AuthNote } from "@/components/layout/AuthLayout";
import { PhotoDialog } from "@/components/profile/PhotoDialog";
import { useAuth } from "@/lib/auth/AuthProvider";
import { updateProfile } from "@/lib/auth/profile";
import { applyFieldErrors } from "@/lib/api/errorMessage";
import { ErrorNote } from "@/components/feedback/ErrorNote";
import { useLeaveGuard } from "@/lib/nav/useLeaveGuard";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name (at least 2 characters).").max(60),
  username: z
    .string()
    .trim()
    .max(30, "Use 30 characters or fewer.")
    .refine((v) => !v || /^[A-Za-z0-9]{3,}$/.test(v), "Use at least 3 letters or numbers, no spaces."),
  phone: z.string().trim().max(20, "Use 20 characters or fewer."),
});
type Values = z.infer<typeof schema>;

// Settings → Profile: photo, name, username, phone.
export function ProfilePage() {
  const { user, refresh } = useAuth();
  const [photoOpen, setPhotoOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);
  const { register, handleSubmit, reset, setError, formState } = useForm<Values>({ resolver: zodResolver(schema) });
  const guard = useLeaveGuard(formState.isDirty);

  useEffect(() => {
    if (user) reset({ name: user.name ?? "", username: user.username ?? "", phone: user.phone ?? "" }, { keepDirtyValues: true });
  }, [user, reset]);

  const onSubmit = handleSubmit(async (v) => {
    setSaved(false);
    setFormError(null);
    try {
      await updateProfile(Object.fromEntries(Object.entries(v).filter(([, x]) => x !== "")));
      await refresh();
      reset(v);
      setSaved(true);
    } catch (err) {
      if (!applyFieldErrors(err, setError, ["name", "username", "phone"])) setFormError(err);
    }
  });

  return (
    <div className="flex flex-col gap-6">
      {guard.dialog}
      <PageTitle>Profile</PageTitle>
      <p className="-mt-4 text-body-sm text-ink-muted">How you appear to your team and customers.</p>

      <Panel title="Profile photo" subtitle="JPG, PNG or WebP. You'll crop it to a square.">
        <div className="flex flex-wrap items-center gap-5">
          <Avatar name={user?.name} src={user?.avatar} size="large" />
          <Button variant="secondary" size="md" onClick={() => setPhotoOpen(true)}>
            <IconCamera aria-hidden="true" className="size-icon" /> {user?.avatar ? "Change or remove photo" : "Add a photo"}
          </Button>
        </div>
      </Panel>

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <Panel title="Personal details">
          <div className="grid gap-4 md:grid-cols-2 md:gap-x-10 md:gap-y-6">
            <Field label="Full name" required error={formState.errors.name?.message}>
              <TextInput autoComplete="name" {...register("name")} />
            </Field>
            <Field label="Email" hint="Your sign-in email can't be changed here.">
              <TextInput value={user?.email ?? ""} readOnly disabled />
            </Field>
            <Field label="Username" error={formState.errors.username?.message}>
              <TextInput autoComplete="username" autoCapitalize="none" {...register("username")} />
            </Field>
            <Field label="Phone" error={formState.errors.phone?.message}>
              <TextInput type="tel" autoComplete="tel" placeholder="+234 803 000 0000" {...register("phone")} />
            </Field>
          </div>
        </Panel>
        <ErrorNote error={formError} fallback="We couldn't save your profile. Check your connection and try again." onRetry={() => void onSubmit()} />
        {saved && !formState.isDirty && <AuthNote tone="success">Profile saved.</AuthNote>}
        <Button type="submit" className="self-end" loading={formState.isSubmitting} loadingText="Saving…">
          Save profile
        </Button>
      </form>
      <PhotoDialog open={photoOpen} onClose={() => setPhotoOpen(false)} />
    </div>
  );
}
