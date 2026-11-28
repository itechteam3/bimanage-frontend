import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { IconArchive, IconBuildingStore, IconLayoutGrid, IconPackages, IconShoppingBag, IconTruckDelivery } from "@tabler/icons-react";
import { Button, ButtonLink, Spinner, Status } from "@/components/ui";
import { AuthNote } from "@/components/layout/AuthLayout";
import { ChannelArt, ChoiceCard, FeatureCard, InfoTile, Notice, WorkSurface } from "@/components/page/Surface";
import { ApiError } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errorMessage";
import { useChooseChannels, useSellingChannels, type ChannelChoice } from "@/lib/workspace/channels";

// Onboarding: how will the business sell? (Figma 4216:677 "Choose selling
// channels", 4216:825 "Retail and wholesale explained", 4216:961 "Both
// channels, one business"; mobile 4216:798 / 4216:940 / 4216:1080).
// One account, one shared stock balance; channels can change later in
// Settings → Selling channels.

const NEXT = "/onboarding/business";
const icon = "size-7";

const LABEL: Record<ChannelChoice, string> = {
  retail: "Continue with retail",
  wholesale: "Continue with wholesale",
  both: "Continue with both channels",
};

function Loading() {
  return (
    <div className="flex justify-center py-16 text-ink-brand" role="status">
      <Spinner className="size-8" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function ChooseChannelsPage() {
  const navigate = useNavigate();
  const channels = useSellingChannels();
  const choose = useChooseChannels();
  const [choice, setChoice] = useState<ChannelChoice>("both");
  const [error, setError] = useState<string | null>(null);

  // Already chosen (or set up before channels existed): carry on with the setup.
  const chosen = channels.data?.channels.chosen;
  useEffect(() => {
    if (chosen) navigate(NEXT, { replace: true });
  }, [chosen, navigate]);

  if (channels.isLoading) return <Loading />;

  const submit = async () => {
    setError(null);
    try {
      await choose.mutateAsync(choice);
      navigate(choice === "both" ? "/onboarding/channels/both" : NEXT);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) return navigate(NEXT, { replace: true });
      setError(errorMessage(err, "We couldn't save your choice. Check your connection and try again."));
    }
  };

  return (
    <WorkSurface title="Choose selling channels" lead="One business account. Choose how you want to sell today. You can add or change channels later.">
      <fieldset className="grid grid-cols-[minmax(0,1fr)] gap-[14px] lg:grid-cols-3">
        <legend className="sr-only">How will you sell?</legend>
        <ChoiceCard name="channels" value="retail" checked={choice === "retail"} onChange={(v) => setChoice(v as ChannelChoice)} title="Retail" body="Sell individual products to everyday customers." tag="Shopfront • single-item sales" />
        <ChoiceCard name="channels" value="wholesale" checked={choice === "wholesale"} onChange={(v) => setChoice(v as ChannelChoice)} title="Wholesale" body="Sell products in bulk to resellers or organisations." tag="Bulk orders • tiered pricing" />
        <ChoiceCard name="channels" value="both" checked={choice === "both"} onChange={(v) => setChoice(v as ChannelChoice)} title="Both" body="Run retail and wholesale together in one account." tag="Recommended for flexible businesses" />
      </fieldset>
      <Notice title="One account. Shared business history.">You can activate or pause either selling channel without deleting products, customers or past orders.</Notice>
      {error && <AuthNote tone="danger">{error}</AuthNote>}
      <div className="flex flex-col gap-6">
        <Button onClick={() => void submit()} loading={choose.isPending} loadingText="Saving…" className="w-full lg:h-[63px]! lg:w-[405px]">
          {LABEL[choice]}
        </Button>
        <p className="text-caption text-ink-muted">
          You can update your selection later in Settings → Selling channels.{" "}
          <Link to="/onboarding/channels/explained" className="font-semibold text-ink-brand hover:underline">
            How retail and wholesale differ
          </Link>
        </p>
      </div>
      <FeatureCard
        eyebrow="Channel choice  /  Start / Select"
        title="Choose a channel that fits your business"
        art={<ChannelArt icons={[<IconBuildingStore className={icon} stroke={1.5} />, <IconArchive className={icon} stroke={1.5} />, <IconLayoutGrid className={icon} stroke={1.5} />]} />}
      >
        Start with Retail, Wholesale or Both. Your account, customers and sales history remain with you when your model evolves.
      </FeatureCard>
    </WorkSurface>
  );
}

export function ChannelsExplainedPage() {
  return (
    <WorkSurface tone="aqua" title="Retail and wholesale explained" lead="Understand each selling channel before setting up your business.">
      <InfoTile title="Retail selling" body="Built for individual orders, regular checkout, promotional pricing and a public storefront." tag="Best for stores selling directly to consumers" />
      <InfoTile title="Wholesale selling" body="Built for minimum order quantities, buyer relationships, bulk pricing and large orders." tag="Best for businesses selling in volume" />
      <Notice tone="blue" title="Buying wholesale is different from selling wholesale.">
        Anyone can source through BiSupplyNet when eligible. A wholesale selling channel enables you to sell products in bulk.
      </Notice>
      <ButtonLink to="/onboarding/channels" className="w-full lg:w-[400px]">
        Choose my selling channels
      </ButtonLink>
      <FeatureCard
        tone="aqua"
        eyebrow="How it works  /  Learn / Compare"
        title="Sourcing and selling are different actions"
        art={<ChannelArt tone="aqua" icons={[<IconTruckDelivery className={icon} stroke={1.5} />, <IconPackages className={icon} stroke={1.5} />, <IconShoppingBag className={icon} stroke={1.5} />]} />}
      >
        BiSupplyNet helps eligible businesses buy supplies. Activating a wholesale selling channel lets you offer bulk prices, minimum quantities and trade orders.
      </FeatureCard>
    </WorkSurface>
  );
}

export function BothChannelsPage() {
  const channels = useSellingChannels();
  if (channels.isLoading) return <Loading />;
  // Only for businesses that chose both.
  if (channels.data && channels.data.channels.mode !== "both") return <Navigate to={NEXT} replace />;
  const active = <Status tone="success">Active</Status>;
  return (
    <WorkSurface tone="violet" title="Both channels, one business" lead="Sell to everyday customers and bulk buyers while managing the business from one workspace.">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-[14px] lg:grid-cols-2">
        <InfoTile title="Retail channel" badge={active} body="Customer orders • individual pricing • public store" tag="Connected to shared stock" />
        <InfoTile title="Wholesale channel" badge={active} body="Bulk buyer orders • quantity-based pricing" tag="Connected to shared stock" />
      </div>
      <Notice title="One product catalogue, one stock balance">Channel-specific prices and minimum quantities are separate; inventory and business history remain connected.</Notice>
      <Notice tone="blue" title="Grow without starting over">Keep the same sign-in, subscription and historical records if your business changes how it sells.</Notice>
      <ButtonLink to={NEXT} className="w-full lg:h-[63px]! lg:w-[400px]">
        Continue to business setup
      </ButtonLink>
      <FeatureCard
        tone="violet"
        eyebrow="Shared stock  /  Connect / Grow"
        title="One workspace, connected operations"
        art={<ChannelArt tone="violet" icons={[<IconBuildingStore className={icon} stroke={1.5} />, <IconArchive className={icon} stroke={1.5} />, <IconLayoutGrid className={icon} stroke={1.5} />]} />}
      >
        Your product catalogue and stock availability are shared; retail checkout and wholesale ordering keep separate prices, quantities and selling rules.
      </FeatureCard>
    </WorkSurface>
  );
}
