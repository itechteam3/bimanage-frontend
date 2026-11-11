# Figma screen inventory — file chA2nADlqsen1ggIXUJL8X

Source: `get_metadata` (read-only), one call per page, 2026-11-11.
**Rate limit:** the 17th call (Landing Page `0:1`) failed with "You've reached the Figma MCP tool call limit on the Starter plan." The Landing Page is NOT inventoried. All other 16 pages were retrieved.

Conventions: each page = canvas > one section (07 has two) > screen frames named `NN.NN — Name / Desktop|Mobile`, paired by a `PAIR • NN.NN` text label. Every screen has exactly one Desktop (1440/1500 wide) and one Mobile (440 wide) variant. **No Tablet variants anywhere.** Desktop frames contain `SYSTEM • Aligned Sidebar / <module>` and `SYSTEM • Aligned Header`; mobile frames contain `MOBILE • Header`, a scroll container and usually `MOBILE NAV • Icon tabs` (4 tabs).
Child summaries below come from named descendants (FIELD/INPUT/BUTTON/ACTION/TABLE/TAB/KPI/EMPTY STATE/etc.); `RECORD rows (e.g. X)` means sample data rows in a list/table. Generic layers (Frame 123, icons, sidebar/header) are omitted.

## Dark mode
**No dark mode / theme frames or variants exist on any retrieved page.** A name search for dark/light/theme across all 16 pages found only: a brand symbol "Brand / BiManage white logomark / Mobile • dark header" (2118:22), the brand note "Web: dark-background iM iManage lockup" (a logo-on-dark-sidebar usage, not a theme), the DS text "A lighter, more expressive system.", and product copy "Lightweight breathable linen" in Online Store. The design is light-only (the desktop sidebar itself is dark navy).

## Screen counts
| Page | Screens | Variant frames |
|---|---|---|
| 02 Onboarding | 7 (02.01–02.05, 02.06A, 02.06B) | 14 |
| 03 Dashboard | 2 | 4 |
| 04 Business Management | 9 | 18 |
| 05 Sales, Orders & Invoices | 13 | 26 |
| 06 Wallet & Transactions | 10 | 20 |
| 07 Subscriptions & Packages | 15 | 30 |
| 08 Online Store | 20 | 40 |
| 09 Inventory & Customers | 11 | 22 |
| 10 BiSupplyNet | 12 | 24 |
| 11 FELI AI | 5 | 10 |
| 12 Messaging & Support | 18 | 36 |
| 13 Account & Settings | 8 | 16 |
| 14 Analytics & Reports | 4 | 8 |
| 15 Social Media | 1 | 2 |
| 16 Platform Administration | 8 | 16 |
| **Total** | **143** | **286** |

(Page 01 — Authentication is not in the page list given; auth masters exist in the Design System.)

## 00 — Design System (page id 2008:948)
Section **"E • Design System"** `1714:2458`:
- FOUNDATIONS • Title and overview `1849:1328`
- 01 • Navigation and workspace shells `1849:1332`
- 02 • Workspace header `1849:1338`
- **03 • Color foundations `1849:1343`** — COLORS • Swatch grid `1849:1346` (swatch columns 1849:1347, 1849:1360, …)
- **04 • Typography specimens `1849:1386`** — TYPE • Display `1849:1389`, Page title `1849:1393`, Section title `1849:1397`, Card heading `1849:1401`, Body `1849:1405`, Label `1849:1409`, Caption `1849:1413` (Poppins; note text "SYSTEM NOTE • Poppins sizes" `1731:2459`)
- **05 • Layout and spacing `1849:1417`** — SPACE 4/8/12/16/24/32/40 (`1849:1420`…`1849:1444`), LAYOUT • Rules `1849:1448`
- **06 • Editable components and states `1849:1451`** — COMPONENTS • Preview specimens `1850:1362`
- 07 • Application guidelines `1849:1454` — RULE • Typography/Alignment/Actions/Navigation/Accessibility/Responsive (`1849:1456`…`1849:1471`)
- 08 • Design-to-development handoff `1849:1474` — HANDOFF • Open pricing decision `1849:1478`
- **09 • Component masters `1850:1328`** — BiManage / Button `1850:1339`, BiManage / Field `1850:1352`, BiManage / Status `1850:1361`
- **10 • Premium visual language / Foundations `1917:1403`** — colour TOKENS: Navy/Brand `1917:1407`, Canvas `1917:1410`, Blue tint `1917:1413`, Aqua tint `1917:1416`, Lavender tint `1917:1419`, Warm tint `1917:1422`, Sky accent `1917:1425`, Violet accent `1917:1428`
- **11 • UI elevation & components `1917:1431`** — symbols: Metric card / Premium `1917:1434`, Premium info card `1917:1439`, Guided empty state `1917:1444`; COMPONENT GUIDANCE `1917:1450`
- **12 • Transactions, store, auth and responsive masters `1930:1387`** — symbols: Dialog / Confirmation `1930:1391`, Storefront / Product tile `1930:1400`, Wallet / Payout review `1930:1408`, Authentication / OTP input `1930:1422`, Mobile / Bottom navigation `1930:1438`, Authentication / Feature card `1930:1447`; DOCUMENTATION • Implementation criteria `1930:1451`
- STANDARD • BiManage sidebar / desktop `1714:2459`; SYSTEM • Sidebar auto-layout aligned / v2 `1748:1513`; SYSTEM • Header auto-layout aligned / v2 `1749:1558`

Other top-level items on the page:
- Section "Layout & Alignment Standards" `2076:21` — STANDARDS • Production UI `2076:22`
- Symbols: Brand / BiManage official white wordmark / Web `2118:21`; Brand / BiManage white logomark / Mobile • dark header `2118:22`
- Section "Approved Brand Identity" `2118:23` — SPECIMENS • Approved applications `2118:26`, BRAND RULES • Usage `2118:37`
- Section "Iconography • Tabler / BiManage" `2149:21` — 35 icon specimen frames; 35 icon symbols `Icon / Tabler / <name>` (home 2149:24, layout-dashboard 2149:36, users 2149:50, package 2149:64, shopping-cart 2149:80, receipt 2149:94, wallet 2149:102, credit-card 2150:51, chart-bar 2150:65, settings 2150:79, bell 2150:89, message-circle 2150:99, sparkles 2150:107, calendar 2150:115, filter 2151:78, search 2151:86, plus 2151:96, pencil 2151:106, trash 2151:116, chevron-right 2151:132, arrow-left 2151:140, download 2152:101, check 2152:113, x 2152:121, building-store 2152:131, truck-delivery 2152:147, shield-check 2152:161, lifebuoy 2152:171, dots 2153:131, clipboard-list 2153:143, file-invoice 2153:161, history 2153:177, user-circle 2153:187, lock 2153:199, report-analytics 2153:211)
- Component set frame "BiManage / Button / Mobile v2" `2154:205` — Style = Primary/Tonal/Outlined/Destructive × State = Default/Pressed/Disabled/Loading/Success (20 symbols, 2154:165–2154:203)
- "BiManage / Button / Icon-only v2" `2154:221` — State Default/Pressed/Disabled (2154:206/211/216)
- Section "Buttons • Mobile v2 / Approved" `2154:222` (preview instances)
- Unnamed section `2186:11984` — "QA • BiManage • 2026 UI Refinement Verification" (metrics frames 2186:11987–2186:11999)
- Symbol "BiManage / Dialog / Premium v2" `2186:12052`
- No light/dark theme frames.

## Landing Page (page id 0:1)
**Not retrieved — Figma Starter-plan MCP rate limit hit on this call.**

---

# Screen pages

## 02 — Onboarding  (page id 2024:929)

**Sections:** Onboarding (1923:1390)

**Screens: 7** (variant frames: 14)

- **02.01 — Onboarding — Existing business trial** — Desktop `1683:2318`, Mobile `1902:2160`
  - UX • State introduction; UX • Journey overview; UX • Relevant account details; UX • Key account number; ACTION • Open your setup checklist; UX • Personalised next steps; UX • Help and secondary action; ACTION • View subscription plans; MOBILE • Scroll content; BUTTON / Premium v2 • Open your setup checklist →
- **02.02 — Onboarding — Select business path** — Desktop `1897:2366`, Mobile `1898:2471`
  - CONTEXT / Verifying payment; BUTTON / Check payment status; TRANSACTION / Verifying payment; RECORD rows (e.g. Order); ONBOARDING • select; BUTTON / Premium v2 • Continue with selected path →
- **02.03 — Onboarding — Complete business identity** — Desktop `1897:2548`, Mobile `1898:2504`
  - CONTEXT / Add a product; BUTTON / Save draft; FORM / Add a product; FORM / Row 1; FIELD / Product name *; FIELD / Category *; FORM / Row 2; FIELD / Price (NGN) *; FIELD / Compare price; FORM / Row 3; FIELD / SKU *; FIELD / Stock available; FORM / Row 4; FIELD / Product images *; FIELD / Visibility; GUIDANCE / Add a product; BUTTON / Publish product; MOBILE • Reflowed content; BUTTON / Premium v2 • Save business identity
- **02.04 — Onboarding — Path details** — Desktop `1679:4594`, Mobile `1902:2611`
  - ONBOARD • Page introduction; ONBOARD PATH • STARTUP PATH; ONBOARD PATH • EXISTING BUSINESS; ONBOARD • Price clarification; MOBILE • Onboarding path detail cards; BUTTON / Premium v2 • Choose your business path →
- **02.05 — Onboarding — Setup tracker** — Desktop `1683:2488`, Mobile `1902:2667`
  - ONBOARD TRACKER • Banner; ONBOARD TRACKER • Seven steps; ONBOARD TRACKER • Tips; ONBOARDING • tracker; STEPS • Setup checklist; GUIDANCE • Setup; BUTTON / Premium v2 • Continue business setup →
- **02.06A — Startup onboarding / 30-day free trial** — Desktop `2234:337`, Mobile `2234:627`
  - ONBOARD • Page introduction; ONBOARD PATH • STARTUP PATH; ONBOARD PATH • EXISTING BUSINESS; ONBOARD • Price clarification; MOBILE • Onboarding path detail cards; BUTTON / Premium v2 • Choose your business path →
- **02.06B — Startup onboarding / Paid 30-day package** — Desktop `2234:676`, Mobile `2234:966`
  - ONBOARD • Page introduction; ONBOARD PATH • STARTUP PATH; ONBOARD PATH • EXISTING BUSINESS; ONBOARD • Price clarification; MOBILE • Onboarding path detail cards; BUTTON / Premium v2 • Choose your business path →

## 03 — Dashboard  (page id 2024:930)

**Sections:** Dashboard (1923:1393)

**Screens: 2** (variant frames: 4)

- **03.01 — Dashboard / Empty state** — Desktop `1889:1388`, Mobile `1889:8190`
  - DASHBOARD • Intro; DASHBOARD • KPI cards; KPI • REVENUE; KPI • TOTAL ORDERS; KPI • OPEN INVOICES; KPI • LOW STOCK; DASHBOARD • Primary records; EMPTY STATE • No orders recorded; DASHBOARD • Next actions; DASHBOARD • Tasks; ACTIONS • Primary and secondary; ACTION • Create an order; ACTION • Create invoice; DASHBOARD • Blueprint complete / sales trend; DASHBOARD • Blueprint complete / top-selling products; MOBILE • Scroll content; KPI • Revenue; KPI • Orders; KPI • Products; KPI • Open tasks; STATUS • Setup progress / 0 of 4; MOBILE NAV • Icon tabs; TAB • Home; TAB • Activity; TAB • Tasks; TAB • More
- **03.02 — Dashboard / Populated** — Desktop `1889:1781`, Mobile `1924:1387`
  - DASHBOARD • Intro; DASHBOARD • KPI cards; KPI • REVENUE; KPI • TOTAL ORDERS; KPI • OPEN INVOICES; KPI • LOW STOCK; DASHBOARD • Primary records; RECORD rows (e.g. ORD-1001); DASHBOARD • Next actions; DASHBOARD • Tasks; ACTIONS • Primary and secondary; ACTION • Create an order; ACTION • Create invoice; DASHBOARD • Blueprint complete / sales trend; CHART rows (e.g. Sales trend / 1); DASHBOARD • Blueprint complete / top-selling products; MOBILE • Scroll content; KPI • Revenue; KPI • Orders; KPI • Low stock; KPI • Open tasks; MOBILE NAV • Icon tabs; TAB • Home; TAB • Activity; TAB • Tasks; TAB • More

## 04 — Business Management  (page id 2024:931)

**Sections:** Team & Projects (1923:1396)

