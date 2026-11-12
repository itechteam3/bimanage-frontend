import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => cleanup());

// React Router's data router builds a Request (with an AbortSignal) for every
// navigation. Under jsdom the signal is jsdom's but Request is Node's, and
// Node rejects it — navigations then silently fail. Tests don't need the
// signal, so drop it. (Browsers are unaffected.)
const NodeRequest = globalThis.Request;
globalThis.Request = class extends NodeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    if (init?.signal) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { signal: _signal, ...rest } = init;
      super(input, rest);
    } else {
      super(input, init);
    }
  }
} as typeof Request;

// jsdom has no <dialog> modal support.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
}

// Lazy route chunks load slower when the suite runs in parallel.
import { configure } from "@testing-library/react";
configure({ asyncUtilTimeout: 8000 });

// jsdom has no scrolling; ScrollRestoration calls window.scrollTo on every navigation.
window.scrollTo = (() => undefined) as typeof window.scrollTo;
