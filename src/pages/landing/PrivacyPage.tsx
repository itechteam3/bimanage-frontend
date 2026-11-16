import { Link } from "react-router-dom";
import { COMPANY } from "@/config/legal";
import { LegalPage, type LegalSection } from "./LegalPage";

// Privacy Policy (/privacy), Nigeria Data Protection Act 2023. DRAFT pending
// legal review (banner: LegalPage). Every provider, retention period and
// browser storage item below was checked in the code on 2026-11-16; keep
// this page in step when they change.

const mail = <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>;

/** Service providers that receive personal data (backend + frontend code). */
const PROVIDERS: Array<[string, string, string]> = [
  ["MongoDB Atlas (MongoDB, Inc.)", "Database hosting", "All account and business data"],
  ["Render", "Hosting for the BiManage server (API)", "All data passing through the API"],
  ["Vercel", "Hosting for the BiManage website, app and online stores", "Web requests, including your IP address and browser details"],
  ["Paystack", "Payments, refunds, bank account checks and payouts", "Name, email, payment and order references, amounts, bank account details for payouts"],
  ["Cloudinary", "Storing and serving images and files you upload", "Product photos, logos, profile photos, attachments"],
  ["Resend and Brevo", "Sending emails (sign-up codes, receipts, notifications)", "Name, email address and the email's content"],
  ["Groq", "The AI model behind FELI", "Your messages to FELI and the business information FELI uses to answer"],
  ["Google", "Sign in with Google (only if you choose it)", "Google returns your name, email address and profile picture to us"],
];

const STORAGE: Array<[string, string]> = [
  ["Your sign-in session", "Keeps you signed in on this device (removed when you sign out)."],
  ["Display preferences", "Remembers settings such as reduced motion."],
  ["Store carts", "Keeps the items in a store's cart until you check out."],
  ["Store chat", "Lets a shopper return to their chat with a store without an account."],
  ["Checkout email", "Fills in the email you last used at a store checkout."],
  ["Payment and invite progress", "Remembers a payment or team invite in progress so you can return to it after Paystack or sign-in."],
  ["Navigation and update markers", "Remembers the back button's history and avoids reloading twice after an update."],
  ["FAQ votes", "Remembers your \"Was this helpful?\" answers on the FAQ page."],
];

