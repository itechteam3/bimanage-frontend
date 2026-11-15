import { useAuth } from "@/lib/auth/AuthProvider";
import { permissionValue } from "@/lib/auth/permissions";
import { useSubscription } from "@/lib/workspace/subscription";
import { featureAccess } from "@/config/plans";
import type { NavItem, Permission } from "@/config/navigation";

export type NavState = "visible" | "locked" | "hidden";

/**
 * Whether a section shows in the sidebar and the More menu:
 * - hidden: owner-only for team members, or the role lacks the permission
 *   (with a list: lacks all of them);
 * - locked: the plan doesn't include it (shown with a lock; the page itself
 *   explains the upgrade);
 * - visible otherwise. While the plan is loading nothing is locked.
 */
export function useNavState(): (item: NavItem) => NavState {
  const { workspace } = useAuth();
  const sub = useSubscription();
  const isOwner = !workspace || workspace.role === "owner";
  return (item) => {
    if (item.ownerOnly && !isOwner) return "hidden";
    const perms = item.permission ? ([] as Permission[]).concat(item.permission) : [];
    if (!isOwner && perms.length && workspace && perms.every((p) => permissionValue(workspace.permissions, p) === false)) return "hidden";
    if (item.feature && sub.data) {
      const access = sub.data.features?.[item.feature] ?? featureAccess(sub.data, item.feature);
      if (access === false) return "locked";
    }
    return "visible";
  };
}