**Screens: 9** (variant frames: 18)

- **04.01 — Team — Directory** — Desktop `1674:2964`, Mobile `1899:1628`
  - DIRECTORY • Headline; DIRECTORY • Search and records; SEARCH • Team members; TABLE • Headers; RECORD rows (e.g. Amina Yusuf); DIRECTORY • Editing panel; ACTION • Invite teammate; MOBILE • Structured scroll; BUTTON / Premium v2 • Invite teammate; MOBILE NAV • Native icon tabs; TAB • Projects; TAB • Team; TAB • Calendar; TAB • More
- **04.02 — Projects — Board and task creation** — Desktop `1674:3339`, Mobile `1899:1678`
  - Search Bar; PROJECTS • Introduction; PROJECTS • Navigation; TAB • Board; TAB • Calendar; TAB • Overview; TAB • New task; KANBAN • Work statuses; TASK • Create task drawer; FIELD • TITLE; INPUT • TITLE; FIELD • ASSIGNEE; INPUT • ASSIGNEE; FIELD • DUE DATE; INPUT • DUE DATE; FIELD • PRIORITY; INPUT • PRIORITY; FIELD • SUBTASKS; INPUT • SUBTASKS; FIELD • NOTES; INPUT • NOTES; ACTION • Save task; MOBILE CONTENT • create; FORM • New project details; FIELD • PROJECT NAME; FIELD • DESCRIPTION; FIELD • PROJECT OWNER; FIELD • START DATE; BUTTON / Premium v2 • Create project →; MOBILE NAV • Native icon tabs …
- **04.03 — Projects — Calendar** — Desktop `1674:3661`, Mobile `1899:1726`
  - Search Bar; Button; CALENDAR INTRO; CALENDAR OCTOBER 2026; CALENDAR UPCOMING; MOBILE • Structured scroll; BUTTON / Premium v2 • Open task board; MOBILE NAV • Native icon tabs; TAB • Projects; TAB • Team; TAB • Calendar; TAB • More
- **04.04 — Projects — Overview** — Desktop `1674:5011`, Mobile `1899:1931`
  - PROJECT INTRO; PROJECT METRICS; KPI • ACTIVE PROJECTS; KPI • TASKS IN PROGRESS; KPI • COMPLETED; KPI • UPCOMING DEADLINES; PROJECT PROGRESS; PROJECT NEXT STEPS; ACTION • Open Board; MOBILE CONTENT • overview; KPI • Project totals; STAT • Open tasks; STAT • Due this week; MOBILE NAV • Native icon tabs; TAB • Projects; TAB • Team; TAB • Calendar; TAB • More
- **04.05 — Team — Invite member and permissions** — Desktop `1677:1893`, Mobile `1899:2031`
  - DIRECTORY • Headline; DIRECTORY • Search and records; SEARCH • Team members; TABLE • Headers; RECORD rows (e.g. Amina Yusuf); DIRECTORY • Editing panel; ACTION • Send invitation; MOBILE • Structured scroll; BUTTON / Premium v2 • Send invitation; MOBILE NAV • Native icon tabs; TAB • Projects; TAB • Team; TAB • Calendar; TAB • More
- **04.06 — Projects — Kanban overview** — Desktop `1677:2478`, Mobile `1901:1439`
  - Search Bar; PROJECTS • Introduction; PROJECTS • Navigation; TAB • Board; TAB • Calendar; TAB • Overview; TAB • New task; KANBAN • Work statuses; KANBAN • Guidance; MOBILE CONTENT • board; TABS • Board Calendar Activity; MOBILE NAV • Native icon tabs; TAB • Projects; TAB • Team; TAB • More
- **04.07 — Projects — Task added** — Desktop `1693:2388`, Mobile `1901:1785`
  - Search Bar; PROJECTS • Introduction; PROJECTS • Navigation; TAB • Board; TAB • Calendar; TAB • Overview; TAB • New task; KANBAN • Work statuses; KANBAN • Guidance; MOBILE • Structured scroll; MOBILE NAV • Native icon tabs; TAB • Projects; TAB • Team; TAB • More
- **04.08 — Projects — Edit task** — Desktop `1693:2710`, Mobile `1901:1811`
  - Search Bar; PROJECTS • Introduction; PROJECTS • Navigation; TAB • Board; TAB • Calendar; TAB • Overview; TAB • New task; KANBAN • Work statuses; TASK • Edit task drawer; FIELD • TITLE; INPUT • TITLE; FIELD • ASSIGNEE; INPUT • ASSIGNEE; FIELD • DUE DATE; INPUT • DUE DATE; FIELD • PRIORITY; INPUT • PRIORITY; FIELD • SUBTASKS; INPUT • SUBTASKS; FIELD • NOTES; INPUT • NOTES; ACTION • Save task; MOBILE • Structured scroll; MOBILE NAV • Native icon tabs; TAB • Projects; TAB • Team; TAB • More
- **04.09 — Team — Invitation sent** — Desktop `1698:2388`, Mobile `1901:1859`
  - OUTCOME • Status hero; OUTCOME • Record summary; ACTION • Manage your team; ACTION • Invite another member; OUTCOME • Actionable steps; OUTCOME • Helpful detail; MOBILE • Structured scroll; MOBILE NAV • Native icon tabs; TAB • Projects; TAB • Team; TAB • Calendar; TAB • More

## 05 — Sales, Orders & Invoices  (page id 2024:932)

**Sections:** Sales, Orders & Invoices (1923:1399)

**Screens: 13** (variant frames: 26)

- **05.01 — Sales — Overview** — Desktop `1674:1691`, Mobile `1899:1387`
  - DASHBOARD • Intro; DASHBOARD • KPI cards; KPI • REVENUE; KPI • TOTAL ORDERS; KPI • OPEN INVOICES; KPI • LOW STOCK; DASHBOARD • Primary records; RECORD rows (e.g. ORD-1001); DASHBOARD • Next actions; DASHBOARD • Tasks; ACTIONS • Primary and secondary; ACTION • Create an order; ACTION • Create invoice; MOBILE • Structured scroll; COMPONENT • Intro; COMPONENT • KPI cards; COMPONENT • Primary records; COMPONENT • Next actions; COMPONENT • Tasks; COMPONENT • Primary action; MOBILE NAV • Icon tabs; TAB • Sales; TAB • Orders; TAB • Invoices; TAB • More
- **05.02 — Orders — List and status filters** — Desktop `1674:1953`, Mobile `1899:1451`
  - ORDERS • Intro; ORDERS • Metrics; KPI • ALL ORDERS; KPI • AWAITING PAYMENT; KPI • UNFULFILLED; KPI • COMPLETED; ORDERS • Searchable table; SEARCH • Orders; FILTER • Order status; TABLE HEAD; ORDERS • Available workflows; ACTION • Create order; ACTION • Invoice builder; MOBILE • Structured scroll; COMPONENT • Intro; RECORD rows (e.g. Search your history, filter by); COMPONENT • Metrics; COMPONENT • Searchable table; COMPONENT • Available workflows; COMPONENT • Primary action; MOBILE NAV • Icon tabs; TAB • Sales; TAB • Orders; TAB • Invoices; TAB • More
- **05.03 — Invoices — Create and preview** — Desktop `1674:2265`, Mobile `1899:1514`
  - card bg; card head; list 3; section line; list 2; list 1; list head; input bg; input head; input email; input bd; input date; input fill; card name; INVOICE BUILDER • Editable details; FIELD • Invoice number; INPUT • Invoice number; FIELD • Issued date; INPUT • Issued date; FIELD • Customer; INPUT • Customer; FIELD • Due date; INPUT • Due date; FIELD • Recipient email; INPUT • Recipient email; FIELD • Order reference; INPUT • Order reference; TABLE • Editable invoice items; TABLE ROW • Sample product; TABLE ROW • Delivery service …
- **05.04 — Orders — Details and fulfilment** — Desktop `1674:4088`, Mobile `1899:1832`
  - ORDER • Summary headline; ORDER • Customer and item details; ACTION • Create an invoice; ACTION • Cancel unfulfilled order; ORDER • Status and breakdown; ORDER • Rules and next steps; MOBILE • Structured scroll; BUTTON / Premium v2 • Cancel unfulfilled order; BUTTON / Premium v2 • Create invoice; MOBILE NAV • Icon tabs; TAB • Sales; TAB • Orders; TAB • Invoices; TAB • More
- **05.05 — Sales — Analytics** — Desktop `1674:5369`, Mobile `1899:1981`
  - card-body; statistics; charts; ANALYTICS • KPI grid; KPI • REVENUE; KPI • ORDERS; KPI • PAID INVOICES; KPI • PENDING; ANALYTICS • Chart; ANALYTICS • Insight panel; ANALYTICS • Top items; LIST • Title and CTA; ACTION • Create invoice; TABLE ROW • Sample product A; TABLE ROW • Sample product B; TABLE ROW • Sample product C; MOBILE • Structured scroll; CHART rows (e.g. Sales revenue / example week); BUTTON / Premium v2 • Create invoice; MOBILE NAV • Icon tabs; TAB • Sales; TAB • Orders; TAB • Invoices; TAB • More
- **05.06 — Invoices — Created confirmation** — Desktop `1677:2308`, Mobile `1901:1387`
  - OUTCOME • Status hero; OUTCOME • Record summary; ACTION • Email this invoice; ACTION • Back to invoice editor; OUTCOME • Actionable steps; OUTCOME • Helpful detail; MOBILE • Structured scroll; BUTTON / Premium v2 • Email invoice; MOBILE NAV • Icon tabs; TAB • Sales; TAB • Orders; TAB • Invoices; TAB • More
- **05.07 — Orders — Cancellation confirmation** — Desktop `1677:2800`, Mobile `1901:1465`
  - STATUS BANNER • Eligible for cancellation; CANCELLATION • Order and eligibility; ACTIONS • Cancellation; ACTION • Keep the order; ACTION • Confirm order cancellation; CANCELLATION • Status timeline; STEP • Review the order; STEP • Restore inventory; STEP • Keep the history; CANCELLATION • Important note; MOBILE • Structured scroll; BUTTON / Premium v2 • Confirm cancellation; BUTTON / Premium v2 • Keep this order; MOBILE NAV • Icon tabs; TAB • Sales; TAB • Orders; TAB • Invoices; TAB • More
- **05.08 — Orders — Cancellation completed** — Desktop `1678:1963`, Mobile `1901:1517`
  - STATUS BANNER • Cancellation confirmed; CANCELLATION • Order and eligibility; ACTIONS • Cancellation; ACTION • View inventory; ACTION • Return to orders; CANCELLATION • Status timeline; STEP • Order updated; STEP • Inventory restored; STEP • You're all set; CANCELLATION • Important note; MOBILE • Structured scroll; BUTTON / Premium v2 • Return to orders; MOBILE NAV • Icon tabs; TAB • Sales; TAB • Orders; TAB • Invoices; TAB • More
- **05.09 — Orders — Create order** — Desktop `1689:2318`, Mobile `1901:1569`
  - NEW ORDER • Intro; NEW ORDER • Detail form; FIELD • CUSTOMER; INPUT • CUSTOMER; FIELD • PAYMENT METHOD; INPUT • PAYMENT METHOD; FIELD • ORDER NOTES; INPUT • ORDER NOTES; ACTION • Add product; NEW ORDER • Summary; SUMMARY • Items; SUMMARY • Subtotal; SUMMARY • Delivery; SUMMARY • Estimated total; ACTION • Create order; ACTION • Review current orders; MOBILE • Structured scroll; BUTTON / Premium v2 • Create order; MOBILE NAV • Icon tabs; TAB • Sales; TAB • Orders; TAB • Invoices; TAB • More
- **05.10 — Invoices — Email invoice** — Desktop `1689:3197`, Mobile `1901:1621`
  - card bg; card head; list 3; section line; list 2; list 1; list head; input bg; input head; input email; input bd; input date; input fill; card name; INVOICE EMAIL • Intro; INVOICE EMAIL • Compose; FIELD • TO EMAIL; INPUT • TO EMAIL; FIELD • SUBJECT; INPUT • SUBJECT; FIELD • CC (OPTIONAL); INPUT • CC (OPTIONAL); FIELD • MESSAGE; INPUT • MESSAGE; FIELD • ATTACHMENT; INPUT • ATTACHMENT; ACTION • Send invoice; ACTION • Edit invoice; INVOICE EMAIL • Attachment preview; STEP • Customer receives invoice email …
