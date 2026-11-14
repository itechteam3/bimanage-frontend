import { cn } from "@/lib/cn";
import wordmarkWhite from "@/assets/brand/bimanage-logo-white.png";
import wordmarkNavy from "@/assets/brand/bimanage-logo-navy.png";
import markWhite from "@/assets/brand/bimanage-mark-white.png";
import markNavy from "@/assets/brand/bimanage-mark-navy.png";

// The official BiManage logo (Figma "Approved Brand Identity": the white
// wordmark for dark backgrounds, and the standalone mark for the mobile
// header). `tone="on-brand"` on the navy sidebar/header; `"brand"` on light
// backgrounds. `compact` shows the mark only.
export function Logo({ tone = "brand", compact = false, className }: { tone?: "brand" | "on-brand"; compact?: boolean; className?: string }) {
  const white = tone === "on-brand";
  if (compact) {
    return <img src={white ? markWhite : markNavy} alt="BiManage" width={118} height={130} className={cn("h-9 w-auto select-none", className)} draggable={false} />;
  }
  return <img src={white ? wordmarkWhite : wordmarkNavy} alt="BiManage" width={300} height={88} className={cn("h-9 w-auto select-none", className)} draggable={false} />;
}
