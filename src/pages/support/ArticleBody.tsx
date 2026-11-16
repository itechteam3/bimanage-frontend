import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";

// Help article bodies are "markdown-lite" (backend content/help/*.md):
// paragraphs, "1." steps (with "-" sub-points indented under a step), "-"
// bullets, "###" sub-headings, **bold** and [links](/in-app/path).
// Everything is rendered as text: no HTML from the article ever reaches the
// page, and only in-app links ("/…") become links. Older plain-text answers
// still read as paragraphs.

const STEP = /^\d+\.\s+/;
const BULLET = /^-\s+/;
const SUB = /^\s+-\s+/;

/** Where an in-app link in an article points (the public help centre maps /support/help → /help). */
export type HrefFor = (href: string) => string;
const same: HrefFor = (href) => href;

/** **bold** and [text](/path) inside a line. */
export function inline(text: string, hrefFor: HrefFor = same): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const [, bold, label = "", href = ""] = m;
    if (m.index > last) out.push(text.slice(last, m.index));
    if (bold !== undefined) out.push(<strong key={m.index} className="font-semibold text-ink-strong">{bold}</strong>);
    else if (href.startsWith("/") && !href.startsWith("//"))
      out.push(
        <Link key={m.index} to={hrefFor(href)} className="font-semibold text-ink-brand underline underline-offset-2">
          {label}
        </Link>
      );
    else out.push(label);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { kind: "steps"; items: Array<{ text: string; sub: string[] }> }
  | { kind: "bullets"; items: string[] }
  | { kind: "heading"; text: string }
  | { kind: "para"; text: string };

export function parseArticle(body: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of body.replace(/\r\n/g, "\n").split(/\n\s*\n/)) {
    const lines = chunk.split("\n").filter((l) => l.trim());
    const first = lines[0];
    if (first === undefined) continue;
    if (lines.length === 1 && /^###\s+/.test(first)) {
      blocks.push({ kind: "heading", text: first.replace(/^###\s+/, "").trim() });
    } else if (STEP.test(first) && lines.every((l) => STEP.test(l) || SUB.test(l))) {
      const items: Array<{ text: string; sub: string[] }> = [];
      for (const l of lines) {
        if (STEP.test(l)) items.push({ text: l.replace(STEP, "").trim(), sub: [] });
        else items[items.length - 1]?.sub.push(l.replace(SUB, "").trim());
      }
      // Steps continue across blank lines ("1." … blank … "2.").
      const prev = blocks[blocks.length - 1];
      if (prev && prev.kind === "steps" && !/^1\.\s/.test(first)) prev.items.push(...items);
      else blocks.push({ kind: "steps", items });
    } else if (lines.every((l) => BULLET.test(l))) {
      blocks.push({ kind: "bullets", items: lines.map((l) => l.replace(BULLET, "").trim()) });
    } else {
      blocks.push({ kind: "para", text: lines.map((l) => l.trim()).join("\n") });
    }
  }
  return blocks;
}

/** One renderer for the in-app help centre and the public /help pages. */
export function ArticleBody({ body, hrefFor = same }: { body: string; hrefFor?: HrefFor }) {
  return (
    <div className="flex flex-col gap-4 text-body-lg text-ink-secondary">
      {parseArticle(body).map((b, i) =>
        b.kind === "heading" ? (
          <h2 key={i} className="text-title-sm text-ink-strong">
            {inline(b.text, hrefFor)}
          </h2>
        ) : b.kind === "steps" ? (
          <ol key={i} className="flex flex-col gap-3">
            {b.items.map((item, n) => (
              <li key={n} className="flex gap-3">
                <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-pale text-body-sm font-semibold text-ink-brand">
                  {n + 1}
                </span>
                <span className="min-w-0 pt-0.5">
                  {inline(item.text, hrefFor)}
                  {item.sub.length > 0 && (
                    <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
                      {item.sub.map((s, k) => (
                        <li key={k}>{inline(s, hrefFor)}</li>
                      ))}
                    </ul>
                  )}
                </span>
              </li>
            ))}
          </ol>
        ) : b.kind === "bullets" ? (
          <ul key={i} className="flex list-disc flex-col gap-2 pl-5">
            {b.items.map((item, n) => (
              <li key={n}>{inline(item, hrefFor)}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className="min-w-0 whitespace-pre-line break-words">
            {b.text.split("\n").map((line, n) => (
              <Fragment key={n}>
                {n > 0 && "\n"}
                {inline(line, hrefFor)}
              </Fragment>
            ))}
          </p>
        )
      )}
    </div>
  );
}
