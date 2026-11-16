import { naira } from "@/lib/format";
import type { PublicPlans } from "@/lib/landing/api";

// The ONE source for the public FAQ: the landing page preview (featured
// questions), the /faq page and its FAQPage structured data.
//
// Accuracy rule: every answer describes how BiManage works today (checked
// against the backend code, 2026-11-16). PRICES ARE NEVER WRITTEN HERE: use
// a placeholder and it is filled in from GET /public/plans at runtime:
//   {price:<plan>:<monthly|yearly>}   e.g. {price:standard:monthly}
//   {package:<id>}                    a startup package's one-time amount
//   {credits:freemium}                Freemium's daily credits
// Until the plans load (or if one is missing), the answer shows a fallback
// and the structured data leaves that question out.

export type FaqLink = { label: string; to: string };
export interface FaqItem {
  /** Stable id: the accordion's anchor and the "Was this helpful?" key. */
  id: string;
  q: string;
  /** Paragraphs. May contain price placeholders. */
  a: string[];
  /** Shown in the landing page preview (keep to about 6). */
  featured?: boolean;
  /** In-site links shown under the answer. */
  links?: FaqLink[];
  /** Related help-centre topic (the help centre needs sign-in). */
  help?: boolean;
}
export interface FaqGroup {
  /** Stable slug for /faq#<slug> and /faq?topic=<slug>. */
  slug: string;
  title: string;
  items: FaqItem[];
}

