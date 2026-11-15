import { PERMISSION_FALLBACK } from "@/config/customers";

/**
 * A role's answer for one permission. Keys the role payload doesn't carry
 * yet (newer permissions) fall back to their equivalent (config/customers.ts).
 * `undefined` = the role says nothing either way.
 */
export function permissionValue(permissions: Record<string, boolean | undefined> | undefined, permission: string): boolean | undefined {
  const perms = permissions ?? {};
  const own = perms[permission];
  if (typeof own === "boolean") return own;
  const fb = PERMISSION_FALLBACK[permission];
  if (!fb) return undefined;
  const other = perms[fb.key];
  return typeof other === "boolean" ? other : fb.whenMissing;
}