- **05.11 — Invoices — Sent confirmation** — Desktop `1689:3556`, Mobile `1901:1681`
  - OUTCOME • Status hero; OUTCOME • Record summary; ACTION • Return to invoices; ACTION • See sales analytics; OUTCOME • Actionable steps; OUTCOME • Helpful detail; MOBILE • Structured scroll; BUTTON / Premium v2 • Return to invoices; MOBILE NAV • Icon tabs; TAB • Sales; TAB • Orders; TAB • Invoices; TAB • More
- **05.12 — Orders — Created confirmation** — Desktop `1692:2353`, Mobile `1901:1733`
  - OUTCOME • Status hero; OUTCOME • Record summary; ACTION • View order details; ACTION • Create an invoice; OUTCOME • Actionable steps; OUTCOME • Helpful detail; MOBILE • Structured scroll; BUTTON / Premium v2 • View order details; MOBILE NAV • Icon tabs; TAB • Sales; TAB • Orders; TAB • Invoices; TAB • More
- **05.13 — Invoices — PDF preview** — Desktop `1821:1328`, Mobile `1901:1963`
  - card bg; card head; list 3; section line; list 2; list 1; list head; input bg; input head; input email; input bd; input date; input fill; card name; FIELD • Invoice number; INPUT • Invoice number; FIELD • Issued date; INPUT • Issued date; FIELD • Customer; INPUT • Customer; FIELD • Due date; INPUT • Due date; FIELD • Recipient email; INPUT • Recipient email; FIELD • Order reference; INPUT • Order reference; TABLE • Editable invoice items; TABLE ROW • Sample product; TABLE ROW • Delivery service; ACTION • Add another item …

## 06 — Wallet & Transactions  (page id 2024:933)

**Sections:** Wallet & Transactions (1923:1402)

**Screens: 10** (variant frames: 20)

- **06.01 — Wallet — Balances and availability** — Desktop `1869:1388`, Mobile `1888:1388`
  - CONTEXT / Ready to launch?; BUTTON / Visit store; KPI / COMPLETION; KPI / PRODUCTS; KPI / TEMPLATE; KPI / STATUS; OVERVIEW / Activity; RECORD rows (e.g. Business identity); OVERVIEW / Next actions; MOBILE • Scroll content; CHART rows (e.g. Wallet example balance distrib); BUTTON / Premium v2 • Request payout; MOBILE NAV • Icon tabs; TAB • Wallet; TAB • Payout; TAB • History; TAB • More
- **06.02 — Wallet — Link bank account** — Desktop `1870:1519`, Mobile `1888:1449`
  - CONTEXT / Create your online store; BUTTON / Preview; FORM / Create your online store; FORM / Row 1; FIELD / Store name *; FIELD / Business category *; FORM / Row 2; FIELD / Store description *; FIELD / Business email *; FORM / Row 3; FIELD / Support phone; FIELD / Free store URL; GUIDANCE / Create your online store; BUTTON / Create store; MOBILE • Scroll content; FIELD • BANK NAME *; FIELD • ACCOUNT NUMBER *; FIELD • ACCOUNT HOLDER; FIELD • ACCOUNT TYPE; FIELD • CURRENCY; FIELD • VERIFICATION; BUTTON / Premium v2 • Save bank account; MOBILE NAV • Icon tabs; TAB • Wallet; TAB • Payout; TAB • History; TAB • More
- **06.03 — Wallet — Withdrawal schedule** — Desktop `1872:1387`, Mobile `1888:1500`
  - CONTEXT / Create your online store; BUTTON / Preview; FORM / Create your online store; FORM / Row 1; FIELD / Store name *; FIELD / Business category *; FORM / Row 2; FIELD / Store description *; FIELD / Business email *; FORM / Row 3; FIELD / Support phone; FIELD / Free store URL; GUIDANCE / Create your online store; BUTTON / Create store; MOBILE • Scroll content; FIELD • PAYOUT INTERVAL *; FIELD • NEXT ELIGIBLE DATE; FIELD • BUSINESS TIMEZONE; FIELD • DESTINATION ACCOUNT; FIELD • NOTIFICATION EMAIL; FIELD • PAYOUT REMINDER; BUTTON / Premium v2 • Save withdrawal schedule; MOBILE NAV • Icon tabs; TAB • Wallet; TAB • Payout; TAB • History; TAB • More
- **06.04 — Wallet — Request withdrawal** — Desktop `1872:1724`, Mobile `1888:1551`
  - CONTEXT / Add a product; BUTTON / Save draft; FORM / Add a product; FORM / Row 1; FIELD / Product name *; FIELD / Category *; FORM / Row 2; FIELD / Price (NGN) *; FIELD / Compare price; FORM / Row 3; FIELD / SKU *; FIELD / Stock available; FORM / Row 4; FIELD / Product images *; FIELD / Visibility; GUIDANCE / Add a product; BUTTON / Publish product; MOBILE • Scroll content; FIELD • AVAILABLE BALANCE; FIELD • AMOUNT TO WITHDRAW *; FIELD • COMMISSION (3%); FIELD • NET PAYOUT; FIELD • RECEIVING BANK; FIELD • ACCOUNT; FIELD • ACCOUNT NAME; FIELD • NEXT PAYOUT DATE; BUTTON / Premium v2 • Review withdrawal; MOBILE NAV • Icon tabs; TAB • Wallet; TAB • Payout …
- **06.05 — Wallet — Review withdrawal** — Desktop `1872:2073`, Mobile `1888:1611`
  - CONTEXT / Payment successful; BUTTON / Track order; TRANSACTION / Payment successful; RECORD rows (e.g. Order); MOBILE • Scroll content; BUTTON / Premium v2 • Confirm request; MOBILE NAV • Icon tabs; TAB • Wallet; TAB • Payout; TAB • History; TAB • More
- **06.06 — Wallet — Withdrawal submitted** — Desktop `1872:2388`, Mobile `1888:1647`
  - CONTEXT / Payment successful; BUTTON / Track order; TRANSACTION / Payment successful; RECORD rows (e.g. Order); MOBILE • Scroll content; BUTTON / Premium v2 • View payout status; MOBILE NAV • Icon tabs; TAB • Wallet; TAB • Payout; TAB • History; TAB • More
- **06.07 — Wallet — Transaction history** — Desktop `1873:1387`, Mobile `1888:1683`
  - CONTEXT / Store products; BUTTON / + Add product; CONTENT / Store products; FIELD / SEARCH; RECORD rows (e.g. Classic linen shirt); SUMMARY / Store products; MOBILE • Scroll content; FIELD • SEARCH; BUTTON / Premium v2 • Export transactions; MOBILE NAV • Icon tabs; TAB • Wallet; TAB • Payout; TAB • History; TAB • More
- **06.08 — Wallet — Transaction details** — Desktop `1873:1732`, Mobile `1888:1740`
  - CONTEXT / Classic linen shirt; BUTTON / Edit product; CONTENT / Classic linen shirt; RECORD rows (e.g. Selling price); SUMMARY / Classic linen shirt; MOBILE • Scroll content; BUTTON / Premium v2 • Download receipt; MOBILE NAV • Icon tabs; TAB • Wallet; TAB • Payout; TAB • History; TAB • More
- **06.09 — Wallet — Bank validation failure** — Desktop `1873:2073`, Mobile `1888:1794`
  - CONTEXT / Verifying payment; BUTTON / Check payment status; TRANSACTION / Verifying payment; RECORD rows (e.g. Order); MOBILE • Scroll content; BUTTON / Premium v2 • Edit bank details; MOBILE NAV • Icon tabs; TAB • Wallet; TAB • Payout; TAB • History; TAB • More
- **06.10 — Wallet — Payout unsuccessful** — Desktop `1873:2385`, Mobile `1888:1827`
  - CONTEXT / Verifying payment; BUTTON / Check payment status; TRANSACTION / Verifying payment; RECORD rows (e.g. Order); MOBILE • Scroll content; BUTTON / Premium v2 • Retry payout; MOBILE NAV • Icon tabs; TAB • Wallet; TAB • Payout; TAB • History; TAB • More

## 07 — Subscriptions & Packages  (page id 2024:934)

**Sections:** Plans & Billing (1923:1405); Startup Packages (1923:1408)

**Screens: 15** (variant frames: 30)

- **07.01 — Plan comparison** — Desktop `1664:4520`, Mobile `1902:1388`
  - PLANS • Introduction; PLANS • Package comparison; PLAN CARD • Freemium; PLAN TAG • GET STARTED; PLAN • Divider; PLAN • Action spacer; ACTION • Use Freemium; PLAN CARD • Standard; PLAN TAG • FOR GROWING TEAMS; ACTION • Explore Standard benefits; PLAN CARD • Premium; PLAN TAG • ADVANCED CAPABILITIES; ACTION • Explore Premium benefits; PLANS • Details and next steps; PLANS • Guidance columns; GUIDANCE • CREDITS & FELI; GUIDANCE • STORE & DOMAIN; GUIDANCE • PAYMENT STATUS; MOBILE • Subscription plans; PLAN • Freemium; BUTTON / Premium v2 • Continue with Freemium; PLAN • Standard; BUTTON / Premium v2 • Checkout unavailable; PLAN • Premium; MOBILE NAV • Icon tabs; TAB • Plans; TAB • Packages; TAB • Billing; TAB • More
- **07.02 — Secure payment handoff** — Desktop `1665:1464`, Mobile `1902:1521`
  - PAYMENT UI • Journey stages; Step • 01 Choose package; Step • 02 Review checkout; Step • 03 Pay with Paystack; Step • 04 Confirm status; PAYMENT UI • Checkout details; DISABLED • Paid checkout pending; PAYMENT UI • What happens next; PAYMENT UI • Informational footer; MOBILE • Payment handoff; STATUS • handoff; SUMMARY ROW • One-time package; SUMMARY ROW • Access duration; SUMMARY ROW • Payment status; GUIDANCE • handoff; STEP • 1; STEP NUMBER; STEP • 2; STEP • 3; BUTTON / Premium v2 • Checkout pending approval; MOBILE NAV • Icon tabs; TAB • Plans; TAB • Packages; TAB • Billing; TAB • More
- **07.03 — Payment processing** — Desktop `1665:1669`, Mobile `1902:1577`
  - UX • State introduction; UX • Journey overview; UX • Relevant account details; UX • Key account number; ACTION • Check payment status; UX • Personalised next steps; UX • Help and secondary action; ACTION • Payment not confirmed; MOBILE • Payment processing; STATUS • processing; SUMMARY ROW • One-time package; SUMMARY ROW • Access duration; SUMMARY ROW • Payment status; GUIDANCE • processing; STEP • 1; STEP NUMBER; STEP • 2; STEP • 3; BUTTON / Premium v2 • View transaction status →; MOBILE NAV • Icon tabs; TAB • Plans; TAB • Packages; TAB • Billing; TAB • More
- **07.04 — Payment successful** — Desktop `1665:1874`, Mobile `1902:1642`
  - UX • State introduction; UX • Journey overview; UX • Relevant account details; UX • Key account number; ACTION • Start setting up your business; UX • Personalised next steps; UX • Help and secondary action; ACTION • View subscription; MOBILE • Payment success; STATUS • success; SUMMARY ROW • One-time package; SUMMARY ROW • Access duration; SUMMARY ROW • Payment status; GUIDANCE • success; STEP • 1; STEP NUMBER; STEP • 2; STEP • 3; BUTTON / Premium v2 • Continue onboarding →; MOBILE NAV • Icon tabs; TAB • Plans; TAB • Packages; TAB • Billing; TAB • More
- **07.05 — Payment unsuccessful** — Desktop `1665:2079`, Mobile `1902:1707`
  - UX • State introduction; UX • Journey overview; UX • Relevant account details; UX • Key account number; ACTION • Review payment status; UX • Personalised next steps; UX • Help and secondary action; ACTION • Contact support; MOBILE • Payment failed; STATUS • failed; SUMMARY ROW • One-time package; SUMMARY ROW • Access duration; SUMMARY ROW • Payment status; GUIDANCE • failed; STEP • 1; STEP NUMBER; STEP • 2; STEP • 3; BUTTON / Premium v2 • Check payment status →; MOBILE NAV • Icon tabs; TAB • Plans; TAB • Packages; TAB • Billing; TAB • More
- **07.06 — Plan and usage** — Desktop `1665:2284`, Mobile `1902:1772`
  - UX • Plan overview; UX • Subscription tabs; TAB • 01 Current plan; TAB • 02 Daily usage; TAB • 03 Benefits; TAB • 04 Upgrade options; UX • Plan status details; UX • Current plan; ACTION • Compare plans; UX • Credits and account benefits; UX • Account note; MOBILE • Scroll content; BUTTON / Premium v2 • View plan and usage; MOBILE NAV • Icon tabs; TAB • Plans; TAB • Packages; TAB • Billing; TAB • More
