import { useRef, useState } from "react";
import { IconPaperclip, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui";
import { errorMessage } from "@/lib/api/errorMessage";
import { ATTACHMENT_TYPES, MAX_ATTACHMENTS as MAX, attachmentProblem, sizeLabel, uploadAttachment, type Attachment } from "@/lib/attachments";

// Shared by support tickets and BiSupplyNet (dispute evidence, the
// wholesaler verification document).

/** Files uploaded one by one to POST /upload/attachment; shown as removable chips. */
export function AttachmentPicker({ value, onChange, onBusy, label = "Attachments", max = MAX, required }: { value: Attachment[]; onChange: (next: Attachment[]) => void; onBusy?: (busy: boolean) => void; label?: string; /** Files allowed in all (e.g. what is left of a dispute's 5). */ max?: number; required?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = value.length >= max;

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    let list = [...value];
    setBusy(true);
    onBusy?.(true);
    for (const f of Array.from(files)) {
      if (list.length >= max) {
        setError(`You can attach up to ${max} ${max === 1 ? "file" : "files"}.`);
        break;
      }
      const problem = attachmentProblem(f);
      if (problem) {
        setError(problem);
        continue;
      }
      try {
        const a = await uploadAttachment(f);
        list = [...list, a];
        onChange(list);
      } catch (err) {
        setError(errorMessage(err, `We couldn't upload ${f.name}. Please try again.`));
      }
    }
    setBusy(false);
    onBusy?.(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-3 rounded-sm bg-surface-pale px-4 py-2.5 lg:bg-transparent lg:p-0">
      <p className="text-field-label uppercase text-ink-brand lg:text-ink-secondary">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </p>
      <p className="text-body-sm text-ink-muted">Up to {max} {max === 1 ? "file" : "files"}: JPG, PNG, WebP or PDF, 5 MB each.</p>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Attached files">
          {value.map((a, i) => (
            <li key={`${a.url}-${i}`} className="flex items-center gap-2 rounded-full bg-surface-tint-blue py-1 pl-3 pr-1 text-body-sm text-ink-brand">
              <IconPaperclip aria-hidden="true" className="size-4 shrink-0" />
              <span className="max-w-48 truncate">{a.name}</span>
              <span className="text-ink-muted">{sizeLabel(a.size)}</span>
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="flex size-8 items-center justify-center rounded-full hover:bg-surface-card" aria-label={`Remove ${a.name}`}>
                <IconX aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input ref={inputRef} type="file" multiple accept={ATTACHMENT_TYPES.join(",")} className="sr-only" tabIndex={-1} aria-label={`Add ${label.toLowerCase()}`} onChange={(e) => void add(e.target.files)} />
      <Button type="button" size="md" variant="outlined" className="self-start" loading={busy} loadingText="Uploading…" disabled={full} onClick={() => inputRef.current?.click()}>
        <IconPaperclip aria-hidden="true" className="size-4" /> {full ? "File limit reached" : "Add files"}
      </Button>
      {error && (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

