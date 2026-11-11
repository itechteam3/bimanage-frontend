import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconBolt, IconLock } from "@tabler/icons-react";
import { apiEvents, type UpgradeReason } from "@/lib/api/events";
import { Button, Dialog } from "@/components/ui";

// One dialog for every "your plan can't do this" answer from the API:
// plan-gated features (07.07 / 11.04), daily credits (07.07 / 11.03) and the
// FELI daily message limit. Screens never need to handle these 403s.
const formatReset = (iso?: string) => {
  if (!iso) return "at midnight";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "at midnight" : `at ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
};

export function UpgradeDialog() {
  const [reason, setReason] = useState<UpgradeReason | null>(null);
  const navigate = useNavigate();

  useEffect(() => apiEvents.on("upgrade-required", setReason), []);

  if (!reason) return null;
  const close = () => setReason(null);

  const content =
    reason.kind === "credits"
      ? {
          title: "You've used today's credits",
          body: `Free plans include 100 credits a day. Yours reset ${formatReset(reason.resetsAt)}. Upgrade for unlimited use.`,
          icon: <IconBolt className="size-7" />,
        }
      : reason.kind === "feli-limit"
        ? {
            title: "FELI's daily limit reached",
            body: `Free plans get ${reason.dailyLimit ?? 20} FELI messages a day. Upgrade to Standard for unlimited messages.`,
            icon: <IconBolt className="size-7" />,
          }
        : {
            title: "Upgrade to unlock this",
            body: reason.message || "This feature isn't included in your current plan.",
            icon: <IconLock className="size-7" />,
          };

  return (
    <Dialog
      open
      onClose={close}
      title={content.title}
      description={content.body}
      icon={content.icon}
      actions={
        <>
          <Button variant="outlined" onClick={close}>
            Not now
          </Button>
          <Button
            onClick={() => {
              close();
              navigate("/subscription");
            }}
          >
            See plans
          </Button>
        </>
      }
    />
  );
}