- **07.07 — Daily credit limit** — Desktop `1665:2489`, Mobile `1902:1835`
  - UX • State introduction; UX • Journey overview; UX • Relevant account details; UX • Key account number; ACTION • Compare the plans; UX • Personalised next steps; UX • Help and secondary action; ACTION • View plan and usage; MOBILE • Scroll content; BUTTON / Premium v2 • Compare plans; MOBILE NAV • Icon tabs; TAB • Plans; TAB • Packages; TAB • Billing; TAB • More
- **07.08 — Trial ending** — Desktop `1665:2694`, Mobile `1902:1900`
  - UX • State introduction; UX • Journey overview; UX • Relevant account details; UX • Key account number; ACTION • Compare subscription plans; UX • Personalised next steps; UX • Help and secondary action; ACTION • Continue setup; MOBILE • Scroll content; BUTTON / Premium v2 • Review renewal; MOBILE NAV • Icon tabs; TAB • Plans; TAB • Packages; TAB • Billing; TAB • More
- **07.09 — Trial expired** — Desktop `1665:2899`, Mobile `1902:1965`
  - UX • State introduction; UX • Journey overview; UX • Relevant account details; UX • Key account number; ACTION • Explore available plans; UX • Personalised next steps; UX • Help and secondary action; ACTION • Get support; MOBILE • Scroll content; BUTTON / Premium v2 • Select new plan; MOBILE NAV • Icon tabs; TAB • Plans; TAB • Packages; TAB • Billing; TAB • More
- **07.10 — Change plan review** — Desktop `1665:3104`, Mobile `1902:2030`
  - UX • State introduction; UX • Journey overview; UX • Relevant account details; UX • Key account number; ACTION • View plan comparison; UX • Personalised next steps; UX • Help and secondary action; ACTION • Keep Freemium; MOBILE • Scroll content; DISABLED • Plan change pending; MOBILE NAV • Icon tabs; TAB • Plans; TAB • Packages; TAB • Billing; TAB • More
- **07.11 — Billing history** — Desktop `1665:3309`, Mobile `1902:2095`
  - UX • State introduction; UX • Journey overview; UX • Relevant account details; UX • Key account number; ACTION • Compare available plans; UX • Personalised next steps; UX • Help and secondary action; ACTION • Get billing support; MOBILE • Scroll content; BUTTON / Premium v2 • View billing history; MOBILE NAV • Icon tabs; TAB • Plans; TAB • Packages; TAB • Billing; TAB • More
- **07.12 — Startup packages** — Desktop `1664:4690`, Mobile `1902:1422`
  - PLANS • Introduction; PLANS • Package comparison; PLAN CARD • Starter; PLAN TAG • THE ESSENTIALS; PLAN • Divider; PLAN • Action spacer; ACTION • Review Starter package; PLAN CARD • Standard; PLAN TAG • FULL FEATURE SET; ACTION • Review Standard package; PLAN CARD • Premium; PLAN TAG • FULL FELI & STORE; ACTION • Review Premium package; PLANS • Details and next steps; PLANS • Guidance columns; GUIDANCE • 01 CHOOSE A PACKAGE; GUIDANCE • 02 SET UP YOUR BUSINESS; GUIDANCE • 03 WHAT HAPPENS NEXT; MOBILE • Scroll content; BUTTON / Premium v2 • Review Starter package; MOBILE NAV • Icon tabs; TAB • Plans; TAB • Packages; TAB • Billing; TAB • More
- **07.13 — Startup package review** — Desktop `1665:1259`, Mobile `1902:1456`
  - UX • State introduction; UX • Journey overview; UX • Relevant account details; UX • Key account number; DISABLED • Payment handoff pending; UX • Personalised next steps; UX • Help and secondary action; ACTION • Compare startup packages; MOBILE • Scroll content; MOBILE NAV • Icon tabs; TAB • Plans; TAB • Packages; TAB • Billing; TAB • More
- **07.14 — Standard startup package review** — Desktop `1853:1345`, Mobile `1902:2225`
  - UX • State introduction; UX • Journey overview; UX • Relevant account details; UX • Key account number; ACTION • Continue to secure checkout; UX • Personalised next steps; UX • Help and secondary action; ACTION • Compare startup packages; MOBILE • Scroll content; DISABLED • Payment handoff pending; MOBILE NAV • Icon tabs; TAB • Plans; TAB • Packages; TAB • Billing; TAB • More
- **07.15 — Premium startup package review** — Desktop `1853:1801`, Mobile `1902:2290`
  - UX • State introduction; UX • Journey overview; UX • Relevant account details; UX • Key account number; ACTION • Continue to secure checkout; UX • Personalised next steps; UX • Help and secondary action; ACTION • Compare startup packages; MOBILE • Scroll content; DISABLED • Payment handoff pending; MOBILE NAV • Icon tabs; TAB • Plans; TAB • Packages; TAB • Billing; TAB • More

## 08 — Online Store  (page id 2024:935)

**Sections:** Online Store (1923:1411)

**Screens: 20** (variant frames: 40)

- **08.01 — Create storefront** — Desktop `1866:1388`, Mobile `1885:1387`
  - CONTEXT / Create your online store; BUTTON / Preview; FORM / Create your online store; FORM / Row 1; FIELD / Store name *; FIELD / Business category *; FORM / Row 2; FIELD / Store description *; FIELD / Business email *; FORM / Row 3; FIELD / Support phone; FIELD / Free store URL; GUIDANCE / Create your online store; BUTTON / Create store; MOBILE • Scroll sections; BUTTON / Premium v2 • Create store; MOBILE NAV • Icon tabs; TAB • Store; TAB • Products; TAB • Analytics; TAB • More
- **08.02 — Launch checklist** — Desktop `1866:1593`, Mobile `1885:1438`
  - CONTEXT / Ready to launch?; BUTTON / Visit store; KPI / COMPLETION; KPI / PRODUCTS; KPI / TEMPLATE; KPI / STATUS; OVERVIEW / Activity; RECORD rows (e.g. Business identity); OVERVIEW / Next actions; MOBILE • Scroll sections; BUTTON / Premium v2 • Verify payment setup; BUTTON / Premium v2 • Preview storefront; MOBILE NAV • Icon tabs; TAB • Store; TAB • Products; TAB • Analytics; TAB • More
- **08.03 — Catalogue management** — Desktop `1866:1805`, Mobile `1885:1499`
  - CONTEXT / Store products; BUTTON / + Add product; CONTENT / Store products; FIELD / SEARCH; RECORD rows (e.g. Classic linen shirt); SUMMARY / Store products; MOBILE • Scroll sections; BUTTON / Premium v2 • Add product; MOBILE NAV • Icon tabs; TAB • Store; TAB • Products; TAB • Analytics; TAB • More
- **08.04 — Add & edit product** — Desktop `1866:2018`, Mobile `1885:1556`
  - CONTEXT / Add a product; BUTTON / Save draft; FORM / Add a product; FORM / Row 1; FIELD / Product name *; FIELD / Category *; FORM / Row 2; FIELD / Price (NGN) *; FIELD / Compare price; FORM / Row 3; FIELD / SKU *; FIELD / Stock available; FORM / Row 4; FIELD / Product images *; FIELD / Visibility; GUIDANCE / Add a product; BUTTON / Publish product; MOBILE • Scroll sections; BUTTON / Premium v2 • Publish product; MOBILE NAV • Icon tabs; TAB • Store; TAB • Products; TAB • Analytics; TAB • More
- **08.05 — Bulk product upload** — Desktop `1866:2235`, Mobile `1885:1616`
  - CONTEXT / Bulk upload products; BUTTON / Download template; FORM / Bulk upload products; FORM / Row 1; FIELD / Import file; FIELD / Batch size; FORM / Row 2; FIELD / Product name; FIELD / SKU; FORM / Row 3; FIELD / Price; FIELD / Quantity; FORM / Row 4; FIELD / Category; FIELD / Publication; GUIDANCE / Bulk upload products; BUTTON / Import 18 products; MOBILE • Scroll sections; BUTTON / Premium v2 • Import valid items; MOBILE NAV • Icon tabs; TAB • Store; TAB • Products; TAB • Analytics; TAB • More
- **08.06 — Inventory synchronization** — Desktop `1866:2452`, Mobile `1885:1676`
  - CONTEXT / Sync from inventory; BUTTON / Sync 4 selected; CONTENT / Sync from inventory; FIELD / SEARCH; RECORD rows (e.g. Classic linen shirt); SUMMARY / Sync from inventory; MOBILE • Scroll sections; BUTTON / Premium v2 • Sync selected products; MOBILE NAV • Icon tabs; TAB • Store; TAB • Products; TAB • Analytics; TAB • More
- **08.07 — Product detail** — Desktop `1866:2665`, Mobile `1885:1733`
  - CONTEXT / Classic linen shirt; BUTTON / Edit product; CONTENT / Classic linen shirt; RECORD rows (e.g. Selling price); SUMMARY / Classic linen shirt; MOBILE • Scroll sections; BUTTON / Premium v2 • Edit product; MOBILE NAV • Icon tabs; TAB • Store; TAB • Products; TAB • Analytics; TAB • More
- **08.08 — Template selection** — Desktop `1866:2874`, Mobile `1885:1787`
  - CONTEXT / Choose a storefront template; STORE TEMPLATE / Basic; BUTTON / Choose Basic; STORE TEMPLATE / Standard; BUTTON / Choose Standard; STORE TEMPLATE / Premium; BUTTON / Choose Premium; MOBILE • Scroll sections; BUTTON / Premium v2 • Choose template; MOBILE NAV • Icon tabs; TAB • Store; TAB • Products; TAB • Analytics; TAB • More
- **08.09 — Store domain settings** — Desktop `1866:3067`, Mobile `1885:1825`
  - CONTEXT / Domains and website settings; BUTTON / Visit store; FORM / Domains and website settings; FORM / Row 1; FIELD / Bimanage address; FIELD / Custom domain; FORM / Row 2; FIELD / DNS record; FIELD / DNS host; FORM / Row 3; FIELD / Target; FIELD / Verification; FORM / Row 4; FIELD / SSL certificate; FIELD / Plan requirement; GUIDANCE / Domains and website settings; BUTTON / Verify domain; MOBILE • Scroll sections; BUTTON / Premium v2 • Verify domain; MOBILE NAV • Icon tabs; TAB • Store; TAB • Products; TAB • Analytics; TAB • More
- **08.10 — Analytics and sales** — Desktop `1866:3284`, Mobile `1885:1885`
  - CONTEXT / Store performance; BUTTON / Export CSV; KPI / REVENUE; KPI / ORDERS; KPI / PRODUCT VIEWS; KPI / TOP PRODUCT; OVERVIEW / Activity; RECORD rows (e.g. Classic linen shirt); OVERVIEW / Next actions; MOBILE • Scroll sections; CHART rows (e.g. Store revenue bars / illustrat); BUTTON / Premium v2 • Export sales report; MOBILE NAV • Icon tabs; TAB • Store; TAB • Products; TAB • Analytics; TAB • More
- **08.11 — Public storefront** — Desktop `1866:3509`, Mobile `1885:1946`
  - STOREFRONT / Navigation; STOREFRONT • Home; SEARCH & CATEGORY BAR; SEARCH • Products; FILTER • All categories; FILTER • Price: Any; FILTER • In stock; STORE • Responsive storefront; BUTTON / Premium v2 • Explore the collection →; SEARCH • Product search; FILTERS • Collections; FILTER • All; FILTER • Clothing; FILTER • Bags; FILTER • Accessories; MOBILE NAV • Icon tabs; TAB • Shop; TAB • Search; TAB • Bag; TAB • Help
- **08.12 — Customer search and filters** — Desktop `1866:3554`, Mobile `1885:1991`
  - STOREFRONT / Navigation; STOREFRONT • Search & filtering; SEARCH & CATEGORY BAR; SEARCH • Products; FILTER • All categories; FILTER • Price: Any; FILTER • In stock; MOBILE • Scroll sections; BUTTON / Premium v2 • Apply filters; MOBILE NAV • Icon tabs; TAB • Shop; TAB • Search; TAB • Bag; TAB • Help
- **08.13 — Public product detail** — Desktop `1866:3599`, Mobile `1885:2036`
  - STOREFRONT / Navigation; PUBLIC WEB • product workflow; FIELD • Product details; FIELD • Colour; FIELD • Size; FIELD • Quantity; FIELD • Availability; BUTTON • Add to bag; MOBILE • Scroll sections; BUTTON / Premium v2 • Add to bag; MOBILE NAV • Icon tabs; TAB • Shop; TAB • Search; TAB • Bag; TAB • Help
