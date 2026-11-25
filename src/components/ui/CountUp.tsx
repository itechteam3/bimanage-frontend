import { useCountUp } from "@/lib/motion";

/**
 * A figure that counts up to `value` (dashboard KPIs). Screen readers only
 * ever get the real, formatted value: while counting, the moving number is
 * aria-hidden and the final one sits beside it in sr-only text. With motion
 * off (reduced motion, tests) it is just the final value.
 */
export function CountUp({ value, format = String }: { value: number; format?: (n: number) => string }) {
  const shown = useCountUp(value);
  const final = format(value);
  if (shown === value) return <>{final}</>;
  // The final value, invisible, holds the width so the card doesn't reflow while counting.
  return (
    <>
      <span aria-hidden="true" className="inline-grid">
        <span className="invisible col-start-1 row-start-1">{final}</span>
        <span data-counting="" className="col-start-1 row-start-1 tabular-nums">
          {format(shown)}
        </span>
      </span>
      <span className="sr-only">{final}</span>
    </>
  );
}
