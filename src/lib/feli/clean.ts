// Safety net for FELI's replies (the server already cleans them, see
// bimanage-backend src/utils/feli/reply.js). Whatever slips through, people
// never see action markup, JSON, code, database ids, field names or model
// names, and never em/en dashes or double hyphens.

const TAG = /\[\/?FELI_[A-Z_]+\b/;

export function cleanFeliText(input: string): string {
  let text = String(input ?? "");
  // Complete blocks, then anything from an unfinished one to the end.
  text = text.replace(/\[(FELI_[A-Z_]+)\][\s\S]*?\[\/\1\]/g, "\n");
  const cut = TAG.exec(text);
  if (cut) text = text.slice(0, cut.index);
  text = text
    .replace(/```[\s\S]*?(```|$)/g, "")
    .replace(/`[^`\n]*`/g, "")
    .replace(/\{[^{}]*"\w+"\s*:[^{}]*\}/g, "")
    .replace(/^\s*[[{].*$/gm, (line) => (/[{}[\]]/.test(line) && /[":]/.test(line) ? "" : line))
    .replace(/\b[0-9a-f]{24}\b/gi, "")
    .replace(/\b(projectId|assignedTo|invoiceId|orderId|proposalId|ownerId|userId|_id|params)\b\s*[:=]?/g, "")
    .replace(/\b(gpt-oss[\w./-]*|openai\/[\w.-]+|llama[\w.-]*|groq|mixtral[\w.-]*|qwen[\w./-]*|system prompt)\b/gi, "");
  return cleanDashes(text)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\(\s*\)/g, "")
    .trim();
}

/** No em/en dashes or double hyphens; ranges (9-5), phone numbers and hyphenated words stay. */
export function cleanDashes(text: string): string {
  return text
    .replace(/[‐‑]/g, "-")
    .replace(/(\d)\s*(?:[‒–—―]|--+)\s*(\d)/g, "$1-$2")
    .replace(/(\*\*[^*\n]+\*\*)\s*(?:[‒–—―]|--+)\s*/g, "$1: ")
    .replace(/^(\s*)(?:[‒–—―]|--+)\s+/gm, "$1- ")
    .replace(/\s*(?:[‒–—―]|--+)\s*/g, ", ")
    .replace(/,\s*([.,!?;:])/g, "$1")
    .replace(/(^|\n)\s*,\s*/g, "$1");
}
