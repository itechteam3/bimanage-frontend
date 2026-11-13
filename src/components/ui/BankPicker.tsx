import { useId, useMemo, useRef, useState } from "react";
import { IconChevronDown, IconSearch } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { TextInput } from "./Field";

export interface Bank {
  name: string;
  code: string;
}

// The banks most Nigerian merchants use, shown first. Matched by name so a
// change in Paystack's codes doesn't break the order.
const POPULAR: RegExp[] = [
  /^opay/i,
  /moniepoint/i,
  /^palmpay/i,
  /guaranty|gtbank|^gtb\b/i,
  /^access bank(?! \(diamond\))/i,
  /^zenith/i,
  /^first bank/i,
  /^united bank for africa|^uba\b/i,
  /^kuda/i,
  /^fidelity/i,
  /^union bank/i,
  /^sterling/i,
  /^stanbic/i,
  /^wema/i,
  /^first city monument|^fcmb/i,
  /^ecobank/i,
  /^polaris/i,
  /^keystone/i,
];
const popularRank = (name: string) => {
  const i = POPULAR.findIndex((re) => re.test(name));
  return i < 0 ? Infinity : i;
};
/** "GT bank", "gtb", "Guaranty" all find Guaranty Trust Bank. */
const ALIASES: Array<[RegExp, string]> = [
  [/guaranty/i, "gtb gtbank gt bank"],
  [/united bank for africa/i, "uba"],
  [/first city monument/i, "fcmb"],
  [/stanbic/i, "ibtc"],
];
const searchText = (b: Bank) => `${b.name} ${ALIASES.filter(([re]) => re.test(b.name)).map(([, a]) => a).join(" ")}`.toLowerCase();
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const MAX_SHOWN = 60;

/**
 * Searchable bank picker (combobox): type to filter, popular banks first.
 * Keyboard: ↑/↓ to move, Enter to choose, Esc to close. Works with a Field
 * label (the input gets the Field's id).
 */
export function BankPicker({ banks, value, onChange, disabled, loading }: { banks: Bank[]; value: string; onChange: (code: string) => void; disabled?: boolean; loading?: boolean }) {
  const selected = banks.find((b) => b.code === value) ?? null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  const options = useMemo(() => {
    const q = norm(query);
    const all = [...banks].sort((a, b) => popularRank(a.name) - popularRank(b.name) || a.name.localeCompare(b.name));
    if (!q) return all.slice(0, MAX_SHOWN);
    const hits = all.filter((b) => norm(searchText(b)).includes(q));
    // Names that start with what was typed come first.
    return hits.sort((a, b) => Number(!norm(a.name).startsWith(q)) - Number(!norm(b.name).startsWith(q))).slice(0, MAX_SHOWN);
  }, [banks, query]);
  const popularCount = query ? 0 : options.filter((b) => popularRank(b.name) !== Infinity).length;

  const choose = (b: Bank) => {
    onChange(b.code);
    setQuery("");
    setOpen(false);
  };
  const move = (delta: number) => {
    setOpen(true);
    setActive((i) => {
      const next = Math.max(0, Math.min(options.length - 1, i + delta));
      const el = listRef.current?.querySelectorAll("[role=option]")[next] as HTMLElement | undefined;
      el?.scrollIntoView?.({ block: "nearest" }); // keep the highlighted bank in view
      return next;
    });
  };

  return (
    <div className="relative">
      <TextInput
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? `${listId}-${options[active].code}` : undefined}
        autoComplete="off"
        disabled={disabled}
        placeholder={loading ? "Loading banks…" : selected ? selected.name : "Type to search banks"}
        value={open ? query : selected?.name ?? ""}
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        // Already focused after choosing a bank: a click opens the list again.
        onClick={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") (e.preventDefault(), move(1));
          else if (e.key === "ArrowUp") (e.preventDefault(), move(-1));
          else if (e.key === "Enter" && open && options[active]) (e.preventDefault(), choose(options[active]));
          else if (e.key === "Escape") setOpen(false);
        }}
        trailing={open ? <IconSearch aria-hidden="true" className="size-4 shrink-0 text-ink-muted" /> : <IconChevronDown aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />}
      />
      {open && !disabled && (
        <ul ref={listRef} id={listId} role="listbox" aria-label="Banks" className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-md border border-line-card bg-surface-card py-1 shadow-floating">
          {options.length === 0 ? (
            <li className="px-4 py-3 text-body-sm text-ink-muted">No bank matches &ldquo;{query}&rdquo;.</li>
          ) : (
            options.map((b, i) => (
              <li
                key={b.code}
                id={`${listId}-${b.code}`}
                role="option"
                aria-selected={b.code === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(b)}
                onMouseEnter={() => setActive(i)}
                className={cn("flex min-h-11 cursor-pointer items-center px-4 text-body-lg text-ink-strong", i === active && "bg-surface-tonal", b.code === value && "font-semibold text-ink-brand", i === popularCount && popularCount > 0 && "border-t border-line-subtle")}
              >
                {b.name}
              </li>
            ))
          )}
          {!query && banks.length > MAX_SHOWN && <li className="px-4 py-2 text-caption text-ink-muted">Type to search all {banks.length} banks.</li>}
        </ul>
      )}
    </div>
  );
}
