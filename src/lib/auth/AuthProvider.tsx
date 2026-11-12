import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { tokenStore } from "./tokenStore";
import { authApi, type User, type Workspace } from "./api";
import { apiEvents } from "@/lib/api/events";
import { ApiError } from "@/lib/api/client";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

/** Why the user was signed out, shown on the sign-in screen. */
export type SignOutReason = "expired" | "suspended" | "signed-out" | null;

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  workspace: Workspace | null;
  signOutReason: SignOutReason;
  /** Store a session token from login, email verification or Google, then load the user. */
  signIn: (token: string) => Promise<User>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(() => (tokenStore.get() ? "loading" : "anonymous"));
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [signOutReason, setSignOutReason] = useState<SignOutReason>(null);
  // Cached server data belongs to one account: drop it whenever the account
  // changes, so nothing from a previous sign-in can show for the next person.
  const queryClient = useQueryClient();
  const userId = useRef<string | null>(null);

  const clear = useCallback((reason: SignOutReason) => {
    tokenStore.clear();
    userId.current = null;
    queryClient.clear();
    setUser(null);
    setWorkspace(null);
    setStatus("anonymous");
    setSignOutReason(reason);
  }, [queryClient]);

  const load = useCallback(async (token: string) => {
    const [me, ws] = await Promise.all([authApi.me(token), authApi.workspace(token).catch(() => null)]);
    if (userId.current !== me._id) {
      if (userId.current !== null) queryClient.clear();
      userId.current = me._id;
    }
    setUser(me);
    setWorkspace(ws);
    setStatus("authenticated");
    setSignOutReason(null);
    return me;
  }, [queryClient]);

  const signIn = useCallback(
    async (token: string) => {
      tokenStore.set(token);
      try {
        return await load(token);
      } catch (err) {
        clear(null);
        throw err;
      }
    },
    [load, clear]
  );

  const signOut = useCallback(async () => {
    try {
      await authApi.logout(); // blacklists the token on the server
    } catch {
      /* signing out locally is what matters */
    }
    clear("signed-out");
  }, [clear]);

  const refresh = useCallback(async () => {
    const token = tokenStore.get();
    if (token) await load(token);
  }, [load]);

  // Restore a saved session on first load.
  useEffect(() => {
    const token = tokenStore.get();
    if (!token) return;
    load(token).catch((err) => {
      // A network failure keeps the token (the server may be waking). A 401/403
      // was already handled by the session-expired/suspended signal (which set
      // the reason shown on sign-in); anything else signs out quietly.
      if (err instanceof ApiError && err.kind !== "http") setStatus("anonymous");
      else if (err instanceof ApiError && (err.status === 401 || err.status === 403)) setStatus("anonymous");
      else clear(null);
    });
  }, [load, clear]);

  // Global signals from the API client. Ignored when nobody is signed in
  // (an anonymous page calling a protected endpoint isn't an expiry).
  const statusRef = useRef(status);
  statusRef.current = status;
  useEffect(() => {
    const offExpired = apiEvents.on("session-expired", () => {
      if (statusRef.current !== "anonymous") clear("expired");
    });
    const offSuspended = apiEvents.on("suspended", () => clear("suspended"));
    return () => {
      offExpired();
      offSuspended();
    };
  }, [clear]);

  // Keep tabs in step: signing out (or in as someone else) in one tab
  // applies to every open tab of the app.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== tokenStore.key && e.key !== null) return;
      const token = tokenStore.get();
      if (!token) {
        if (statusRef.current !== "anonymous") clear("signed-out");
      } else if (e.newValue && e.newValue !== e.oldValue) {
        load(token).catch(() => clear("expired"));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [clear, load]);

  const value = useMemo(
    () => ({ status, user, workspace, signOutReason, signIn, signOut, refresh }),
    [status, user, workspace, signOutReason, signIn, signOut, refresh]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