- **08.14 — Customer shopping cart** — Desktop `1866:3649`, Mobile `1885:2088`
  - STOREFRONT / Navigation; PUBLIC WEB • cart workflow; SUMMARY • Items subtotal; SUMMARY • Delivery estimate; SUMMARY • Order total; BUTTON • Proceed to checkout; MOBILE • Scroll sections; BUTTON / Premium v2 • Proceed to checkout; MOBILE NAV • Icon tabs; TAB • Shop; TAB • Search; TAB • Bag; TAB • Help
- **08.15 — Customer guest checkout** — Desktop `1866:3695`, Mobile `1885:2137`
  - STOREFRONT / Navigation; PUBLIC WEB • checkout workflow; FIELD • Full name *; FIELD • Email address *; FIELD • Phone number *; FIELD • Delivery address *; FIELD • City / State *; FIELD • Delivery note; SUMMARY • Classic linen shirt; SUMMARY • Everyday tote bag; SUMMARY • Delivery; SUMMARY • Amount due; BUTTON • Continue to Paystack; STORE MOBILE • Guest checkout; STEP • 1 Details; STEP • 2 Payment; STEP • 3 Review; FORM • Contact details; FIELD • FULL NAME *; FIELD • EMAIL ADDRESS *; FIELD • PHONE NUMBER *; FORM • Delivery details; FIELD • DELIVERY ADDRESS *; FIELD • CITY & STATE *; FIELD • DELIVERY NOTE; SUMMARY • Checkout total; SUMMARY ITEM • Classic linen shirt; SUMMARY ITEM • Everyday tote bag; SUMMARY ITEM • Delivery; BUTTON / Premium v2 • Continue to secure payment → …
- **08.16 — Payment verifying** — Desktop `1866:3748`, Mobile `1885:2192`
  - PUBLIC STATUS / Order context; TRANSACTION / Verifying payment; RECORD rows (e.g. Order); BUTTON / Check payment status; STOREFRONT / Navigation; MOBILE • Scroll sections; BUTTON / Premium v2 • Check payment; MOBILE NAV • Icon tabs; TAB • Shop; TAB • Search; TAB • Bag; TAB • Help
- **08.17 — Payment successful** — Desktop `1866:3928`, Mobile `1885:2223`
  - PUBLIC STATUS / Order context; TRANSACTION / Payment successful; RECORD rows (e.g. Order); BUTTON / Track order; STOREFRONT / Navigation; MOBILE • Scroll sections; BUTTON / Premium v2 • Track order; MOBILE NAV • Icon tabs; TAB • Shop; TAB • Search; TAB • Bag; TAB • Help
- **08.18 — Payment unsuccessful** — Desktop `1866:4111`, Mobile `1885:2257`
  - PUBLIC STATUS / Order context; TRANSACTION / Payment not completed; RECORD rows (e.g. Order); BUTTON / Retry payment; STOREFRONT / Navigation; MOBILE • Scroll sections; BUTTON / Premium v2 • Retry payment; MOBILE NAV • Icon tabs; TAB • Shop; TAB • Search; TAB • Bag; TAB • Help
- **08.19 — Guest order tracking** — Desktop `1866:4291`, Mobile `1885:2288`
  - STOREFRONT / Navigation; PUBLIC WEB • tracking workflow; FIELD • Order reference; SUMMARY • Order reference; SUMMARY • Payment; SUMMARY • Delivery address; SUMMARY • Merchant; BUTTON • Contact store support; MOBILE • Scroll sections; BUTTON / Premium v2 • Search tracking number; MOBILE NAV • Icon tabs; TAB • Shop; TAB • Search; TAB • Bag; TAB • Help
- **08.20 — Empty cart & validation states** — Desktop `1866:4341`, Mobile `1885:2340`
  - PUBLIC • Status guidance; TRANSACTION / Your bag is empty; RECORD rows (e.g. Empty cart); BUTTON / Explore products; STOREFRONT / Navigation; MOBILE • Scroll sections; BUTTON / Premium v2 • Explore products; MOBILE NAV • Icon tabs; TAB • Shop; TAB • Search; TAB • Bag; TAB • Help

## 09 — Inventory & Customers  (page id 2024:936)

**Sections:** Inventory & Customers (1923:1414)

**Screens: 11** (variant frames: 22)

- **09.01 — Customers — Directory and add customer** — Desktop `1674:2584`, Mobile `1899:1579`
  - table heading; table 11; button ; table 12; table10; table 9; button; table 8; table 7; table 6; table 5; table 4; table 3; table 2; table 1; DIRECTORY • Headline; DIRECTORY • Search and records; SEARCH • Customer directory; TABLE • Headers; RECORD rows (e.g. Amina Yusuf); DIRECTORY • Editing panel; INPUT • FIRST NAME; INPUT • LAST NAME; INPUT • EMAIL; INPUT • PHONE; INPUT • ADDRESS; ACTION • Save customer; MOBILE • Structured scroll; BUTTON / Premium v2 • Save customer; MOBILE NAV • Icon tabs …
- **09.02 — Customers — Edit details** — Desktop `1674:4615`, Mobile `1899:1882`
  - table heading; table 11; button ; table 12; table10; table 9; button; table 8; table 7; table 6; table 5; table 4; table 3; table 2; table 1; DIRECTORY • Headline; DIRECTORY • Search and records; SEARCH • Customer directory; TABLE • Headers; RECORD rows (e.g. Amina Yusuf); DIRECTORY • Editing panel; INPUT • FIRST NAME; INPUT • LAST NAME; INPUT • EMAIL; INPUT • PHONE; INPUT • ADDRESS; ACTION • Save changes; MOBILE • Structured scroll; BUTTON / Premium v2 • Save changes; MOBILE NAV • Icon tabs …
- **09.03 — Customers — Customer added** — Desktop `1698:2559`, Mobile `1901:1911`
  - OUTCOME • Status hero; OUTCOME • Record summary; ACTION • Go to customers; ACTION • Create invoice; OUTCOME • Actionable steps; OUTCOME • Helpful detail; MOBILE • Structured scroll; MOBILE NAV • Icon tabs; TAB • Inventory; TAB • Customers; TAB • Stock; TAB • More
- **09.04 — Inventory — Barcode lookup** — Desktop `1893:4730`, Mobile `1898:1388`
  - CONTEXT / Create your online store; BUTTON / Preview; FORM / Create your online store; FORM / Row 1; FIELD / Store name *; FIELD / Business category *; FORM / Row 2; FIELD / Store description *; FIELD / Business email *; FORM / Row 3; FIELD / Support phone; FIELD / Free store URL; GUIDANCE / Create your online store; BUTTON / Create store; MOBILE • Reflowed content; BUTTON / Premium v2 • Find product; MOBILE NAV • Icon tabs; TAB • Inventory; TAB • Customers; TAB • Stock; TAB • More
- **09.05 — Inventory — Add/edit product details** — Desktop `1893:4935`, Mobile `1898:1439`
  - CONTEXT / Add a product; BUTTON / Save draft; FORM / Add a product; FORM / Row 1; FIELD / Product name *; FIELD / Category *; FORM / Row 2; FIELD / Price (NGN) *; FIELD / Compare price; FORM / Row 3; FIELD / SKU *; FIELD / Stock available; FORM / Row 4; FIELD / Product images *; FIELD / Visibility; GUIDANCE / Add a product; BUTTON / Publish product; MOBILE • Reflowed content; BUTTON / Premium v2 • Save product; MOBILE NAV • Icon tabs; TAB • Inventory; TAB • Customers; TAB • Stock; TAB • More
- **09.06 — Inventory — Stock adjustment** — Desktop `1893:5152`, Mobile `1898:1499`
  - CONTEXT / Add a product; BUTTON / Save draft; FORM / Add a product; FORM / Row 1; FIELD / Product name *; FIELD / Category *; FORM / Row 2; FIELD / Price (NGN) *; FIELD / Compare price; FORM / Row 3; FIELD / SKU *; FIELD / Stock available; FORM / Row 4; FIELD / Product images *; FIELD / Visibility; GUIDANCE / Add a product; BUTTON / Publish product; MOBILE • Reflowed content; BUTTON / Premium v2 • Save stock adjustment; MOBILE NAV • Icon tabs; TAB • Inventory; TAB • Customers; TAB • Stock; TAB • More
- **09.07 — Inventory — Low stock monitor** — Desktop `1893:5369`, Mobile `1898:1559`
  - CONTEXT / Store products; BUTTON / + Add product; CONTENT / Store products; FIELD / SEARCH; RECORD rows (e.g. Classic linen shirt); SUMMARY / Store products; MOBILE • Reflowed content; BUTTON / Premium v2 • Export stock report; MOBILE NAV • Icon tabs; TAB • Inventory; TAB • Customers; TAB • Stock; TAB • More
- **09.08 — Inventory — Export completed** — Desktop `1893:5582`, Mobile `1898:1616`
  - CONTEXT / Verifying payment; BUTTON / Check payment status; TRANSACTION / Verifying payment; RECORD rows (e.g. Order); MOBILE • Reflowed content; BUTTON / Premium v2 • Back to inventory; MOBILE NAV • Icon tabs; TAB • Inventory; TAB • Customers; TAB • Stock; TAB • More
- **09.09 — Inventory / Add first product** — Desktop `1889:2174`, Mobile `1889:8251`
  - CONTEXT / Create your online store; BUTTON / Preview; FORM / Create your online store; FORM / Row 1; FIELD / Store name *; FIELD / Business category *; FORM / Row 2; FIELD / Store description *; FIELD / Business email *; FORM / Row 3; FIELD / Support phone; FIELD / Free store URL; GUIDANCE / Create your online store; BUTTON / Create store; MOBILE • Scroll sections; BUTTON / Premium v2 • Add product; MOBILE NAV • Icon tabs; TAB • Inventory; TAB • Customers; TAB • Stock; TAB • More
- **09.10 — Inventory / Overview** — Desktop `1889:2379`, Mobile `1925:1387`
  - CONTEXT / Ready to launch?; BUTTON / Visit store; KPI / COMPLETION; KPI / PRODUCTS; KPI / TEMPLATE; KPI / STATUS; OVERVIEW / Activity; RECORD rows (e.g. Business identity); OVERVIEW / Next actions; MOBILE • Scroll sections; CHART rows (e.g. Product availability / mobile); BUTTON / Premium v2 • Add product; MOBILE NAV • Icon tabs; TAB • Inventory; TAB • Customers; TAB • Stock; TAB • More
- **09.11 — Inventory / Product register** — Desktop `1889:2591`, Mobile `1925:1445`
  - CONTEXT / Store products; BUTTON / + Add product; CONTENT / Store products; FIELD / SEARCH; RECORD rows (e.g. Classic linen shirt); SUMMARY / Store products; MOBILE • Scroll sections; BUTTON / Premium v2 • Add product; MOBILE NAV • Icon tabs; TAB • Inventory; TAB • Customers; TAB • Stock; TAB • More

## 10 — BiSupplyNet  (page id 2024:937)

**Sections:** BiSupplyNet (1923:1417)

**Screens: 12** (variant frames: 24)

- **10.01 — Find suppliers** — Desktop `1874:1388`, Mobile `1888:1861`
  - CONTEXT / Store products; BUTTON / + Add product; CONTENT / Store products; FIELD / SEARCH; RECORD rows (e.g. Classic linen shirt); SUMMARY / Store products; MOBILE • Scroll content; FIELD • SEARCH; BUTTON / Premium v2 • Explore suppliers; MOBILE NAV • Icon tabs; TAB • Suppliers; TAB • Orders; TAB • Disputes; TAB • More
- **10.02 — Verified supplier profile** — Desktop `1874:1733`, Mobile `1888:1918`
  - CONTEXT / Classic linen shirt; BUTTON / Edit product; CONTENT / Classic linen shirt; RECORD rows (e.g. Selling price); SUMMARY / Classic linen shirt; FIELD • Your experience; BUTTON • Submit buyer review; MOBILE • Verified supplier profile; SECTION • Wholesale catalogue; SECTION • Business details; BUTTON / Premium v2 • Request supplier connection →; MOBILE NAV • Icon tabs; TAB • Suppliers; TAB • Orders; TAB • Disputes; TAB • More
