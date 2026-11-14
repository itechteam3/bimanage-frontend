import { useState } from "react";
import { Button } from "@/components/ui";

// Recovery codes, shown once (at two-step set-up and whenever new ones are
// generated). The file is named after the admin and the date, e.g.
// "elijah-ayanlere-bimanage-admin-recovery-codes-2026-11-14.txt", and Copy and
// Print give exactly the same text.

export interface CodesOwner {
  name: string;
  email: string;
  roleLabel?: string;
}

/** "Elijah Ayanlere" → "elijah-ayanlere" (lowercase, spaces to hyphens, no special characters). */
export function nameSlug(name: string): string {
  const s = String(name || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-");
  return s || "admin";
}

const lagosDate = (d: Date) => new Date(d.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);

export function codesFilename(owner: CodesOwner, at: Date = new Date()): string {
  return `${nameSlug(owner.name)}-bimanage-admin-recovery-codes-${lagosDate(at)}.txt`;
}

export function codesText(owner: CodesOwner, codes: string[], at: Date = new Date()): string {
  return [
    "BiManage admin recovery codes",
    "",
    `Name:      ${owner.name}`,
    `Email:     ${owner.email}`,
    `Role:      ${owner.roleLabel || "Admin"}`,
    `Generated: ${at.toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "long", timeStyle: "short" })} (Lagos time)`,
    "",
    "Keep these safe and private. Each code works once. Generating new codes invalidates these.",
    "",
    ...codes.map((c, i) => `${String(i + 1).padStart(2, " ")}. ${c}`),
    "",
  ].join("\n");
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function RecoveryCodesPanel({ codes, owner, generatedAt, onDone, doneLabel = "Continue to admin" }: { codes: string[]; owner: CodesOwner; generatedAt?: Date; onDone: () => void; doneLabel?: string }) {
  const [at] = useState(() => generatedAt || new Date());
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const filename = codesFilename(owner, at);
  const text = codesText(owner, codes, at);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${filename}\n\n${text}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  const print = () => {
    // The print window's title is the file name, so "Save as PDF" suggests it.
    const w = window.open("", "_blank", "noopener=no,width=640,height=720");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(filename.replace(/\.txt$/, ""))}</title><style>body{font-family:ui-monospace,Menlo,Consolas,monospace;padding:32px;color:#111}pre{font-size:14px;line-height:1.6;white-space:pre-wrap}</style></head><body><pre>${escapeHtml(text)}</pre></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-lg bg-warning-bg px-3 py-2 text-body-sm text-warning">Keep these safe and private. Each code works once. Generating new codes invalidates these. They won't be shown again.</p>
      <ol className="grid grid-cols-2 gap-2 rounded-xl border border-line-card bg-surface-card p-4 font-mono text-body-lg text-ink-strong">
        {codes.map((c) => (
          <li key={c} className="rounded-md bg-surface-pale px-2 py-1 text-center">
            {c}
          </li>
        ))}
      </ol>
      <div className="grid gap-2 md:grid-cols-3">
        <Button variant="secondary" onClick={() => void copy()}>
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="secondary" onClick={download}>
          Download
        </Button>
        <Button variant="secondary" onClick={print}>
          Print
        </Button>
      </div>
      <p className="text-body-sm text-ink-muted [overflow-wrap:anywhere]">File: {filename}</p>
      <label className="flex items-start gap-3 text-body-lg text-ink-strong">
        <input type="checkbox" className="mt-1 size-5" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        I've saved these codes somewhere safe.
      </label>
      <Button fullWidth disabled={!saved} onClick={onDone}>
        {doneLabel}
      </Button>
    </div>
  );
}
