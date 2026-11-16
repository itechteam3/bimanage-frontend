import { useId } from "react";
import { cn } from "@/lib/cn";

// FELI's avatar: an original illustration (drawn for BiManage, no stock art)
// of a friendly assistant with a headset and a small AI spark, in the brand
// colours. One component for every FELI surface so she looks the same
// everywhere. Inline SVG: crisp from 24px to 96px+, no extra request.
//
// Pass `decorative` when a visible "FELI" label sits next to it, so screen
// readers don't hear "FELI" twice.
const SIZES = {
  xs: "size-6", // 24px: inline with text
  sm: "size-8", // 32px: chat bubbles
  md: "size-10", // 40px: chat headers
  lg: "size-12", // 48px: cards, launcher
  xl: "size-24", // 96px: empty states
} as const;

export type FeliAvatarSize = keyof typeof SIZES;

export function FeliAvatar({ size = "md", decorative = false, className }: { size?: FeliAvatarSize; decorative?: boolean; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const bg = `feli-bg-${uid}`;
  const glow = `feli-glow-${uid}`;
  const clip = `feli-clip-${uid}`;
  const a11y = decorative ? { "aria-hidden": true as const } : { role: "img", "aria-label": "FELI" };
  return (
    <svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" focusable="false" data-feli-avatar="" className={cn("block shrink-0 rounded-full", SIZES[size], className)} {...a11y}>
      {!decorative && <title>FELI</title>}
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#045F98" />
          <stop offset="1" stopColor="#00456C" />
        </linearGradient>
        <radialGradient id={glow} cx="0.5" cy="0.42" r="0.5">
          <stop offset="0" stopColor="#4DADF5" stopOpacity="0.55" />
          <stop offset="1" stopColor="#4DADF5" stopOpacity="0" />
        </radialGradient>
        <clipPath id={clip}>
          <circle cx="48" cy="48" r="48" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="96" height="96" fill={`url(#${bg})`} />
        <circle cx="48" cy="42" r="40" fill={`url(#${glow})`} />
        <g transform="translate(48 54) scale(1.12) translate(-48 -54)">
          {/* hair: puff and back */}
          <circle cx="48" cy="19" r="10.5" fill="#1A2733" />
          <path d="M24 50c0-17 10.7-28 24-28s24 11 24 28c0 8-1.5 14-4 18.5-1.5 2.5-4 3.5-7 3.5H35c-3 0-5.5-1-7-3.5-2.5-4.5-4-10.5-4-18.5z" fill="#1A2733" />
          {/* top and collar */}
          <path d="M14 100c0-18 15-29 34-29s34 11 34 29z" fill="#7D8FFF" />
          <path d="M38 72.5c2.5 6 6 9 10 9s7.5-3 10-9c-3-1-6.5-1.5-10-1.5s-7 .5-10 1.5z" fill="#F1F1FF" />
          {/* neck and face */}
          <path d="M42 62h12v10c0 3.3-2.7 6-6 6s-6-2.7-6-6z" fill="#8A5234" />
          <ellipse cx="48" cy="47" rx="16.5" ry="19" fill="#A9693F" />
          <path d="M31.5 47c-.5-13 7-21.5 16.5-21.5S65 34 64.5 47c-2.5-5.5-6-9.5-11-11.5-3.5 4.5-12 9-22 11.5z" fill="#1A2733" />
          {/* eyes, brows, cheeks, smile */}
          <ellipse cx="41.5" cy="49" rx="2.3" ry="2.9" fill="#12252F" />
          <ellipse cx="54.5" cy="49" rx="2.3" ry="2.9" fill="#12252F" />
          <circle cx="42.3" cy="48" r="0.8" fill="#FFFFFF" />
          <circle cx="55.3" cy="48" r="0.8" fill="#FFFFFF" />
          <path d="M38 43.5q3.5-2 7 0M51 43.5q3.5-2 7 0" stroke="#1A2733" strokeWidth="1.4" strokeLinecap="round" fill="none" />
          <circle cx="37.5" cy="55" r="2.6" fill="#E07A7A" opacity="0.45" />
          <circle cx="58.5" cy="55" r="2.6" fill="#E07A7A" opacity="0.45" />
          <path d="M43 57.5q5 4.5 10 0" stroke="#5C2A1C" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          {/* headset */}
          <path d="M30 48a18 18 0 0 1 36 0" stroke="#26C0E2" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <rect x="26.5" y="44.5" width="6.5" height="11" rx="3.2" fill="#26C0E2" />
          <path d="M30 55.5q1 7.5 9.5 8" stroke="#26C0E2" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <circle cx="40" cy="63.5" r="1.9" fill="#B9EBFF" />
        </g>
        {/* AI spark */}
        <path d="M75 13l1.9 5.1L82 20l-5.1 1.9L75 27l-1.9-5.1L68 20l5.1-1.9z" fill="#FFFFFF" />
        <path d="M83.5 29l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" fill="#B9EBFF" />
      </g>
      <circle cx="48" cy="48" r="47.25" fill="none" stroke="#FFFFFF" strokeOpacity="0.22" strokeWidth="1.5" />
    </svg>
  );
}
