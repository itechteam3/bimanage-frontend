import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

// Selling channels (backend #115/#116): a business sells retail, wholesale or
// both from one account and one shared stock balance.

export type ChannelId = "retail" | "wholesale";
export type ChannelStatus = "active" | "paused" | "available";
export type ChannelMode = "retail" | "wholesale" | "both" | "none";
export type ChannelChoice = "retail" | "wholesale" | "both";

export interface ChannelState {
  status: ChannelStatus;
  activatedAt: string | null;
  pausedAt: string | null;
}

export interface SellingChannels {
  retail: ChannelState;
  wholesale: ChannelState;
  mode: ChannelMode;
  chosen: boolean;
}

export const channelKeys = { all: ["selling-channels"] as const };

export function useSellingChannels(enabled = true) {
  return useQuery({
    queryKey: channelKeys.all,
    queryFn: () => api<{ channels: SellingChannels; isOwner: boolean }>("/selling-channels"),
    enabled,
    staleTime: 60_000,
  });
}

/** Onboarding: "How will you sell?" (once). */
export function useChooseChannels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channels: ChannelChoice) => api<{ channels: SellingChannels; message: string }>("/selling-channels/choose", { method: "POST", body: { channels } }),
    onSuccess: (r) => {
      qc.setQueryData(channelKeys.all, (old: { isOwner: boolean } | undefined) => ({ isOwner: old?.isOwner ?? true, channels: r.channels }));
      void qc.invalidateQueries({ queryKey: ["subscription"] });
    },
  });
}

export const isOn = (c: SellingChannels | undefined, id: ChannelId) => c?.[id]?.status === "active";

// Switching channels on, off and back on (backend #116). Owner only.
export interface ChannelBlockers {
  activeOrders: number;
  unsettledPayments: number;
  openDisputes: number;
}
export interface DeactivationCheck {
  channel: ChannelId;
  status: ChannelStatus;
  blockers: ChannelBlockers;
  lastChannel: boolean;
  canDeactivate: boolean;
}

export function useDeactivationCheck(channel: ChannelId | undefined) {
  return useQuery({
    queryKey: [...channelKeys.all, "check", channel],
    queryFn: () => api<DeactivationCheck>(`/selling-channels/${channel}/deactivation-check`),
    enabled: Boolean(channel),
    staleTime: 0,
    gcTime: 0,
  });
}

export type ChannelAction = "activate" | "deactivate" | "reactivate";

export function useSwitchChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ channel, action }: { channel: ChannelId; action: ChannelAction }) =>
      api<{ channels: SellingChannels; message: string }>(`/selling-channels/${channel}/${action}`, { method: "POST" }),
    onSuccess: (r) => {
      qc.setQueryData(channelKeys.all, (old: { isOwner: boolean } | undefined) => ({ isOwner: old?.isOwner ?? true, channels: r.channels }));
      void qc.invalidateQueries({ queryKey: ["subscription"] });
    },
  });
}

export const CHANNEL_LABEL: Record<ChannelId, string> = { retail: "Retail", wholesale: "Wholesale" };
export const STATUS_LABEL: Record<ChannelStatus, string> = { active: "Active", paused: "Turned off", available: "Available to activate" };