- **10.03 — Wholesaler application** — Desktop `1874:2074`, Mobile `1888:1972`
  - CONTEXT / Add a product; BUTTON / Save draft; FORM / Add a product; FORM / Row 1; FIELD / Product name *; FIELD / Category *; FORM / Row 2; FIELD / Price (NGN) *; FIELD / Compare price; FORM / Row 3; FIELD / SKU *; FIELD / Stock available; FORM / Row 4; FIELD / Product images *; FIELD / Visibility; GUIDANCE / Add a product; BUTTON / Publish product; MOBILE • Scroll content; FIELD • REGISTERED BUSINESS NAME; FIELD • CAC REGISTRATION NUMBER; FIELD • SUPPLY CATEGORY; FIELD • STATE / REGION; FIELD • BUSINESS ADDRESS; FIELD • EMAIL ADDRESS; FIELD • VERIFICATION DOCUMENT; FIELD • PROFILE TRUST SCORE; BUTTON / Premium v2 • Submit application; MOBILE NAV • Icon tabs; TAB • Suppliers; TAB • Orders …
- **10.04 — Application review** — Desktop `1874:2423`, Mobile `1888:2032`
  - CONTEXT / Verifying payment; BUTTON / Check payment status; TRANSACTION / Verifying payment; RECORD rows (e.g. Order); MOBILE • Scroll content; BUTTON / Premium v2 • View application; MOBILE NAV • Icon tabs; TAB • Suppliers; TAB • Orders; TAB • Disputes; TAB • More
- **10.05 — Wholesale product catalogue** — Desktop `1875:1387`, Mobile `1888:2065`
  - CONTEXT / Store products; BUTTON / + Add product; CONTENT / Store products; FIELD / SEARCH; RECORD rows (e.g. Classic linen shirt); SUMMARY / Store products; MOBILE • Scroll content; FIELD • SEARCH; BUTTON / Premium v2 • Add wholesale item; MOBILE NAV • Icon tabs; TAB • Suppliers; TAB • Orders; TAB • Disputes; TAB • More
- **10.06 — Bulk order checkout** — Desktop `1875:1732`, Mobile `1888:2122`
  - CONTEXT / Add a product; BUTTON / Save draft; FORM / Add a product; FORM / Row 1; FIELD / Product name *; FIELD / Category *; FORM / Row 2; FIELD / Price (NGN) *; FIELD / Compare price; FORM / Row 3; FIELD / SKU *; FIELD / Stock available; FORM / Row 4; FIELD / Product images *; FIELD / Visibility; GUIDANCE / Add a product; BUTTON / Publish product; MOBILE • Scroll content; FIELD • PRODUCT; FIELD • UNIT PRICE; FIELD • QUANTITY • MIN 10; FIELD • ITEMS TOTAL; FIELD • DELIVERY ADDRESS; FIELD • RECEIVING BUSINESS; FIELD • CONTACT PHONE; FIELD • PAYMENT METHOD; BUTTON / Premium v2 • Review bulk order; MOBILE NAV • Icon tabs; TAB • Suppliers; TAB • Orders …
- **10.07 — Protected escrow payment** — Desktop `1875:2081`, Mobile `1888:2182`
  - CONTEXT / Payment successful; BUTTON / Track order; TRANSACTION / Payment successful; RECORD rows (e.g. Order); MOBILE • Scroll content; BUTTON / Premium v2 • Track order; MOBILE NAV • Icon tabs; TAB • Suppliers; TAB • Orders; TAB • Disputes; TAB • More
- **10.08 — Wholesale order tracking** — Desktop `1875:2396`, Mobile `1888:2218`
  - CONTEXT / Classic linen shirt; BUTTON / Edit product; CONTENT / Classic linen shirt; RECORD rows (e.g. Selling price); SUMMARY / Classic linen shirt; MOBILE • Scroll content; BUTTON / Premium v2 • View order details; MOBILE NAV • Icon tabs; TAB • Suppliers; TAB • Orders; TAB • Disputes; TAB • More
- **10.09 — Confirm delivery** — Desktop `1877:1387`, Mobile `1888:2272`
  - CONTEXT / Verifying payment; BUTTON / Check payment status; TRANSACTION / Verifying payment; RECORD rows (e.g. Order); MOBILE • Scroll content; BUTTON / Premium v2 • Confirm received goods; MOBILE NAV • Icon tabs; TAB • Suppliers; TAB • Orders; TAB • Disputes; TAB • More
- **10.10 — File a dispute** — Desktop `1877:1699`, Mobile `1888:2305`
  - CONTEXT / Add a product; BUTTON / Save draft; FORM / Add a product; FORM / Row 1; FIELD / Product name *; FIELD / Category *; FORM / Row 2; FIELD / Price (NGN) *; FIELD / Compare price; FORM / Row 3; FIELD / SKU *; FIELD / Stock available; FORM / Row 4; FIELD / Product images *; FIELD / Visibility; GUIDANCE / Add a product; BUTTON / Publish product; MOBILE • Scroll content; FIELD • DISPUTE REASON *; FIELD • ORDER REFERENCE; FIELD • DATE RECEIVED; FIELD • AFFECTED QUANTITY; FIELD • AMOUNT DISPUTED; FIELD • DESCRIPTION *; FIELD • SUPPORTING EVIDENCE *; FIELD • REQUESTED RESOLUTION; BUTTON / Premium v2 • Submit dispute; MOBILE NAV • Icon tabs; TAB • Suppliers; TAB • Orders …
- **10.11 — Dispute review** — Desktop `1877:2048`, Mobile `1888:2365`
  - CONTEXT / Classic linen shirt; BUTTON / Edit product; CONTENT / Classic linen shirt; RECORD rows (e.g. Selling price); SUMMARY / Classic linen shirt; MOBILE • Scroll content; BUTTON / Premium v2 • Add dispute evidence; MOBILE NAV • Icon tabs; TAB • Suppliers; TAB • Orders; TAB • Disputes; TAB • More
- **10.12 — Supplier earnings** — Desktop `1877:2389`, Mobile `1888:2419`
  - CONTEXT / Ready to launch?; BUTTON / Visit store; KPI / COMPLETION; KPI / PRODUCTS; KPI / TEMPLATE; KPI / STATUS; OVERVIEW / Activity; RECORD rows (e.g. Business identity); OVERVIEW / Next actions; CHART rows (e.g. Supplier funds split / desktop); MOBILE • Scroll content; BUTTON / Premium v2 • View earnings; MOBILE NAV • Icon tabs; TAB • Suppliers; TAB • Orders; TAB • Disputes; TAB • More

## 11 — FELI AI  (page id 2024:938)

**Sections:** FELI AI (1923:1420)

**Screens: 5** (variant frames: 10)

- **11.01 — Action proposal** — Desktop `1897:1387`, Mobile `1898:2252`
  - CONTEXT / Create your online store; BUTTON / Preview; FORM / Create your online store; FORM / Row 1; FIELD / Store name *; FIELD / Business category *; FORM / Row 2; FIELD / Store description *; FIELD / Business email *; FORM / Row 3; FIELD / Support phone; FIELD / Free store URL; GUIDANCE / Create your online store; BUTTON / Create store; MOBILE • Reflowed content; BUTTON / Premium v2 • Review FELI action; MOBILE NAV • Icon tabs; TAB • FELI; TAB • Actions; TAB • Usage; TAB • More
- **11.02 — Create task review** — Desktop `1897:1592`, Mobile `1898:2303`
  - CONTEXT / Create your online store; BUTTON / Preview; FORM / Create your online store; FORM / Row 1; FIELD / Store name *; FIELD / Business category *; FORM / Row 2; FIELD / Store description *; FIELD / Business email *; FORM / Row 3; FIELD / Support phone; FIELD / Free store URL; GUIDANCE / Create your online store; BUTTON / Create store; MOBILE • Reflowed content; MOBILE NAV • Icon tabs; TAB • FELI; TAB • Actions; TAB • Usage; TAB • More
- **11.03 — Daily credit limit** — Desktop `1897:1797`, Mobile `1898:2354`
  - CONTEXT / Verifying payment; BUTTON / Check payment status; TRANSACTION / Verifying payment; RECORD rows (e.g. Order); MOBILE • Reflowed content; MOBILE NAV • Icon tabs; TAB • FELI; TAB • Actions; TAB • Usage; TAB • More
- **11.04 — Premium action restriction** — Desktop `1897:1979`, Mobile `1898:2387`
  - CONTEXT / Verifying payment; BUTTON / Check payment status; TRANSACTION / Verifying payment; RECORD rows (e.g. Order); MOBILE • Reflowed content; MOBILE NAV • Icon tabs; TAB • FELI; TAB • Actions; TAB • Usage; TAB • More
- **11.05 — FELI AI — Assistant** — Desktop `1679:3697`, Mobile `1902:2419`
  - FELI • Welcome; FELI • Interactive chat view; ACTION • Send; FELI • Plan access and human support; PLAN • FREEMIUM; PLAN • STANDARD; PLAN • PREMIUM; ACTION • Open support; MOBILE • Scroll content; BUTTON / Premium v2 • Ask FELI a question; MOBILE NAV • Icon tabs; TAB • FELI; TAB • Actions; TAB • Usage; TAB • More

## 12 — Messaging & Support  (page id 2024:939)

**Sections:** Messaging & Support (1923:1423)

**Screens: 18** (variant frames: 36)

- **12.01 — Messaging — Conversation directory** — Desktop `1896:1388`, Mobile `1898:1886`
  - CONTEXT / Store products; BUTTON / + Add product; CONTENT / Store products; FIELD / SEARCH; RECORD rows (e.g. Classic linen shirt); SUMMARY / Store products; MOBILE • Reflowed content; BUTTON / Premium v2 • Start conversation; MOBILE NAV • Icon tabs; TAB • Messages; TAB • Support; TAB • Alerts; TAB • More
- **12.02 — Messaging — Protected order conversation** — Desktop `1896:1601`, Mobile `1898:1943`
  - CONTEXT / Classic linen shirt; BUTTON / Edit product; CONTENT / Classic linen shirt; RECORD rows (e.g. Selling price); SUMMARY / Classic linen shirt; MOBILE • Reflowed content; BUTTON / Premium v2 • Open protected order chat; MOBILE NAV • Icon tabs; TAB • Messages; TAB • Support; TAB • Alerts; TAB • More
- **12.03 — Messaging — Guest customer support** — Desktop `1896:1810`, Mobile `1898:1997`
  - CONTEXT / Create your online store; BUTTON / Preview; FORM / Create your online store; FORM / Row 1; FIELD / Store name *; FIELD / Business category *; FORM / Row 2; FIELD / Store description *; FIELD / Business email *; FORM / Row 3; FIELD / Support phone; FIELD / Free store URL; GUIDANCE / Create your online store; BUTTON / Create store; MOBILE • Reflowed content; BUTTON / Premium v2 • Reply to guest; MOBILE NAV • Icon tabs; TAB • Messages; TAB • Support; TAB • Alerts; TAB • More
- **12.04 — Messaging — Block action restricted** — Desktop `1896:2015`, Mobile `1898:2048`
  - CONTEXT / Verifying payment; BUTTON / Check payment status; TRANSACTION / Verifying payment; RECORD rows (e.g. Order); MOBILE • Reflowed content; BUTTON / Premium v2 • Review block restriction; MOBILE NAV • Icon tabs; TAB • Messages; TAB • Support; TAB • Alerts; TAB • More
- **12.05 — Support — Submit a ticket** — Desktop `1896:2197`, Mobile `1898:2081`
  - CONTEXT / Add a product; BUTTON / Save draft; FORM / Add a product; FORM / Row 1; FIELD / Product name *; FIELD / Category *; FORM / Row 2; FIELD / Price (NGN) *; FIELD / Compare price; FORM / Row 3; FIELD / SKU *; FIELD / Stock available; FORM / Row 4; FIELD / Product images *; FIELD / Visibility; GUIDANCE / Add a product; BUTTON / Publish product; MOBILE • Reflowed content; BUTTON / Premium v2 • Submit ticket; MOBILE NAV • Icon tabs; TAB • Messages; TAB • Support; TAB • Alerts; TAB • More
- **12.06 — Support — Ticket detail and replies** — Desktop `1896:2414`, Mobile `1898:2141`
  - CONTEXT / Classic linen shirt; BUTTON / Edit product; CONTENT / Classic linen shirt; RECORD rows (e.g. Selling price); SUMMARY / Classic linen shirt; MOBILE • Reflowed content; BUTTON / Premium v2 • Reply to ticket; MOBILE NAV • Icon tabs; TAB • Messages; TAB • Support; TAB • Alerts; TAB • More
