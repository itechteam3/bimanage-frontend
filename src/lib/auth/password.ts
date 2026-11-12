import { z } from "zod";

// Figma: "Use 8+ characters with mixed character types" (01.02, 01.05).
// The backend only enforces 8+, so the "mixed types" rule is checked here.
export const MIN_PASSWORD = 8;

export const characterTypes = (pw: string) =>
  [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;

export type Strength = { level: 0 | 1 | 2 | 3; label: string; meetsRequirements: boolean };

export function passwordStrength(pw: string): Strength {
  if (!pw) return { level: 0, label: "", meetsRequirements: false };
  const types = characterTypes(pw);
  const meets = pw.length >= MIN_PASSWORD && types >= 2;
  if (!meets) return { level: 1, label: "Too weak", meetsRequirements: false };
  if (pw.length >= 12 && types >= 3) return { level: 3, label: "Strong", meetsRequirements: true };
  return { level: 2, label: "Good", meetsRequirements: true };
}

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(MIN_PASSWORD, "Use at least 8 characters.")
      .refine((pw) => characterTypes(pw) >= 2, "Mix character types — e.g. letters and numbers."),
    confirm: z.string().min(1, "Repeat your password."),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Passwords do not match. Re-enter your password.",
  });
