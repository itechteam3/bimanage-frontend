import clsx, { type ClassValue } from "clsx";

/** Join class names; falsy values are dropped. */
export const cn = (...values: ClassValue[]) => clsx(values);
