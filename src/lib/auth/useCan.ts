import { useAuth } from "./AuthProvider";
import type { Permission } from "@/config/navigation";

/** Whether the signed-in person may do this in the current business (the server enforces it too). */
export function useCan(permission: Permission): boolean {
  const { workspace } = useAuth();
  if (!workspace || workspace.role === "owner") return true;
  return Boolean(workspace.permissions[permission]);
}