- **12.07 — Support — Help centre** — Desktop `1896:2623`, Mobile `1898:2195`
  - CONTEXT / Store products; BUTTON / + Add product; CONTENT / Store products; FIELD / SEARCH; RECORD rows (e.g. Classic linen shirt); SUMMARY / Store products; MOBILE • Reflowed content; BUTTON / Premium v2 • Contact support; MOBILE NAV • Icon tabs; TAB • Messages; TAB • Support; TAB • Alerts; TAB • More
- **12.08 — Notifications — Alert delivery preferences** — Desktop `1897:2161`, Mobile `1898:2420`
  - CONTEXT / Create your online store; BUTTON / Preview; FORM / Create your online store; FORM / Row 1; FIELD / Store name *; FIELD / Business category *; FORM / Row 2; FIELD / Store description *; FIELD / Business email *; FORM / Row 3; FIELD / Support phone; FIELD / Free store URL; GUIDANCE / Create your online store; BUTTON / Create store; MOBILE • Reflowed content; BUTTON / Premium v2 • Save alert preferences; MOBILE NAV • Icon tabs; TAB • Messages; TAB • Support; TAB • Alerts; TAB • More
- **12.09 — Support — Ticket centre** — Desktop `1679:3317`, Mobile `1902:2356`
  - table heading; table 11; button ; table 12; table10; table 9; button; table 8; table 7; table 6; table 5; table 4; table 3; table 2; table 1; SUPPORT • Intro; SUPPORT • Help articles and tickets; SUPPORT • Create a ticket; INPUT • TOPIC; INPUT • SUBJECT; INPUT • DESCRIPTION; INPUT • ATTACHMENTS; SUPPORT • Service requests; MOBILE • Scroll content; BUTTON / Premium v2 • Create support ticket; MOBILE NAV • Icon tabs; TAB • Messages; TAB • Support; TAB • Alerts; TAB • More
- **12.10 — Messaging — Conversations** — Desktop `1679:3902`, Mobile `1902:2475`
  - table heading; table 11; button ; table 12; table10; table 9; button; table 8; table 7; table 6; table 5; table 4; table 3; table 2; table 1; MESSAGING • Intro; MESSAGING • Conversation list; MESSAGING • Active thread; ACTION • Send; MESSAGING • Safeguards; MOBILE • Scroll content; BUTTON / Premium v2 • Open conversation; MOBILE NAV • Icon tabs; TAB • Messages; TAB • Support; TAB • Alerts; TAB • More
- **12.11 — Notifications — Centre** — Desktop `1679:4282`, Mobile `1902:2541`
  - DASHBOARD • Intro; DASHBOARD • KPI cards; KPI • ALL ALERTS; KPI • UNREAD; KPI • ORDERS; KPI • LOW STOCK; DASHBOARD • Primary records; RECORD rows (e.g. New order); DASHBOARD • Next actions; DASHBOARD • Tasks; ACTION • Orders; ACTION • Support; MOBILE • Scroll content; BUTTON / Premium v2 • View notifications; MOBILE NAV • Icon tabs; TAB • Messages; TAB • Support; TAB • Alerts; TAB • More
- **12.12 — Support — Ticket submission confirmation** — Desktop `1817:2744`, Mobile `1902:2723`
  - table heading; table 11; button ; table 12; table10; table 9; button; table 8; table 7; table 6; table 5; table 4; table 3; table 2; table 1; INPUT • TOPIC; INPUT • SUBJECT; INPUT • DESCRIPTION; INPUT • ATTACHMENTS; FLOW • Intro; FLOW • Details; ACTION • Back to support centre; ACTION • View notifications; FLOW • What happens next; FLOW • Status note; MOBILE CONTENT • ticket; SUCCESS • Support ticket; STEPS • What happens next; STEP • 1; STEP • 2 …
- **12.13 — Notifications — Preferences** — Desktop `1820:1328`, Mobile `1902:2786`
  - KPI • ALL ALERTS; KPI • UNREAD; KPI • ORDERS; KPI • LOW STOCK; RECORD rows (e.g. New order); ACTION • Orders; ACTION • Support; PREFERENCES • Intro; PREFERENCES • Channels; PREFERENCES • Guidance; ACTION • Back to alerts; MOBILE CONTENT • preferences; GUIDANCE • Alert control; BUTTON / Premium v2 • Save preferences →; MOBILE NAV • Icon tabs; TAB • Messages; TAB • Support; TAB • Alerts; TAB • More
- **12.14 — Support — BiTechTeam service request** — Desktop `1968:1286`, Mobile `1968:1516`
  - CONTEXT / Add a product; BUTTON / Save draft; FORM / Add a product; FORM / Row 1; FIELD / Product name *; FIELD / Category *; FORM / Row 2; FIELD / Price (NGN) *; FIELD / Compare price; FORM / Row 3; FIELD / SKU *; FIELD / Stock available; FORM / Row 4; FIELD / Product images *; FIELD / Visibility; GUIDANCE / Add a product; BUTTON / Publish product; MOBILE • Reflowed content; BUTTON / Premium v2 • Submit service request; MOBILE NAV • Icon tabs; TAB • Messages; TAB • Support; TAB • Alerts; TAB • More
- **12.16 — Reviews — Write platform review** — Desktop `1968:1577`, Mobile `1968:1807`
  - CONTEXT / Add a product; BUTTON / Save draft; FORM / Add a product; FORM / Row 1; FIELD / Product name *; FIELD / Category *; FORM / Row 2; FIELD / Price (NGN) *; FIELD / Compare price; FORM / Row 3; FIELD / SKU *; FIELD / Stock available; FORM / Row 4; FIELD / Product images *; FIELD / Visibility; GUIDANCE / Add a product; BUTTON / Publish product; MOBILE • Reflowed content; BUTTON / Premium v2 • Publish review; MOBILE NAV • Icon tabs; TAB • Messages; TAB • Support; TAB • Alerts; TAB • More
- **12.15 — Reviews — Public rating and feedback** — Desktop `1969:1286`, Mobile `1969:1327`
  - PUBLIC • Community introduction; REVIEWS • Average and distribution; REVIEWS • Empty state; PUBLIC • Reviews policy and action; ACTION • Write a review; REVIEWS • Discovery filters and transparent empty-data contr; PUBLIC • Feedback invitation; PUBLIC • Verified reviewer policy; REVIEWS • Mobile discovery filters; REVIEWS • Verified reviewer action; BUTTON • Sign in to write review; MOBILE NAV • Icon tabs; TAB • Messages; TAB • Support; TAB • Alerts; TAB • More
- **12.17 — Support — Service request submitted** — Desktop `1971:1286`, Mobile `1971:1545`
  - STATUS • Brand reassurance; STATUS • Detailed confirmation; RECORD rows (e.g. Service); GUIDANCE • What happens next; ACTION • View support activity; SURFACE • Status heading; DETAILS • Record summary; GUIDANCE • Next steps; MOBILE NAV • Icon tabs; TAB • Messages; TAB • Support; TAB • Alerts; TAB • More
- **12.18 — Reviews — Review submitted** — Desktop `1971:1632`, Mobile `1971:1891`
  - STATUS • Brand reassurance; STATUS • Detailed confirmation; RECORD rows (e.g. Rating); GUIDANCE • What happens next; ACTION • View public reviews; SURFACE • Status heading; DETAILS • Record summary; GUIDANCE • Next steps; MOBILE NAV • Icon tabs; TAB • Messages; TAB • Support; TAB • Alerts; TAB • More

## 13 — Account & Settings  (page id 2024:940)

**Sections:** Account & Settings (1923:1426)

**Screens: 8** (variant frames: 16)

- **13.01 — Business profile** — Desktop `1879:1388`, Mobile `1888:2481`
  - CONTEXT / Classic linen shirt; BUTTON / Edit product; CONTENT / Classic linen shirt; RECORD rows (e.g. Selling price); SUMMARY / Classic linen shirt; MOBILE • Scroll content; BUTTON / Premium v2 • Edit business profile; MOBILE NAV • Icon tabs; TAB • Profile; TAB • Security; TAB • Settings; TAB • More
- **13.02 — Edit business profile** — Desktop `1879:1729`, Mobile `1888:2535`
  - CONTEXT / Add a product; BUTTON / Save draft; FORM / Add a product; FORM / Row 1; FIELD / Product name *; FIELD / Category *; FORM / Row 2; FIELD / Price (NGN) *; FIELD / Compare price; FORM / Row 3; FIELD / SKU *; FIELD / Stock available; FORM / Row 4; FIELD / Product images *; FIELD / Visibility; GUIDANCE / Add a product; BUTTON / Publish product; MOBILE • Scroll content; FIELD • BUSINESS NAME *; FIELD • BUSINESS CATEGORY *; FIELD • CAC NUMBER; FIELD • BUSINESS PHONE *; FIELD • BUSINESS EMAIL *; FIELD • BUSINESS ADDRESS *; FIELD • BUSINESS WEBSITE; FIELD • BUSINESS LOGO; BUTTON / Premium v2 • Save business details; MOBILE NAV • Icon tabs; TAB • Profile; TAB • Security …
- **13.03 — Workspace preferences** — Desktop `1879:2078`, Mobile `1888:2595`
  - CONTEXT / Create your online store; BUTTON / Preview; FORM / Create your online store; FORM / Row 1; FIELD / Store name *; FIELD / Business category *; FORM / Row 2; FIELD / Store description *; FIELD / Business email *; FORM / Row 3; FIELD / Support phone; FIELD / Free store URL; GUIDANCE / Create your online store; BUTTON / Create store; MOBILE • Scroll content; FIELD • BUSINESS TIMEZONE; FIELD • DEFAULT CURRENCY; FIELD • DATE FORMAT; FIELD • LANGUAGE; FIELD • DASHBOARD START PAGE; FIELD • ACCESSIBILITY; BUTTON / Premium v2 • Save preferences; MOBILE NAV • Icon tabs; TAB • Profile; TAB • Security; TAB • Settings; TAB • More
- **13.04 — Security and password** — Desktop `1879:2415`, Mobile `1888:2646`
  - CONTEXT / Create your online store; BUTTON / Preview; FORM / Create your online store; FORM / Row 1; FIELD / Store name *; FIELD / Business category *; FORM / Row 2; FIELD / Store description *; FIELD / Business email *; FORM / Row 3; FIELD / Support phone; FIELD / Free store URL; GUIDANCE / Create your online store; BUTTON / Create store; MOBILE • Scroll content; FIELD • CURRENT PASSWORD *; FIELD • NEW PASSWORD *; FIELD • CONFIRM PASSWORD *; FIELD • PASSWORD STRENGTH; FIELD • EMAIL VERIFICATION; FIELD • LAST PASSWORD CHANGE; BUTTON / Premium v2 • Update password; MOBILE NAV • Icon tabs; TAB • Profile; TAB • Security; TAB • Settings; TAB • More
- **13.05 — Notifications preferences** — Desktop `1879:2752`, Mobile `1888:2697`
  - CONTEXT / Create your online store; BUTTON / Preview; FORM / Create your online store; FORM / Row 1; FIELD / Store name *; FIELD / Business category *; FORM / Row 2; FIELD / Store description *; FIELD / Business email *; FORM / Row 3; FIELD / Support phone; FIELD / Free store URL; GUIDANCE / Create your online store; BUTTON / Create store; MOBILE • Scroll content; FIELD • SALES / ORDERS; FIELD • WALLET PAYOUTS; FIELD • INVENTORY ALERTS; FIELD • NEW TEAM INVITATIONS; FIELD • PROJECT ASSIGNMENTS; FIELD • SECURITY ALERTS; BUTTON / Premium v2 • Save notifications; MOBILE NAV • Icon tabs; TAB • Profile; TAB • Security; TAB • Settings; TAB • More
- **13.06 — Sessions and devices** — Desktop `1879:3089`, Mobile `1888:2748`
  - CONTEXT / Store products; BUTTON / + Add product; CONTENT / Store products; FIELD / SEARCH; RECORD rows (e.g. Classic linen shirt); SUMMARY / Store products; MOBILE • Scroll content; FIELD • SEARCH; BUTTON / Premium v2 • Sign out of device; MOBILE NAV • Icon tabs; TAB • Profile; TAB • Security; TAB • Settings; TAB • More
- **13.07 — Session expired** — Desktop `1879:3434`, Mobile `1888:2805`
  - CONTEXT / Verifying payment; BUTTON / Check payment status; TRANSACTION / Verifying payment; RECORD rows (e.g. Order); MOBILE • Scroll content; MOBILE NAV • Icon tabs; TAB • Profile; TAB • Security; TAB • Settings; TAB • More
