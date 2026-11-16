import { Link } from "react-router-dom";
import { COMPANY } from "@/config/legal";
import { LegalPage, type LegalSection } from "./LegalPage";

// Terms of Service (/terms). DRAFT pending legal review (banner: LegalPage).
// Accuracy rule: describes how BiManage works today, checked against the
// backend code on 2026-11-16. No prices here: they come from the plans API
// and are shown on the home page and before every payment.

const mail = <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>;

const SECTIONS: LegalSection[] = [
  {
    id: "about",
    title: "About these terms",
    body: (
      <>
        <p>
          BiManage is an online business management service provided by <strong>{COMPANY.legalName}</strong> ("BiTechTeam", "we", "us"). These Terms of Service ("Terms") are an agreement between you and BiTechTeam and apply whenever you use BiManage, including the web app, your BiManage online store, BiSupplyNet and FELI.
        </p>
        <p>
          By creating an account, ticking the box to agree, or using BiManage, you accept these Terms and our <Link to="/privacy">Privacy Policy</Link>. If you use BiManage for a business, you accept them on behalf of that business and confirm that you are allowed to do so. If you do not agree, do not use BiManage.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Accounts and eligibility",
    body: (
      <>
        <p>You must be at least 18 years old and able to enter into a binding contract to create an account. BiManage is designed for businesses operating in Nigeria and works in Nigerian naira (NGN).</p>
        <ul>
          <li>Give accurate information and keep it up to date. You sign up with an email address, which you confirm with a one-time code, or with your Google account.</li>
          <li>Keep your password safe and don't share your account. You are responsible for what happens under your account and for the team members you invite.</li>
          <li>The account owner can invite team members and give them a role (admin, manager or staff) and permissions. The owner remains responsible for the business account, its plan and its billing.</li>
          <li>Tell us straight away at {mail} if you think someone else has used your account.</li>
        </ul>
      </>
    ),
  },
  {
    id: "plans",
    title: "Plans, trials, subscriptions and renewals",
    body: (
      <>
        <p>
          BiManage offers a free plan (Freemium), paid plans (Standard and Premium, billed monthly or yearly), a one-time 14-day free trial for existing businesses, and one-time 30-day startup packages. Current prices and what each option includes are shown on our <Link to="/#pricing">home page</Link> and before you pay. Some prices may be marked as introductory; we will always show the price before you are charged.
        </p>
        <ul>
          <li><strong>Free trial.</strong> Each business can use the trial once. It gives access to the full feature set for 14 days, needs no card, and is never charged. When it ends the account moves to Freemium.</li>
          <li><strong>Startup packages.</strong> A one-time payment for 30 days of the features in that package. Packages do not renew. When a package ends the account moves to Freemium unless it is on a paid plan.</li>
          <li><strong>Subscriptions renew automatically</strong> at the end of each monthly or yearly period and are charged to the card saved with Paystack, until you cancel.</li>
          <li><strong>Upgrades</strong> start immediately at the full price of the new plan, with a new billing period from that day. The previous plan stops renewing; unused time on it is not refunded.</li>
          <li><strong>Downgrades</strong> take effect at the end of the current paid period and are charged then.</li>
          <li><strong>Cancelling</strong> stops future renewals. You keep your plan until the end of the period you have paid for, then the account moves to Freemium. You can undo a cancellation before the period ends.</li>
          <li><strong>Failed renewals.</strong> If a renewal payment fails, the plan keeps working for 3 days. If it still isn't paid, the account moves to Freemium.</li>
          <li>Only the account owner can change, cancel or pay for the plan.</li>
        </ul>
        <p>Except where the law requires otherwise, payments for plans and packages are not refundable, including for unused time.</p>
      </>
    ),
  },
  {
    id: "credits",
    title: "Freemium credits",
    body: (
      <>
        <p>
          Freemium accounts receive a daily allowance of credits, which resets at midnight Lagos time. Some actions use credits (for example adding a product or creating an order), and some are charged once a day (for example opening analytics or inventory). The current allowance and costs are shown in the app.
        </p>
        <p>Credits have no cash value, cannot be transferred or carried over to the next day, and are not refundable. Paid plans, the trial and startup packages are not limited by daily credits. We may change the credit allowance or costs; the current figures are always shown in the app.</p>
      </>
    ),
  },
  {
    id: "payments",
    title: "Payments through Paystack",
    body: (
      <>
        <p>
          Payments on BiManage (plans, startup packages, online store orders and BiSupplyNet orders) are processed by <strong>Paystack</strong>, a licensed payment provider. Card and bank details are entered on Paystack's checkout and are handled by Paystack under its own terms; BiManage does not see or store full card numbers.
        </p>
        <p>
          A payment only counts once Paystack has confirmed it to us (amount, currency and reference). Paystack may decline or delay a payment, for example for fraud checks. Where BiManage runs in Paystack's test mode, test payments move no real money and are labelled as test payments; money from them can never be withdrawn.
        </p>
      </>
    ),
  },
  {
    id: "store",
    title: "Your online store and the sales commission",
    body: (
      <>
        <p>
          On a plan, trial or package that includes it, you can publish an online store with your products and delivery fees. Shoppers pay through Paystack and do not need a BiManage account. Payments for store orders are collected by BiTechTeam through Paystack on your behalf.
        </p>
        <ul>
          <li><strong>Commission.</strong> BiManage takes a commission of 3% on each paid store order, calculated on the order total (including delivery fees) and deducted once, at the time of the sale. The rest is credited to your BiManage wallet.</li>
          <li><strong>Payout hold.</strong> Your share of a store order is held until the customer confirms they received it, or until a hold period (currently 7 days) after you mark it delivered, if the customer hasn't reported a problem. Only the business owner or an admin can complete or cancel a paid order, and completing an order doesn't end the hold early. If the customer reports a problem, the money stays on hold until BiManage resolves it, and it may be refunded to the customer. A paid order that is cancelled is refunded to the customer. Earnings become available to withdraw once the hold ends.</li>
          <li><strong>Cancellations after payment.</strong> If a paid order is cancelled, the pending earnings for it are taken back from your wallet, and the shopper must be refunded. Contact us so the refund can be arranged through Paystack.</li>
          <li><strong>Test-mode money</strong> is kept separately in your wallet and can never be withdrawn.</li>
        </ul>
      </>
    ),
  },
  {
    id: "wallet",
    title: "Wallet, payouts and fees",
    body: (
      <>
        <p>Your BiManage wallet records money you have earned from store sales and BiSupplyNet sales. It is a record of amounts due to you, not a bank account, and it does not earn interest.</p>
        <ul>
          <li>Money is <strong>pending</strong> until the order completes (or, for BiSupplyNet, until escrow is released), and then <strong>available</strong>.</li>
          <li>You can withdraw available money to the Nigerian bank account you add, which we check with Paystack before paying out. Withdrawals follow the schedule you choose (weekly, every two weeks, monthly or a custom interval of 7 to 90 days) and have a minimum amount shown in the app.</li>
          <li>BiManage does not charge a withdrawal fee. Paystack's transfer fee is passed on to you and shown before you confirm.</li>
          <li>If Paystack can't complete a transfer, the full amount, fees included, is returned to your available balance.</li>
          <li>We may hold or reverse amounts that relate to a cancelled, refunded or disputed order, a payment Paystack reverses, a mistake, or suspected fraud.</li>
        </ul>
      </>
    ),
  },
  {
    id: "bisupplynet",
    title: "BiSupplyNet, escrow, disputes and refunds",
    body: (
      <>
        <p>
          BiSupplyNet lets businesses on an eligible plan buy from wholesalers listed on BiManage, and lets approved Premium businesses sell as wholesalers. Each order is a contract between the buyer and the wholesaler; BiTechTeam is not the seller, but holds the payment in escrow as described here.
        </p>
        <ul>
          <li><strong>Holding the payment.</strong> The buyer pays BiTechTeam through Paystack. The wholesaler's share (the order total less our commission) is shown on hold in the wholesaler's wallet and is not paid out until it is released.</li>
          <li><strong>Release.</strong> The payment is released when the buyer confirms delivery, or automatically 7 days after the wholesaler marks the order delivered if no dispute is open. Released money is withdrawn through the normal wallet process.</li>
          <li><strong>Unpaid and unshipped orders.</strong> Orders not paid within 24 hours are cancelled and the stock is returned. Paid orders not shipped within 7 days are refunded to the buyer.</li>
          <li><strong>Commission.</strong> BiManage takes a 3% commission only on the amount the wholesaler keeps. Nothing is charged on money refunded to the buyer.</li>
          <li><strong>Disputes.</strong> A buyer can open a dispute once an order is paid and up to 7 days after delivery. The payment is frozen while BiTechTeam reviews it, and both sides can add evidence. We decide once, based on the evidence: release to the wholesaler, refund to the buyer, or split the amount. Refunds are paid back through Paystack.</li>
        </ul>
        <p>Our dispute decision settles the escrowed payment on BiManage. It does not stop either party from taking any other legal action available to them against the other.</p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>You must not use BiManage to:</p>
        <ul>
          <li>sell or advertise anything illegal in Nigeria, counterfeit goods, or goods or services you are not allowed to sell;</li>
          <li>deceive or defraud anyone, launder money, or process payments for anyone else's business;</li>
          <li>upload content that is unlawful, infringes someone else's rights, or contains malware;</li>
          <li>send spam, or contact people who have not agreed to hear from you;</li>
          <li>access another business's data, probe or break our security, overload the service, or scrape it;</li>
          <li>copy, resell or build a competing service from BiManage, except as these Terms allow.</li>
        </ul>
      </>
    ),
  },
  {
    id: "merchant-responsibilities",
    title: "Your responsibilities to your customers",
    body: (
      <>
        <p>When you sell through BiManage, you are the seller and you are responsible to your customers. In particular, you are responsible for:</p>
        <ul>
          <li>accurate product descriptions, prices, stock and delivery fees on your store and invoices;</li>
          <li>delivering what was ordered, handling returns and complaints, and agreeing refunds with your customers;</li>
          <li>complying with consumer protection, tax and other laws that apply to your business;</li>
          <li>the personal data of your customers that you keep in BiManage: having a lawful reason to collect it, telling your customers how you use it, and answering their requests. BiManage processes that data on your behalf, as explained in our <Link to="/privacy">Privacy Policy</Link>.</li>
        </ul>
      </>
    ),
  },
  {
    id: "feli",
    title: "FELI, the AI assistant",
    body: (
      <>
        <p>
          FELI is an AI assistant built into BiManage. It answers questions about BiManage and about your business using the data your role is allowed to see, and it can suggest actions (for example drafting an invoice, creating a task, updating an order or opening a support ticket).
        </p>
        <ul>
          <li><strong>FELI can make mistakes.</strong> Its answers are generated by an AI model and may be incomplete or wrong. Check important information, figures and anything with legal, tax or financial consequences before relying on it. FELI's answers are not professional advice.</li>
          <li><strong>You approve every action.</strong> FELI only proposes actions; nothing is created, sent or changed until you review and approve it, and you are responsible for actions you approve.</li>
          <li>Freemium businesses can send a limited number of FELI messages a day (currently 20); paid plans have no daily limit. Some actions need a particular plan or permission.</li>
          <li>Your messages to FELI are processed by our AI provider to produce replies, as described in the <Link to="/privacy">Privacy Policy</Link>. Don't share passwords or card details with FELI.</li>
        </ul>
      </>
    ),
  },
  {
    id: "suspension",
    title: "Suspension and termination",
    body: (
      <>
        <p>
          We may suspend or restrict an account, a store or a BiSupplyNet listing, or hold related wallet funds, if we reasonably believe it breaks these Terms or the law, puts other users or BiManage at risk, or if we are required to by law or by Paystack. Where we can, we will tell you why and how to fix it.
        </p>
        <p>
          You can close your business account at any time from your account settings, once open orders, wallet money, pending payouts, escrow and disputes are settled. Closing signs out every device, removes team access, takes your store offline and stops your plan renewing. You can restore the account by signing in within 30 days. After that, personal data is removed as described in the <Link to="/privacy">Privacy Policy</Link>; financial records are kept as the law requires.
        </p>
        <p>Sections of these Terms that by their nature should continue after the account ends (such as payments owed, intellectual property, limitation of liability and governing law) continue to apply.</p>
      </>
    ),
  },
  {
    id: "privacy",
    title: "Data and privacy",
    body: (
      <>
        <p>
          Our <Link to="/privacy">Privacy Policy</Link> explains what personal data we collect, why, who we share it with and your rights under the Nigeria Data Protection Act 2023. Your business data belongs to you. You give us permission to store, process and display it only as needed to provide and improve BiManage, keep it secure and meet our legal obligations.
        </p>
      </>
    ),
  },
  {
    id: "ip",
    title: "Intellectual property",
    body: (
      <>
        <p>
          BiManage, its software, design, store templates, the BiManage name and logo, and FELI belong to BiTechTeam or its licensors. We give you a limited, non-exclusive, non-transferable right to use BiManage for your business while your account is active and you follow these Terms.
        </p>
        <p>
          You keep ownership of your content (such as product photos, descriptions, logos and business records). You give us a licence to host, copy and display it as needed to run BiManage, including showing your store and products to the public when you publish them. If you send us feedback or ideas, we may use them without owing you anything.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    title: "Disclaimers and limitation of liability",
    body: (
      <>
        <p>
          We work hard to keep BiManage available, accurate and secure, but it is provided "as is" and "as available". To the extent the law allows, we do not promise that it will be uninterrupted or error-free, and we are not responsible for services we do not control, such as Paystack, banks, delivery companies, email providers or your internet connection.
        </p>
        <p>
          To the extent the law allows, BiTechTeam is not liable for indirect or consequential losses, or for loss of profits, revenue, goodwill or data, and our total liability to you for any claim relating to BiManage is limited to the amount you paid us for BiManage in the 12 months before the claim. Nothing in these Terms limits liability that cannot be limited by law, including for fraud.
        </p>
        <p>You agree to cover BiTechTeam's reasonable losses arising from your breach of these Terms, your products or services, or your dealings with your customers.</p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to BiManage and to these terms",
    body: (
      <>
        <p>
          BiManage changes as we improve it, and we may add, change or remove features. We may update these Terms; the date at the top shows the latest version. If a change materially affects you, we will tell you in the app or by email before it takes effect. Continuing to use BiManage after that means you accept the updated Terms; if you don't, you can cancel your plan and close your account.
        </p>
      </>
    ),
  },
  {
    id: "law",
    title: "Governing law and disputes",
    body: (
      <>
        <p>
          These Terms are governed by the laws of the Federal Republic of Nigeria. If you have a complaint, please contact us first so we can try to resolve it. Any dispute that can't be resolved informally will be decided by the courts of Nigeria.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <>
        <p>
          Questions about these Terms? Use our <Link to="/contact">contact page</Link> or email {mail}. BiManage is a product of {COMPANY.legalName} (<a href={COMPANY.website} target="_blank" rel="noreferrer">bitechteam.org</a>).
        </p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={
        <p>
          These Terms explain the rules for using BiManage: your account, plans and payments, your online store and wallet, BiSupplyNet escrow, FELI, and what each of us is responsible for. Please read them with our <Link to="/privacy">Privacy Policy</Link>.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
