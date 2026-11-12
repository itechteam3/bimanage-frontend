// "Did you mean …@gmail.com?" — catch common email domain typos before a
// form is sent (a typo means the customer never gets their receipt).
// Suggests only; the person decides.

const DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "ymail.com",
  "msn.com",
  "googlemail.com",
];
// Real providers that look close to the ones above: never "correct" these.
const KNOWN = new Set([...DOMAINS, "mail.com", "gmx.com", "zoho.com", "yandex.com", "hey.com", "me.com", "mac.com", "email.com"]);

// Typos that are real domains elsewhere but almost never meant here.
const FIXES: Record<string, string> = {
  "gmail.co": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.om": "gmail.com",
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gnail.com": "gmail.com",
  "yahoo.co": "yahoo.com",
  "yaho.com": "yahoo.com",
  "hotmail.co": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "outlook.co": "outlook.com",
};

/** Edit distance (insert, delete, substitute, swap neighbours). */
function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
    }
  }
  return d[a.length]![b.length]!;
}

/** A corrected address if the domain looks like a typo of a common one; otherwise null. */
export function suggestEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (KNOWN.has(domain)) return null;
  if (FIXES[domain]) return `${local}@${FIXES[domain]}`;
  let best: { d: string; score: number } | null = null;
  for (const d of DOMAINS) {
    const score = distance(domain, d);
    // Short domains need a closer match to avoid nagging real addresses.
    const limit = d.length <= 8 ? 1 : 2;
    if (score <= limit && (!best || score < best.score)) best = { d, score };
  }
  return best ? `${local}@${best.d}` : null;
}
