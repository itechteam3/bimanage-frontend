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