const SECTIONS: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    body: (
      <>
        <p>
          BiManage is provided by <strong>{COMPANY.legalName}</strong> ("BiTechTeam", "we", "us"). For the personal data of people who use BiManage (account owners, team members, wholesalers, and visitors to our website), BiTechTeam is the <strong>data controller</strong> under the Nigeria Data Protection Act 2023 (NDPA).
        </p>
        <p>You can reach us about anything in this policy through our <Link to="/contact">contact page</Link> or at {mail}.</p>
      </>
    ),
  },
  {
    id: "roles",
    title: "Our two roles: controller and processor",
    body: (
      <>
        <p>Businesses use BiManage to keep records about their own customers. That means we handle personal data in two different roles:</p>
        <ul>
          <li><strong>As a controller</strong> for our own users: your account, your business profile, your subscription and payments, and how you use BiManage. This policy explains what we do with that data.</li>
          <li><strong>As a processor</strong> for merchants: when a business records its customers (names, phone numbers, emails, addresses, orders and invoices), or a shopper buys from or chats with a business's online store, the <strong>business is the controller</strong> and BiTechTeam processes the data on its behalf and on its instructions. If you are a customer of a business that uses BiManage, please contact that business first about your data; we will help it respond.</li>
        </ul>
        <p>We don't use merchants' customer data for our own marketing, and we don't sell personal data.</p>
      </>
    ),
  },
  {
    id: "data-we-collect",
    title: "The data we collect",
    body: (
      <>
        <h3>Account and profile</h3>
        <ul>
          <li>Name, email address, optional username and phone number, profile photo, and your password (stored only as a secure hash).</li>
          <li>If you sign in with Google: your Google account ID, name, email address and profile picture.</li>
          <li>When you agreed to these terms, and which version.</li>
          <li>Your role and permissions if you are a team member.</li>
        </ul>
        <h3>Business information</h3>
        <ul>
          <li>Business profile (such as name, logo and contact details), products and stock, orders, invoices, tasks and projects, messages, your online store and its settings.</li>
          <li>Subscription and payment records: plan, payment references and amounts from Paystack. We do not receive or store full card numbers.</li>
          <li>Wallet and payouts: earnings, withdrawals and the bank account you add for payouts (bank, account number and account name, checked with Paystack).</li>
          <li>BiSupplyNet: wholesaler profiles and applications, orders, reviews, disputes and the evidence uploaded to them.</li>
        </ul>
        <h3>Customer and shopper data (processed for merchants)</h3>
        <ul>
          <li>Customer records a business creates or that are built from its orders and invoices: name, phone, email, address, tags and notes.</li>
          <li>Store orders: the shopper's name, email, phone and delivery address, the items and the payment status.</li>
          <li>Store chats: messages between shoppers and the business, and the shopper's name and email if given.</li>
        </ul>
        <h3>FELI, support and our website</h3>
        <ul>
          <li>Your conversations with FELI, and support tickets you open.</li>
          <li>Messages sent through our contact form (name, email, message, and a one-way scrambled version of your IP address used to stop abuse).</li>
          <li>Newsletter sign-ups: your email address and whether you confirmed it.</li>
        </ul>
        <h3>Technical data</h3>
        <ul>
          <li>Our hosting providers process your IP address and browser details to deliver the service. We record the type of device and browser (for example "Chrome on Windows") in security emails when your password changes. We keep error logs without passwords or card details.</li>
        </ul>
      </>
    ),
  },
  {
    id: "purposes",
    title: "How we use data, and our lawful bases",
    body: (
      <>
        <ul>
          <li><strong>To provide BiManage</strong> (your account, plans, store, wallet, BiSupplyNet, FELI and support): performance of our contract with you.</li>
          <li><strong>To take payments, pay out earnings and run escrow</strong>, and to keep financial records: performance of contract and compliance with legal obligations (for example tax and accounting).</li>
          <li><strong>To keep BiManage secure</strong>: blocking common and breached passwords, pausing sign-in after repeated wrong passwords, preventing fraud and abuse, and telling you when your password changes: our legitimate interests and yours in a secure service.</li>
          <li><strong>To send service emails</strong> such as sign-up codes, receipts, payout and security notices: performance of contract and legitimate interests.</li>
          <li><strong>To send our newsletter</strong>: your consent, given by confirming your email. You can unsubscribe from any newsletter email.</li>
          <li><strong>To improve BiManage</strong> using counts and usage totals: our legitimate interests.</li>
          <li><strong>To process merchants' customer data</strong>: on the merchant's instructions, under our Terms of Service with that merchant.</li>
        </ul>
        <p>
          When a password is checked against known data breaches (the Have I Been Pwned service), only the first five characters of a one-way hash of it leave our server, never the password itself. When you look up a product barcode, only the barcode number is sent to a product database (UPCitemdb).
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Who we share data with",
    body: (
      <>
        <p>We use these service providers (sub-processors) to run BiManage. Each receives only what it needs for its task:</p>
        <div className="overflow-x-auto rounded-lg border border-line-card">
          <table className="w-full min-w-[36rem] border-collapse text-left text-body">
            <thead className="bg-surface-pale text-ink-strong">
              <tr>
                <th scope="col" className="p-3 font-semibold">Provider</th>
                <th scope="col" className="p-3 font-semibold">What for</th>
                <th scope="col" className="p-3 font-semibold">Data involved</th>
              </tr>
            </thead>
            <tbody>
              {PROVIDERS.map(([name, what, data]) => (
                <tr key={name} className="border-t border-line-subtle align-top">
                  <th scope="row" className="p-3 font-semibold text-ink-strong">{name}</th>
                  <td className="p-3">{what}</td>
                  <td className="p-3">{data}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          We also share data where you ask us to (for example your published store and products are public, and a wholesaler sees the buyer's order details), with BiTechTeam staff who need it to support you (access is limited by role and logged), and where the law, a court or a regulator requires it. Within a business, team members see only what their role allows.
        </p>
      </>
    ),
  },
  {
    id: "transfers",
    title: "International transfers",
    body: (
      <>
        <p>
          Some of our providers store or process data outside Nigeria (for example in the United States or the European Union). When personal data is transferred outside Nigeria we rely on the transfer grounds allowed by the NDPA, such as the provider's contractual commitments to protect it, and we choose providers with recognised security standards.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep data",
    body: (
      <>
        <ul>
          <li><strong>Your account and business data</strong>: while your account is open.</li>
          <li><strong>After you close your account</strong>: you have 30 days to restore it. Then your account is anonymised and your personal data removed. Your business's customer records are deleted. Financial records (orders, invoices, wallet history, escrow records and disputes) are kept, without your personal details, for as long as the law requires.</li>
          <li><strong>Messages</strong> (business inbox and store chats): deleted automatically 6 months after they are sent; a store chat ends 6 months after its last activity.</li>
          <li><strong>FELI conversations</strong>: deleted 30 days after the last message, or 1 year after the last message if the conversation was passed to our support team.</li>
          <li><strong>Contact form messages</strong>: deleted automatically after 180 days.</li>
          <li><strong>Newsletter</strong>: an unconfirmed sign-up is deleted after 30 days; after you unsubscribe, your email is deleted 30 days later.</li>
          <li><strong>Shopping carts</strong>: removed after 7 days.</li>
        </ul>
      </>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <>
        <p>Under the NDPA you have the right to:</p>
        <ul>
          <li>be told how your data is used (this policy) and get a copy of your personal data;</li>
          <li>correct inaccurate data (you can edit most of it yourself in your profile and settings);</li>
          <li>have your data deleted (closing your account does this, as described above), or restricted;</li>
          <li>object to processing based on our legitimate interests;</li>
          <li>receive your data in a commonly used format and have it sent to another provider (for example, you can export your customer list as CSV);</li>
          <li>withdraw consent at any time (for example by unsubscribing from the newsletter), without affecting what happened before;</li>
          <li>not be subject to a decision based solely on automated processing that significantly affects you. FELI does not make such decisions: it only suggests actions, which a person approves.</li>
        </ul>
        <p>
          To exercise a right, contact us through the <Link to="/contact">contact page</Link> or at {mail}. We may need to confirm your identity first, and we will respond within the time the law requires. If your request is about data a business keeps about you as its customer, we will pass it to that business, which is responsible for answering it.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <>
        <ul>
          <li>Connections to BiManage are encrypted (HTTPS), and passwords are stored only as secure hashes.</li>
          <li>Every request is checked on the server against your business and your role, so one business cannot see another's data.</li>
          <li>Common and breached passwords are blocked, you can't reuse your recent passwords, and sign-in pauses for 10 minutes after 3 wrong passwords.</li>
          <li>You can sign out of all other devices from your security settings, and we tell you by email whenever your password is changed or reset.</li>
          <li>Card details are entered on Paystack's checkout, never on BiManage.</li>
        </ul>
        <p>No system is perfectly secure. If a breach affects your personal data in a way that is likely to put you at risk, we will tell you and the Nigeria Data Protection Commission as the law requires.</p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <>
        <p>BiManage is for businesses and is not intended for anyone under 18. We do not knowingly collect personal data from children. If you believe a child has given us personal data, contact us and we will delete it.</p>
      </>
    ),
  },
  {
    id: "storage",
    title: "Cookies and local storage",
    body: (
      <>
        <p>
          BiManage does not use advertising or analytics cookies, and doesn't load third-party tracking scripts. Instead, the app saves a few items in your browser's local storage (on your device only) so it works properly:
        </p>
        <ul>
          {STORAGE.map(([what, why]) => (
            <li key={what}>
              <strong>{what}</strong>: {why}
            </li>
          ))}
        </ul>
        <p>These are needed for the service to work. You can clear them at any time in your browser settings; you will then be signed out and carts will be emptied. Paystack's checkout pages, which you visit to pay, have their own cookie policy.</p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <>
        <p>We will update this policy when the way we handle data changes; the date at the top shows the latest version. If a change materially affects you, we will tell you in the app or by email before it takes effect.</p>
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact and complaints",
    body: (
      <>
        <p>
          For any question or request about your personal data, contact our data protection team through the <Link to="/contact">contact page</Link> or at {mail}. BiManage is a product of {COMPANY.legalName} (<a href={COMPANY.website} target="_blank" rel="noreferrer">bitechteam.org</a>).
        </p>
        <p>
          If you are not satisfied with our response, you can complain to the <strong>Nigeria Data Protection Commission (NDPC)</strong> at <a href="https://ndpc.gov.ng" target="_blank" rel="noreferrer">ndpc.gov.ng</a>.
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <p>
          This policy explains what personal data BiManage collects, why, who it is shared with, how long it is kept and your rights under the Nigeria Data Protection Act 2023. It applies to the BiManage website, app and online stores. Please read it with our <Link to="/terms">Terms of Service</Link>.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
