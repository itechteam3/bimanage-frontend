import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The phone the landing screenshots are shown in: iPhone 18 Pro Max.
 * Screen 2868 × 1320 px at 460 ppi, 3x → 956 × 440 pt; body 163.4 × 78.0 mm
 * (https://www.apple.com/iphone-18-pro/specs/, checked 16 Nov 2026).
 * The status bar (62 pt, the Dynamic Island safe area) is drawn here, and the
 * app is captured BELOW it at 440 × 894 pt (scripts/marketing/screenshots.mjs),
 * so the app's own header never sits under the island.
 */
export const IPHONE = { model: "iPhone 18 Pro Max", width: 440, height: 956, dpr: 3, statusBar: 62 } as const;
export const IPHONE_APP_HEIGHT = IPHONE.height - IPHONE.statusBar;

export type PhoneChrome = {
  /** Status bar background: the colour at the top of the captured app. */
  bar: string;
  /** Status bar glyphs: "dark" on light screens, "light" on dark/navy headers. */
  glyphs: "dark" | "light";
  /** Home indicator colour, from the bottom of the screen. */
  home: "dark" | "light";
};

// Everything is in points of the real device, drawn with container units so
// the frame stays crisp and proportional at any width. Body = 440 pt screen
// + 2 × 15.5 pt bezel (78.0 mm body vs 72.9 mm screen).
const BODY = IPHONE.width + 31;
const pt = (n: number) => `${((n * 100) / BODY).toFixed(3)}cqw`;

/**
 * A drawn iPhone (titanium band, thin even bezel, Dynamic Island, iOS status
 * bar reading 9:41 with full signal, Wi-Fi and battery, home indicator) around
 * `children` — an image of the app at 440 × 894.
 */
export function IPhoneFrame({ chrome, children, className }: { chrome?: PhoneChrome; children: ReactNode; className?: string }) {
  const c = chrome ?? { bar: "var(--color-surface-card)", glyphs: "dark", home: "dark" };
  return (
    <figure className={cn("lp-phone mx-auto w-full", className)}>
      <div className="lp-phone-band" style={{ borderRadius: pt(76), padding: pt(3.5) }}>
        <div className="lp-phone-bezel" style={{ borderRadius: pt(72.5), padding: pt(12) }}>
          <div className="lp-phone-screen relative overflow-hidden" style={{ borderRadius: pt(60), background: c.bar }}>
            <StatusBar glyphs={c.glyphs} />
            {children}
            <span aria-hidden="true" className={cn("lp-phone-home absolute left-1/2 -translate-x-1/2", c.home === "light" && "lp-phone-light")} style={{ bottom: pt(8), width: pt(144), height: pt(5), borderRadius: pt(3) }} />
          </div>
        </div>
      </div>
    </figure>
  );
}

function StatusBar({ glyphs }: { glyphs: "dark" | "light" }) {
  return (
    <div aria-hidden="true" className={cn("lp-phone-status relative", glyphs === "light" && "lp-phone-light")} style={{ height: pt(IPHONE.statusBar) }}>
      {/* Dynamic Island: 126 × 37 pt, 11 pt from the top. */}
      <span className="lp-phone-island absolute left-1/2 -translate-x-1/2" style={{ top: pt(11), width: pt(126), height: pt(37), borderRadius: pt(19) }} />
      <span className="absolute flex items-center justify-center font-semibold tabular-nums" style={{ left: 0, width: pt(157), top: pt(11), height: pt(37), fontSize: pt(17), letterSpacing: pt(-0.4) }}>
        9:41
      </span>
      <span className="absolute flex items-center justify-center" style={{ right: 0, width: pt(157), top: pt(11), height: pt(37), gap: pt(6) }}>
        <svg viewBox="0 0 18 12" style={{ width: pt(18), height: pt(12) }} fill="currentColor">
          <rect x="0" y="7.5" width="3" height="4.5" rx="0.9" />
          <rect x="5" y="5" width="3" height="7" rx="0.9" />
          <rect x="10" y="2.5" width="3" height="9.5" rx="0.9" />
          <rect x="15" y="0" width="3" height="12" rx="0.9" />
        </svg>
        <svg viewBox="0 0 17 12" style={{ width: pt(17), height: pt(12) }} fill="currentColor">
          <path d="M.72 3.72a11 11 0 0 1 15.56 0l-1.56 1.56a8.8 8.8 0 0 0-12.44 0Z" />
          <path d="M3.69 6.69a6.8 6.8 0 0 1 9.62 0l-1.56 1.56a4.6 4.6 0 0 0-6.5 0Z" />
          <path d="M8.5 11.5 6.66 9.66a2.6 2.6 0 0 1 3.68 0Z" />
        </svg>
        <svg viewBox="0 0 28 13" style={{ width: pt(28), height: pt(13) }}>
          <rect x="0.5" y="0.5" width="24" height="12" rx="3.8" fill="none" stroke="currentColor" strokeOpacity="0.4" />
          <rect x="2" y="2" width="21" height="9" rx="2.4" fill="currentColor" />
          <path d="M26 4.5v4c.8-.3 1.4-1.1 1.4-2s-.6-1.7-1.4-2Z" fill="currentColor" fillOpacity="0.45" />
        </svg>
      </span>
    </div>
  );
}