- **13.08 — Close account confirmation** — Desktop `1879:3746`, Mobile `1888:2838`
  - CONTEXT / Verifying payment; BUTTON / Check payment status; TRANSACTION / Verifying payment; RECORD rows (e.g. Order); MOBILE • Scroll content; BUTTON / Premium v2 • Keep my account; MOBILE NAV • Icon tabs; TAB • Profile; TAB • Security; TAB • Settings; TAB • More

## 14 — Analytics & Reports  (page id 2024:941)

**Sections:** Analytics & Reports (1923:1429)

**Screens: 4** (variant frames: 8)

- **14.01 — Company analytics** — Desktop `1895:1387`, Mobile `1898:1649`
  - CONTEXT / Store performance; BUTTON / Export CSV; KPI / REVENUE; KPI / ORDERS; KPI / PRODUCT VIEWS; KPI / TOP PRODUCT; OVERVIEW / Activity; RECORD rows (e.g. Classic linen shirt); CHART rows (e.g. Revenue by day / last 7 days /); OVERVIEW / Next actions; MOBILE • Reflowed content; BUTTON / Premium v2 • Export analytics CSV; MOBILE NAV • Icon tabs; TAB • Reports; TAB • Sales; TAB • Inventory; TAB • More
- **14.02 — Sales ledger** — Desktop `1895:1612`, Mobile `1898:1710`
  - CONTEXT / Store products; BUTTON / + Add product; FIELD / SEARCH; RECORD rows (e.g. Classic linen shirt); SUMMARY • Sales ledger and status mix; CHART rows (e.g. Order status / six preview row); MOBILE • Reflowed content; BUTTON / Premium v2 • Export sales ledger; MOBILE NAV • Icon tabs; TAB • Reports; TAB • Sales; TAB • Inventory; TAB • More
- **14.03 — Inventory health and value** — Desktop `1895:1825`, Mobile `1898:1767`
  - CONTEXT / Ready to launch?; BUTTON / Visit store; KPI / COMPLETION; KPI / PRODUCTS; KPI / TEMPLATE; KPI / STATUS; OVERVIEW / Activity; RECORD rows (e.g. Business identity); SUMMARY • Inventory alerts and stock health; CHART rows (e.g. Stock health / four preview it); MOBILE • Reflowed content; BUTTON / Premium v2 • Export inventory report; MOBILE NAV • Icon tabs; TAB • Reports; TAB • Sales; TAB • Inventory; TAB • More
- **14.04 — Invoice collections** — Desktop `1895:2037`, Mobile `1898:1828`
  - CONTEXT / Store products; BUTTON / + Add product; FIELD / SEARCH; RECORD rows (e.g. Classic linen shirt); SUMMARY • Invoice collections and status mix; CHART rows (e.g. Invoice status / six preview r); MOBILE • Reflowed content; BUTTON / Premium v2 • Export invoice collections; MOBILE NAV • Icon tabs; TAB • Reports; TAB • Sales; TAB • Inventory; TAB • More

## 15 — Social Media  (page id 2022:929)

**Sections:** Social Media (1923:1432) — heading "SECTION / 16 — Social content scheduling"

**Screens: 1** (variant frames: 2)

- **15.01 — Content scheduling** — Desktop `1674:3831`, Mobile `1899:1776`
  - "Coming soon / Meta platform approval" page. SOCIAL • Release status; SOCIAL • Scheduling preview with SCHEDULE FIELD • CHANNEL (Facebook/Instagram planned), CAPTION, MEDIA (image/video), DATE, TIME; DISABLED • "Schedule post — coming soon"; SOCIAL • Planned workflow (4 steps: connect accounts, prepare posts, pick schedule, monitor queued/sent/failed). Mobile: same as RECORD cards + COMPONENT • Primary action "Schedule content →"; MOBILE NAV tabs Content/Calendar/Analytics/More. Desktop also contains many hidden legacy layers (week calendar grid, follower stats, "Create post") — all hidden.


## 16 — Platform Administration  (page id 2024:942)

**Sections:** Platform Administration (1975:1286)

**Screens: 8** (variant frames: 16)

- **16.01 — Platform overview** — Desktop `1975:1288`, Mobile `1975:1289`
  - ADMIN / Top bar; STATUS • Administrative access; FIELD • Search; FILTER • All queues; FILTER • Queue priority; BUTTON • Review KYC; METRICS • Admin operational KPIs; METRIC • Merchants; METRIC • Protected funds; METRIC • Open disputes; RECORDS • Platform health & pending decisions; TABLE • Column labels; TABLE ROW • Supplier verification; TABLE ROW • Escrow dispute; TABLE ROW • Support ticket; TABLE ROW • Account safety review; STATUS • Backend integration; GUIDANCE • ADMIN WORKSPACE; ADMIN MOBILE • Platform overview; METRICS • Performance; METRIC • Escrow held; RECORDS • Platform overview; RECORD rows (e.g. Supplier verification); RECORD ACTION • High priority; RECORD ACTION • Review; RECORD ACTION • 24h target; BUTTON / Premium v2 • Review open queues →; MOBILE NAV • Icon tabs; TAB • Overview; TAB • Users …
- **16.02 — User accounts** — Desktop `1975:1405`, Mobile `1975:1406`
  - ADMIN / Top bar; STATUS • Administrative access; FIELD • Search; FILTER • Account status; FILTER • Merchant account; BUTTON • Review access; METRICS • Admin operational KPIs; METRIC • Active merchants; METRIC • Suspended users; METRIC • Pending checks; RECORDS • Merchant directory & account access; TABLE • Column labels; TABLE ROW • Demo Merchant A; TABLE ROW • Demo Merchant B; TABLE ROW • Demo Merchant C; TABLE ROW • Demo Merchant D; STATUS • Backend integration; GUIDANCE • ACCOUNT SAFETY; ADMIN MOBILE • User accounts; METRICS • Performance; METRIC • Accounts; METRIC • Suspended; RECORDS • User accounts; RECORD rows (e.g. Demo Merchant A); RECORD ACTION • View profile; RECORD ACTION • Verify; RECORD ACTION • Review; BUTTON / Premium v2 • Review merchant access →; MOBILE NAV • Icon tabs; TAB • Overview …
- **16.03 — Wholesaler verification** — Desktop `1975:1522`, Mobile `1975:1523`
  - ADMIN / Top bar; STATUS • Administrative access; FIELD • Search; FILTER • Pending KYC; FILTER • Application completeness; BUTTON • Review evidence; METRICS • Admin operational KPIs; METRIC • Verification queue; METRIC • Auto-approval threshold; METRIC • Manual review; RECORDS • Wholesale verification queue; TABLE • Column labels; TABLE ROW • Demo Supplier 001; TABLE ROW • Demo Supplier 002; TABLE ROW • Demo Supplier 003; TABLE ROW • Demo Supplier 004; STATUS • Backend integration; GUIDANCE • VERIFICATION CHECKLIST; ADMIN MOBILE • Supplier verification; METRICS • Performance; METRIC • Pending KYC; METRIC • Auto approval; RECORDS • Supplier verification; RECORD rows (e.g. Demo Supplier 001); RECORD ACTION • Review; RECORD ACTION • Request docs; RECORD ACTION • Verify; BUTTON / Premium v2 • Review verification →; MOBILE NAV • Icon tabs; TAB • Overview …
- **16.04 — Dispute resolution** — Desktop `1975:1639`, Mobile `1975:1640`
  - ADMIN / Top bar; STATUS • Administrative access; FIELD • Search; FILTER • Open disputes; FILTER • Escrow status; BUTTON • Review case; METRICS • Admin operational KPIs; METRIC • Open disputes; METRIC • Funds protected; METRIC • Awaiting evidence; RECORDS • Escrow dispute casework; TABLE • Column labels; TABLE ROW • Demo case DSP-001; TABLE ROW • Demo case DSP-002; TABLE ROW • Demo case DSP-003; TABLE ROW • Demo case DSP-004; STATUS • Backend integration; GUIDANCE • DECISION PATH; ADMIN MOBILE • Dispute resolution; METRICS • Performance; METRIC • Protected funds; RECORDS • Dispute resolution; RECORD rows (e.g. DSP-DEMO-001); RECORD ACTION • Examine; RECORD ACTION • Request docs; RECORD ACTION • Escalate; BUTTON / Premium v2 • Review dispute evidence →; MOBILE NAV • Icon tabs; TAB • Overview; TAB • Users …
- **16.05 — Support operations** — Desktop `1975:1756`, Mobile `1975:1757`
  - ADMIN / Top bar; STATUS • Administrative access; FIELD • Search; FILTER • Open tickets; FILTER • Support priority; BUTTON • Assign agent; METRICS • Admin operational KPIs; METRIC • Open tickets; METRIC • Ticket response target; METRIC • Service follow-up; RECORDS • Customer support operations; TABLE • Column labels; TABLE ROW • TKT-DEMO-01; TABLE ROW • TKT-DEMO-02; TABLE ROW • SRV-DEMO-01; TABLE ROW • SRV-DEMO-02; STATUS • Backend integration; GUIDANCE • SUPPORT SERVICE LEVELS; ADMIN MOBILE • Support operations; METRICS • Performance; METRIC • Response goal; RECORDS • Support operations; RECORD rows (e.g. TKT-DEMO-01); RECORD ACTION • Assign; RECORD ACTION • Reply; RECORD ACTION • Follow up; BUTTON / Premium v2 • Open support queue →; MOBILE NAV • Icon tabs; TAB • Overview; TAB • Users …
- **16.06 — Announcements** — Desktop `1975:1873`, Mobile `1975:1874`
  - ADMIN / Top bar; STATUS • Administrative access; FIELD • Search; FILTER • All channels; FILTER • Announcement audience; BUTTON • Create notice; METRICS • Admin operational KPIs; METRIC • Delivery channel; METRIC • Email delivery; METRIC • Saved drafts; RECORDS • Broadcast announcement composer; TABLE • Column labels; TABLE ROW • Maintenance notice; TABLE ROW • Payment policy update; TABLE ROW • Security guidance; TABLE ROW • Feature release; STATUS • Backend integration; GUIDANCE • PRE-PUBLISH REVIEW; ADMIN MOBILE • Announcements; METRICS • Performance; METRIC • Drafts; METRIC • Channels; RECORDS • Announcements; RECORD rows (e.g. Maintenance update); RECORD ACTION • Edit; RECORD ACTION • Preview; RECORD ACTION • Schedule; BUTTON / Premium v2 • Create announcement →; MOBILE NAV • Icon tabs; TAB • Overview …
- **16.07 — Platform analytics** — Desktop `1975:1990`, Mobile `1975:1991`
  - ADMIN / Top bar; STATUS • Administrative access; FIELD • Search; FILTER • Last 30 days; FILTER • Revenue source; BUTTON • Export CSV; METRICS • Admin operational KPIs; METRIC • Transaction volume; METRIC • Platform revenue; METRIC • Active users; RECORDS • Platform performance and exports; TABLE • Column labels; TABLE ROW • Store transaction fees; TABLE ROW • BiSupplyNet fees; TABLE ROW • Subscription revenue; TABLE ROW • Service response; STATUS • Backend integration; GUIDANCE • METRIC INTEGRITY; CHART STATE • Platform analytics / Desktop; ADMIN MOBILE • Platform analytics; METRICS • Performance; METRIC • Revenue; RECORDS • Platform analytics; RECORD rows (e.g. Store fee report); RECORD ACTION • Export; RECORD ACTION • Inspect; BUTTON / Premium v2 • Export analytics →; MOBILE NAV • Icon tabs; TAB • Overview; TAB • Users …
- **16.08 — Admin permissions** — Desktop `1975:2107`, Mobile `1975:2108`
  - ADMIN / Top bar; STATUS • Administrative access; FIELD • Search; FILTER • Permission groups; FILTER • Role sensitivity; BUTTON • Manage roles; METRICS • Admin operational KPIs; METRIC • Admin accounts; METRIC • Superadmin role; METRIC • Audit events; RECORDS • Administrator roles & permissions; TABLE • Column labels; TABLE ROW • Superadmin; TABLE ROW • Administrator; TABLE ROW • Support agent; TABLE ROW • Reviewer; STATUS • Backend integration; GUIDANCE • PRIVILEGE CONTROL; ADMIN MOBILE • Admin permissions; METRICS • Performance; RECORDS • Admin permissions; RECORD rows (e.g. Superadmin); RECORD ACTION • Restricted; RECORD ACTION • Review; BUTTON / Premium v2 • Review permissions →; MOBILE NAV • Icon tabs; TAB • Overview; TAB • Users; TAB • Cases; TAB • More
