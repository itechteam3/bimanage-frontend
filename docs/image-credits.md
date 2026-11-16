# Image credits

## Sample store product photos (Pexels)

Used **only** for the invented "Adunni Fashion House" sample store that appears
in the landing page screenshots (`scripts/marketing/products/`, loaded by
`scripts/marketing/sample-business.mjs`, captured by
`npm run screenshots:marketing`). They are not used anywhere else in the app.

Licence: [Pexels License](https://www.pexels.com/license/) — free to use,
attribution not required (given here anyway). The licence does not allow
implying endorsement by people or brands, so only product shots were chosen:
no recognisable faces and no visible brand names or logos. Downloaded
15 Nov 2026 at 900 px wide, then cropped to 640×640 and saved as WebP.

| File | Sample product | Pexels photo | Photographer |
|---|---|---|---|
| `linen-shirt.webp` | Classic linen shirt | https://www.pexels.com/photo/shirt-on-hanger-on-branch-22441297/ | dayong tien |
| `co-ord-set.webp` | Cotton co-ord set | https://www.pexels.com/photo/women-s-white-spaghetti-strap-top-and-brown-pumps-1107604/ | Lisa Fotios |
| `tote-bag.webp` | Everyday tote bag | https://www.pexels.com/photo/woman-using-fabric-shopper-bag-17836626/ | Doğu Tuncer |
| `beaded-bracelet.webp` | Beaded bracelet | https://www.pexels.com/photo/brown-and-black-beaded-bracelets-on-white-wooden-surface-11185142/ | Alexey Demidov |
| `leather-sandals.webp` | Leather sandals | https://www.pexels.com/photo/studio-shot-of-three-leather-sandals-in-various-colors-26965818/ | José Martín Segura Benites |
| `barrel-bag.webp` | Leather barrel bag | https://www.pexels.com/photo/brown-bag-on-white-background-22434773/ | Muneeb Malhotra |

Rejected while choosing (for the record): watch photos showing a maker's name
on the dial, and leather cardholders with an embossed brand mark — the sample
store sells a beaded bracelet and leather sandals instead.

## Sample people: illustrated profile pictures (CC0)

`scripts/marketing/avatars/*.webp` (192×192 WebP, about 7 KB each), one per
invented sample person, used **only** in the landing page screenshots: the
overlay `scripts/marketing/sample-business.mjs` puts them on the sample
people (signed-in owner in the header and sidebar, team members, project
people, message contacts, reviewers; wherever the app shows a profile
picture, and lists that show initials keep them). They are not in the app bundle.

- Style: **Lorelei** by Lisa Wischofsky — https://www.dicebear.com/styles/lorelei/
- Licence: **CC0 1.0** (public domain dedication) —
  https://creativecommons.org/publicdomain/zero/1.0/ — commercial use allowed,
  no attribution required (given here anyway).
- Rendered by the DiceBear HTTP API (`https://api.dicebear.com/9.x/lorelei/webp`)
  with fixed options per person (skin tone, hair, eyes, mouth, earrings,
  beard, glasses, background); the exact options are in
  `scripts/marketing/make-avatars.mjs` (`node scripts/marketing/make-avatars.mjs`
  re-downloads them). Generated 16 Nov 2026.
- They are drawings, not photos: no real, identifiable person is shown, so
  nothing implies a real person uses or endorses BiManage.

| File | Sample person | Who they are in the sample data |
|---|---|---|
| `adunni-bello.webp` | Adunni Bello | Business owner (signed-in user) |
| `tunde-adeyemi.webp` | Tunde Adeyemi | Team member (manager), project lead |
| `chika-okafor.webp` | Chika Okafor | Invited team member |
| `tolani-adeyemi.webp`, `chinedu-okafor.webp`, `zainab-musa.webp`, `kemi-ogunleye.webp`, `ifeoma-nwankwo.webp`, `babatunde-ajayi.webp`, `halima-bello.webp`, `segun-adekunle.webp`, `amaka-eze.webp`, `femi-oladipo.webp`, `ngozi-obi.webp`, `yusuf-danjuma.webp` | The sample customers | Customers (customers, orders, invoices) |
| `ada-nwosu.webp`, `tunde-bello.webp`, `chioma-eze.webp` | Store shoppers | Store order customers |

## Sample shop logo (our own)

`scripts/marketing/logo/adunni-fashion-house.svg` (source) and `.webp`
(256×256): a simple "A" monogram drawn for the invented "Adunni Fashion
House" by the BiManage team (geometric shapes only, no font, no third-party
artwork), so there are no licence restrictions. Set as the sample store's
logo by the overlay (storefront header, store settings, business profile).
Used only in the landing page screenshots.

## Phone frame

The iPhone frame, Dynamic Island, iOS-style status bar and home indicator
around the phone screenshots are drawn in CSS/SVG
(`src/pages/landing/IPhoneFrame.tsx`): no Apple artwork or logos are used.
Proportions from Apple's published iPhone 18 Pro Max specs
(https://www.apple.com/iphone-18-pro/specs/, checked 16 Nov 2026): display
2868 × 1320 px at 460 ppi (440 × 956 pt at 3x), body 163.4 × 78.0 mm.

## Landing page photos from the Figma design

`src/assets/landing/hero*.webp` (city skyline), `step-*.webp` (3D icons) and
`collage-*.webp` were supplied in the BiManage Figma file ("Landing Page",
node 1:12) by the designer; their original source was not recorded in the
file. Replace them if a source can't be confirmed.

## Product screenshots

`src/assets/landing/screens/*` are screenshots of the BiManage app itself,
filled with invented sample data (no real accounts, customers or contact
details), made by `npm run build:layout && npm run screenshots:marketing`.
Desktop: 1280 × 800 at 2x (WebP) with a 1x PNG fallback. Phone: the iPhone
18 Pro Max viewport below its status bar, 440 × 894 pt at 3x (WebP,
1320 × 2682 px) with a 1x PNG fallback; `phone-chrome.json` holds each
screen's status bar colour and glyph tone.