export const FAQ_GROUPS: FaqGroup[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    items: [
      {
        id: "what-is-bimanage",
        featured: true,
        q: "What is BiManage?",
        a: [
          "BiManage is an online platform for running a business in one place, made by BiTechTeam for Nigerian businesses. It covers sales and orders, inventory, invoices, customers, tasks and projects, your own online store, a wallet for store earnings, wholesale buying on BiSupplyNet and FELI, an AI assistant.",
          "It runs in your web browser on phones, tablets and computers, so there is nothing to install.",
        ],
      },
      {
        id: "how-to-start",
        featured: true,
        q: "How do I get started?",
        a: [
          "Create an account with your email address (we send a code to confirm it) or sign in with Google. Then choose how you want to start: if you already run a business you can start a 14-day free trial; if you are starting a new business you can buy a one-time 30-day startup package.",
          "If you do neither, your account uses the free Freemium plan, and you can choose a paid plan at any time.",
        ],
        links: [{ label: "Create a free account", to: "/register" }],
      },
      {
        id: "team",
        q: "Can my team use BiManage?",
        a: [
          "Yes. You can invite team members by email and give each one a role (admin, manager or staff) with its own permissions. Each person only sees and does what their role allows, and the server checks this on every request.",
          "Some actions are kept for the owner, such as managing billing and closing the account.",
        ],
        help: true,
      },
    ],
  },
  {
    slug: "billing",
    title: "Plans and billing",
    items: [
      {
        id: "free-plan",
        featured: true,
        q: "Is there a free plan?",
        a: [
          "Yes. Freemium is free and gives your business {credits:freemium} credits a day, which reset at midnight (Lagos time). Actions such as adding a product or creating an order use credits; opening inventory or analytics uses credits once a day.",
          "Invoices, tasks and projects, messages, BiSupplyNet and a live online store need a paid plan, a trial or a startup package.",
        ],
        links: [{ label: "See plans and pricing", to: "/#pricing" }],
      },
      {
        id: "plan-prices",
        featured: true,
        q: "How much do the paid plans cost?",
        a: [
          "Standard costs {price:standard:monthly} a month or {price:standard:yearly} a year. Premium costs {price:premium:monthly} a month or {price:premium:yearly} a year. Paid plans have no daily credit limit.",
          "Startup packages are one-time payments for 30 days: Starter {package:starter}, Standard {package:standard} and Premium {package:premium}. You always see the exact amount before you pay.",
        ],
        links: [{ label: "Compare plans", to: "/#pricing" }],
      },
      {
        id: "trial",
        q: "How does the free trial work?",
        a: [
          "A business can start one 14-day free trial with access to the full feature set. No card is needed and nothing is charged when it ends.",
          "When the trial ends, the account moves to Freemium. Your data stays, and you can choose a paid plan whenever you are ready.",
        ],
      },
      {
        id: "startup-packages",
        q: "What is a startup package?",
        a: [
          "A startup package is a one-time payment that unlocks a set of features for 30 days. It is meant for businesses that are just starting, and it does not renew.",
          "When the 30 days end, the account moves to Freemium unless you are on a paid plan. You can choose a plan at any time.",
        ],
      },
      {
        id: "renew-cancel",
        q: "How do renewals, upgrades and cancellations work?",
        a: [
          "Paid plans renew automatically every month or year and are charged to your card through Paystack. Upgrading starts the new plan straight away at its full price, with a new billing period from that day; unused days on the old plan are not refunded. A downgrade starts at the end of the period you have paid for.",
          "If you cancel, you keep your plan until the end of the paid period and then move to Freemium; you can undo the cancellation before then. If a renewal payment fails, the plan keeps working for 3 days before moving to Freemium. Only the account owner can change or cancel the plan.",
        ],
      },
    ],
  },
  {
    slug: "store",
    title: "Online store and payments",
    items: [
      {
        id: "online-store",
        featured: true,
        q: "Can I sell online and take payments?",
        a: [
          "Yes. On a paid plan (or during a trial or package that includes the store) you can publish your own online store with your products, delivery fees and a checkout. Shoppers pay through Paystack's secure checkout and do not need an account: they check out with their email address and can track the order with its order number.",
          "Each paid order shows up in your store orders, and your share of the money goes to your BiManage wallet.",
        ],
        help: true,
      },
      {
        id: "commission",
        q: "What does BiManage charge on store sales?",
        a: [
          "BiManage takes a 3% commission on each paid store order (on the order total, including delivery), deducted once at the time of the sale. The rest is credited to your wallet.",
          "There is no separate fee for the store itself beyond your plan, and BiManage doesn't add a fee when you withdraw (see Wallet and payouts).",
        ],
      },
      {
        id: "test-payments",
        q: "What are test payments?",
        a: [
          "When BiManage's payments run in Paystack's test mode, no real money moves. Orders paid that way are marked as test payments, and their money is kept separately in your wallet.",
          "Test money can never be withdrawn, so a test order can't be mistaken for a real sale.",
        ],
      },
    ],
  },
  {
    slug: "wallet",
    title: "Wallet and payouts",
    items: [
      {
        id: "payouts",
        q: "When can I withdraw my earnings?",
        a: [
          "When a shopper pays, your share shows as pending in your wallet. It becomes available once the order is completed: you can mark it completed after delivery, and delivered orders complete on their own 7 days after you mark them delivered.",
          "You can withdraw available money to your verified Nigerian bank account on the schedule you choose (weekly, every two weeks, monthly or every 7 to 90 days). The minimum withdrawal is NGN 1,000.",
        ],
        help: true,
      },
      {
        id: "payout-fees",
        q: "Are there fees on withdrawals?",
        a: [
          "BiManage doesn't charge a withdrawal fee. Paystack charges a small transfer fee that depends on the amount; it is passed on to you and shown before you confirm the withdrawal.",
          "If Paystack can't complete a transfer, the full amount, fees included, goes back to your available balance.",
        ],
      },
    ],
  },
  {
    slug: "bisupplynet",
    title: "BiSupplyNet and escrow",
    items: [
      {
        id: "what-is-bisupplynet",
        q: "What is BiSupplyNet?",
        a: [
          "BiSupplyNet is BiManage's wholesale marketplace. Businesses on Standard or Premium (or a trial or package that includes it) can find wholesalers, place orders and pay inside BiManage.",
          "Premium businesses can apply to sell on BiSupplyNet as wholesalers; BiTechTeam reviews each application.",
        ],
      },
      {
        id: "escrow",
        featured: true,
        q: "How does escrow protect wholesale payments?",
        a: [
          "When you pay for a BiSupplyNet order, BiManage holds the money instead of sending it straight to the wholesaler. It is released to the wholesaler's wallet when you confirm delivery, or automatically 7 days after the wholesaler marks the order delivered if no dispute is open.",
          "Orders that aren't paid within 24 hours are cancelled, and paid orders that aren't shipped within 7 days are refunded. BiManage takes a 3% commission only on the amount the wholesaler keeps.",
        ],
      },
      {
        id: "disputes",
        q: "What if something goes wrong with a wholesale order?",
        a: [
          "You can open a dispute from the order once it is paid, up to 7 days after delivery. The payment is frozen while BiTechTeam reviews it, and both sides can add evidence.",
          "The team then releases the payment to the wholesaler, refunds you, or splits it. Refunds go back to you through Paystack.",
        ],
      },
    ],
  },
  {
    slug: "feli",
    title: "FELI",
    items: [
      {
        id: "what-is-feli",
        q: "What is FELI and what can it do?",
        a: [
          "FELI is BiManage's AI assistant. It answers questions about using BiManage and about your business, using only the data your role lets you see. It can also suggest actions, such as drafting an invoice, creating a task or opening a support ticket, but nothing happens until you review and approve it.",
          "Freemium businesses get 20 FELI messages a day; paid plans have no daily limit. Like any AI, FELI can make mistakes, so check important answers and figures before you rely on them.",
        ],
        help: true,
      },
    ],
  },
  {
    slug: "security",
    title: "Security and data",
    items: [
      {
        id: "data-protection",
        q: "How do you protect my account and data?",
        a: [
          "Each business only sees its own data, and every request is checked against your business and your role on the server. Passwords are stored hashed; common and breached passwords are blocked, and after 3 wrong attempts sign-in pauses for 10 minutes.",
          "From your security settings you can sign out of all other devices, and we email you whenever your password is changed or reset. Card details are entered on Paystack's checkout, never on BiManage.",
        ],
        links: [{ label: "Read the Privacy Policy", to: "/privacy" }],
      },
      {
        id: "customer-data",
        q: "Who can see my customers' details?",
        a: [
          "Your customer records, orders and invoices are visible only to you and team members whose role allows it. BiManage stores and processes this information on your behalf to run the features you use.",
          "You are responsible for having a good reason to keep your customers' details and for answering their requests; the Privacy Policy explains how this works.",
        ],
        links: [{ label: "Read the Privacy Policy", to: "/privacy" }],
      },
    ],
  },
  {
    slug: "account",
    title: "Account",
    items: [
      {
        id: "close-account",
        q: "How do I close my account?",
        a: [
          "The owner can close the business account from account settings by confirming their password. You first need to finish open orders, withdraw wallet money and settle any escrow or disputes. Closing signs out every device, removes team access, takes the store offline and stops the plan renewing.",
          "For 30 days you can restore everything by signing in again. After that your personal data and your customer records are deleted; financial records such as orders, invoices and wallet history are kept, without your personal details, for legal record-keeping.",
        ],
      },
      {
        id: "contact-support",
        q: "How do I get help?",
        a: [
          "Send us a message from the contact page and we'll reply by email, usually within one working day. If you already have an account, you can also open a support ticket inside BiManage or ask FELI.",
        ],
        links: [{ label: "Contact us", to: "/contact" }],
      },
    ],
  },
];

