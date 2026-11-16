// Illustrated profile pictures for the invented sample people in the landing
// screenshots (scripts/marketing/sample-business.mjs). Run once; the results
// are committed in scripts/marketing/avatars/ (NOT part of the app bundle).
//
//   node scripts/marketing/make-avatars.mjs
//
// Style: "Lorelei" by Lisa Wischofsky, CC0 1.0 (public domain), rendered by
// the DiceBear HTTP API (https://www.dicebear.com/styles/lorelei/). They are
// drawings, not photos of real people. See docs/image-credits.md.
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = new URL("./avatars/", import.meta.url);
const API = "https://api.dicebear.com/9.x/lorelei/webp";

// name → look. Skin tones and hair chosen for a Lagos business; pastel
// backgrounds from the BiManage palette family.
const F = { beardProbability: 0 };
const M = { earringsProbability: 0 };
export const PEOPLE = {
  "Adunni Bello": { hair: "variant38", skinColor: "8d5524", backgroundColor: "dbe7fb", earringsProbability: 100, mouth: "happy01", eyes: "variant02", ...F },
  "Tunde Adeyemi": { hair: "variant25", skinColor: "6b4423", backgroundColor: "dcf3e6", beardProbability: 100, beard: "variant02", mouth: "happy02", eyes: "variant04", ...M },
  "Chika Okafor": { hair: "variant24", skinColor: "a0662f", backgroundColor: "f6e3ee", mouth: "happy03", eyes: "variant06", earringsProbability: 0, ...F },
  "Tolani Adeyemi": { hair: "variant32", skinColor: "7a4a26", backgroundColor: "fdeccf", earringsProbability: 100, mouth: "happy04", eyes: "variant08", ...F },
  "Chinedu Okafor": { hair: "variant39", skinColor: "5c3a21", backgroundColor: "e3ecfb", mouth: "happy06", eyes: "variant10", ...M, beardProbability: 0 },
  "Zainab Musa": { hair: "variant35", skinColor: "a86b3c", backgroundColor: "ece6fb", earringsProbability: 100, mouth: "happy10", eyes: "variant12", ...F },
  "Kemi Ogunleye": { hair: "variant46", skinColor: "8d5524", backgroundColor: "dcf3e6", earringsProbability: 0, mouth: "happy13", eyes: "variant14", ...F },
  "Ifeoma Nwankwo": { hair: "variant05", skinColor: "6b4423", backgroundColor: "fde3dc", earringsProbability: 100, mouth: "happy14", eyes: "variant16", ...F },
  "Babatunde Ajayi": { hair: "variant47", skinColor: "5c3a21", backgroundColor: "e8eef8", beardProbability: 100, beard: "variant01", glassesProbability: 100, glasses: "variant04", mouth: "happy15", eyes: "variant17", ...M },
  "Halima Bello": { hair: "variant14", skinColor: "b07745", backgroundColor: "fdeccf", earringsProbability: 100, mouth: "happy01", eyes: "variant06", ...F },
  "Segun Adekunle": { hair: "variant01", skinColor: "7a4a26", backgroundColor: "dbe7fb", mouth: "happy02", eyes: "variant20", ...M, beardProbability: 0 },
  "Amaka Eze": { hair: "variant22", skinColor: "8d5524", backgroundColor: "f6e3ee", earringsProbability: 0, mouth: "happy03", eyes: "variant21", ...F },
  "Femi Oladipo": { hair: "variant28", skinColor: "6b4423", backgroundColor: "fde3dc", beardProbability: 0, mouth: "happy04", eyes: "variant02", ...M },
  "Ngozi Obi": { hair: "variant26", skinColor: "5c3a21", backgroundColor: "dcf3e6", earringsProbability: 100, mouth: "happy06", eyes: "variant04", ...F },
  "Yusuf Danjuma": { hair: "variant44", skinColor: "a0662f", backgroundColor: "ece6fb", beardProbability: 100, beard: "variant02", mouth: "happy10", eyes: "variant06", ...M },
  "Ada Nwosu": { hair: "variant40", skinColor: "7a4a26", backgroundColor: "e3ecfb", earringsProbability: 100, mouth: "happy13", eyes: "variant08", ...F },
  "Tunde Bello": { hair: "variant34", skinColor: "8d5524", backgroundColor: "fdeccf", beardProbability: 100, beard: "variant02", mouth: "happy14", eyes: "variant10", ...M },
  "Chioma Eze": { hair: "variant32", skinColor: "6b4423", backgroundColor: "ece6fb", earringsProbability: 0, mouth: "happy15", eyes: "variant12", ...F },
};
export const slugOf = (name) => name.toLowerCase().replace(/[^a-z]+/g, "-");

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync(OUT, { recursive: true });
  for (const [name, look] of Object.entries(PEOPLE)) {
    const q = new URLSearchParams({ seed: name, size: "192", hairColor: "1a1a1a", glassesProbability: "0", frecklesProbability: "0", hairAccessoriesProbability: "0", ...Object.fromEntries(Object.entries(look).map(([k, v]) => [k, String(v)])) });
    const res = await fetch(`${API}?${q}`);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    writeFileSync(new URL(`${slugOf(name)}.webp`, OUT), Buffer.from(await res.arrayBuffer()));
    console.log(`  ✓ ${slugOf(name)}.webp`);
  }
}
