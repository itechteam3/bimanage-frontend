import { api } from "@/lib/api/client";

// Files attached to messages (and support tickets): POST /upload/attachment.
// The server keeps JPG, PNG, WEBP or PDF up to 5 MB, and only accepts its own
// uploads back on a message, so files always go through here first.

export interface Attachment {
  url: string;
  name: string;
  type: string;
  size: number;
}

export const ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENTS = 5;

/** A plain reason a file can't be attached, or null. */
export function attachmentProblem(file: File): string | null {
  if (!ATTACHMENT_TYPES.includes(file.type)) return `${file.name} isn't a JPG, PNG, WebP or PDF file.`;
  if (file.size > ATTACHMENT_MAX_BYTES) return `${file.name} is larger than 5 MB.`;
  return null;
}

export function uploadAttachment(file: File) {
  const form = new FormData();
  form.append("file", file, file.name);
  return api<Attachment>("/upload/attachment", { method: "POST", body: form });
}

export const isImage = (a: Pick<Attachment, "type">) => a.type.startsWith("image/");
export const sizeLabel = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