export const ALL_FAQS = FAQ_GROUPS.flatMap((g) => g.items.map((item) => ({ ...item, group: g.slug })));
export const FEATURED_FAQS = ALL_FAQS.filter((f) => f.featured);
export const groupBySlug = (slug: string | null | undefined) => FAQ_GROUPS.find((g) => g.slug === slug) ?? null;

// ── Placeholders ──────────────────────────────────────────────────────────

const TOKEN = /\{(price|package|credits):([a-z]+)(?::([a-z]+))?\}/g;

function tokenValue(plans: PublicPlans | undefined, kind: string, id: string, cycle?: string): string | null {
  if (!plans) return null;
  if (kind === "price") {
    const p = plans.plans.find((x) => x.id === id);
    const v = p && (cycle === "yearly" ? p.price.yearly : cycle === "monthly" ? p.price.monthly : undefined);
    return typeof v === "number" && v > 0 ? naira(v) : null;
  }
  if (kind === "package") {
    const s = plans.startupPackages?.find((x) => x.id === id);
    return s && typeof s.amount === "number" && s.amount > 0 ? naira(s.amount) : null;
  }
  if (kind === "credits") {
    const p = plans.plans.find((x) => x.id === id);
    return p && typeof p.credits === "number" ? String(p.credits) : null;
  }
  return null;
}

/** Fills price placeholders from the plans API; null if any can't be filled. */
export function resolveFaqText(text: string, plans: PublicPlans | undefined): string | null {
  let missing = false;
  const out = text.replace(TOKEN, (_m, kind: string, id: string, cycle?: string) => {
    const v = tokenValue(plans, kind, id, cycle);
    if (v == null) missing = true;
    return v ?? "";
  });
  return missing ? null : out;
}

/** True when any plan price is still provisional (the server says so). */
export const pricesProvisional = (plans: PublicPlans | undefined) => Boolean(plans?.plans.some((p) => p.pricesConfirmed === false));

/** Shown in place of a paragraph whose prices haven't loaded. */
export const PRICE_FALLBACK = "Current prices are shown in Plans and pricing on our home page, and always before you pay.";

/** Lower-case, accents removed: for search. */
export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** schema.org FAQPage for the given items; answers with unfilled prices are left out. */
export function faqJsonLd(items: Array<Pick<FaqItem, "q" | "a">>, plans: PublicPlans | undefined) {
  const mainEntity = items.flatMap((f) => {
    const paras = f.a.map((p) => resolveFaqText(p, plans));
    if (paras.some((p) => p == null)) return [];
    return [{ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: paras.join(" ") } }];
  });
  return { "@context": "https://schema.org", "@type": "FAQPage", mainEntity };
}
