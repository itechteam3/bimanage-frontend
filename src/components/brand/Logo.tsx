import { cn } from "@/lib/cn";
import wordmarkWhite from "@/assets/brand/bimanage-logo-white.png";
import wordmarkNavy from "@/assets/brand/bimanage-logo-navy.png";
import markWhite from "@/assets/brand/bimanage-mark-white.png";
import markNavy from "@/assets/brand/bimanage-mark-navy.png";

// The official BiManage logo (Figma "Approved Brand Identity": the white
// wordmark for dark backgrounds, the standalone mark for mobile headers).
// `tone="on-brand"` on navy; `"brand"` on light backgrounds; `compact` = mark only.
//
// The logo ALWAYS keeps its own proportions (Figma image fill: FIT). Only one
// dimension is set per size; the other is auto. `self-start` stops a flex
// column from stretching it, and `object-contain` means that even if a parent
// forces the box, the picture inside is never distorted.
//
// Sizes, from the Figma frames (logo fitted inside each box):
//   panel   — auth side panels, 160×64 box  → 160 wide (≈ 47 high)
//   sidebar — app/admin sidebar, 171×34 box → 34 high  (≈ 116 wide)
//   header  — mobile header mark, 52×52 box → 52 high  (≈ 47 wide)
export type LogoSize = "panel" | "sidebar" | "header";

const SIZE: Record<LogoSize, string> = {
  panel: "w-40 h-auto",
  sidebar: "h-8.5 w-auto",
  header: "h-13 w-auto",
};

export function Logo({
  tone = "brand",
  compact = false,
  size,
  className,
}: {
  tone?: "brand" | "on-brand";
  compact?: boolean;
  size?: LogoSize;
  className?: string;
}) {
  const white = tone === "on-brand";
  const s = size ?? (compact ? "header" : "sidebar");
  const src = compact ? (white ? markWhite : markNavy) : white ? wordmarkWhite : wordmarkNavy;
  // width/height attributes are the image's natural size: the browser uses them
  // only to reserve the right shape while loading (CSS sets the real size).
  const natural = compact ? { width: 118, height: 130 } : { width: 300, height: 88 };
  return (
    <img
      src={src}
      alt="BiManage"
      {...natural}
      data-logo-size={s}
      // Wordmarks sit in flex columns (side panels): self-start stops the stretch.
      // The header mark sits in a centred flex row, so it keeps the row's alignment.
      className={cn("block max-w-full shrink-0 object-contain object-left select-none", s !== "header" && "self-start", SIZE[s], className)}
      draggable={false}
    />
  );
}
