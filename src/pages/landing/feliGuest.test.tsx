import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";
import { installFakeSockets } from "@/test/fakeSocket";

const SUGGESTIONS = ["What is BiManage?", "How much does it cost?", "Who owns BiManage?", "How do I start?"];
const CONFIG = (over: Record<string, unknown> = {}) => ({ enabled: true, limit: 10, remaining: 7, suggestions: SUGGESTIONS, turnstileSiteKey: null, disclaimer: "FELI can make mistakes.", ...over });
const LINKS = { register: "/register", contact: "/contact" };

let fb: FakeBackend;
let configUrl: URL | null;
beforeEach(() => {
  serverStatus.set("up");
  installFakeSockets();
  tokenStore.clear();
  window.sessionStorage.clear();
  document.documentElement.classList.remove("reduce-motion");
  fb = installFakeBackend();
  configUrl = null;
  fb.handlers["GET /public/plans"] = () => [200, { plans: [] }];
  fb.handlers["GET /public/stats"] = () => [200, { businesses: { count: 0, show: false }, storesLive: { count: 0, show: false }, ordersProcessed: { count: 0, show: false }, reviews: { count: 0, average: 0, show: false } }];
  fb.handlers["GET /reviews"] = () => [200, { reviews: [], total: 0, page: 1, totalPages: 0, stats: { averageRating: 0, totalReviews: 0, ratingBreakdown: {} } }];
  fb.handlers["GET /support/faqs"] = () => [200, []];
  fb.handlers["GET /public/feli/config"] = (_b, _h, url) => {
    configUrl = url;
    return [200, CONFIG()];
  };
  vi.stubGlobal("IntersectionObserver", undefined);
});
afterEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
  delete window.turnstile;
  document.documentElement.classList.remove("reduce-motion");
  document.body.style.overflow = "";
});

const posts = () => fb.calls.filter((c) => c.key === "POST /public/feli");
const bubble = () => screen.getByRole("button", { name: "Talk to FELI" });
const panel = () => screen.getByRole("dialog", { name: "FELI" });

async function openChat(path = "/contact") {
  const user = userEvent.setup();
  renderApp(path);
  await user.click(await screen.findByRole("button", { name: "Talk to FELI" }));
  await within(panel()).findByRole("button", { name: SUGGESTIONS[0] });
  return user;
}

describe("Talk to FELI (public guest chat)", () => {
  it("replaces the old floating Contact button on the landing page", async () => {
    renderApp("/");
    await screen.findByRole("heading", { level: 1 });
    expect(bubble()).toHaveAttribute("aria-expanded", "false");
    expect(bubble()).toHaveAttribute("aria-controls", "feli-guest-panel");
    expect(screen.queryByRole("dialog", { name: "FELI" })).toBeNull();
    // The config is only fetched once the chat opens.
    expect(fb.calls.some((c) => c.key === "GET /public/feli/config")).toBe(false);
  });

  it("opens as a labelled dialog with focus in the message box; Escape closes it and focus returns to the bubble", async () => {
    const user = await openChat();
    expect(bubble()).toHaveAttribute("aria-expanded", "true");
    expect(panel()).toHaveAttribute("id", "feli-guest-panel");
    expect(within(panel()).getByText("Ask about BiManage")).toBeInTheDocument();
    expect(within(panel()).getByRole("log")).toHaveAttribute("aria-live", "polite");
    expect(within(panel()).getByLabelText("Message FELI", { selector: "input" })).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "FELI" })).toBeNull());
    expect(bubble()).toHaveFocus();
    expect(bubble()).toHaveAttribute("aria-expanded", "false");
    // The close button works too.
    await user.click(bubble());
    await user.click(within(panel()).getByRole("button", { name: "Close chat" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "FELI" })).toBeNull());
  });

  it("loads the config with the tab's session id and shows the suggestions, remaining count, note and CTA", async () => {
    await openChat();
    expect(configUrl?.searchParams.get("sessionId")).toMatch(/^[A-Za-z0-9_-]{24}$/);
    const p = within(panel());
    for (const s of SUGGESTIONS) expect(p.getByRole("button", { name: s })).toBeInTheDocument();
    expect(p.getByText("7 of 10 left today")).toBeInTheDocument();
    expect(p.getByRole("link", { name: "contact us" })).toHaveAttribute("href", "/contact");
    expect(p.getByRole("link", { name: "Create a free account" })).toHaveAttribute("href", "/register");
  });

  it("sending a chip posts only the message, history, session id and empty honeypot; history follows on the next message", async () => {
    let n = 0;
    fb.handlers["POST /public/feli"] = () => [200, { reply: n++ ? "Plans start free." : "BiManage runs your whole business in one place.", suggestions: ["How do I start?"], remaining: 6 - n + 1, limit: 10 }];
    const user = await openChat();
    await user.click(within(panel()).getByRole("button", { name: "What is BiManage?" }));
    expect(await within(panel()).findByText("BiManage runs your whole business in one place.")).toBeInTheDocument();
    const first = posts()[0]!;
    expect(first.body).toEqual({ message: "What is BiManage?", sessionId: configUrl?.searchParams.get("sessionId"), history: [], website: "" });
    expect(first.headers.Authorization).toBeUndefined();
    expect(within(panel()).getByText("6 of 10 left today")).toBeInTheDocument();
    // The reply's suggestions replace the first ones.
    expect(within(panel()).getByRole("button", { name: "How do I start?" })).toBeInTheDocument();
    expect(within(panel()).queryByRole("button", { name: "Who owns BiManage?" })).toBeNull();

    await user.type(within(panel()).getByLabelText("Message FELI", { selector: "input" }), "How much is it?{Enter}");
    expect(await within(panel()).findByText("Plans start free.")).toBeInTheDocument();
    expect(posts()[1]!.body).toEqual({
      message: "How much is it?",
      sessionId: first.body.sessionId,
      history: [
        { role: "user", content: "What is BiManage?" },
        { role: "assistant", content: "BiManage runs your whole business in one place." },
      ],
      website: "",
    });
    // Kept for this tab only.
    expect(JSON.parse(window.sessionStorage.getItem("bimanage.feliGuest.chat") ?? "[]")).toHaveLength(4);
  });

  it("renders replies as text: HTML is escaped, line breaks and lists stay", async () => {
    fb.handlers["POST /public/feli"] = () => [200, { reply: '<img src=x onerror="alert(1)"><b>hi</b>\nYou can:\n- sell online\n- track stock', suggestions: [], remaining: 6, limit: 10 }];
    const user = await openChat();
    await user.click(within(panel()).getByRole("button", { name: "What is BiManage?" }));
    const log = within(panel()).getByRole("log");
    expect(await within(log).findByText("sell online")).toBeInTheDocument();
    expect(log.querySelector("img, b")).toBeNull();
    expect(log.textContent).toContain('<img src=x onerror="alert(1)"><b>hi</b>');
    expect(within(log).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["sell online", "track stock"]);
  });

  it("our public pages in a reply become links (help articles, /register); other addresses stay text", async () => {
    fb.handlers["POST /public/feli"] = () => [200, { reply: "See /help/publish-your-store or browse /help?category=store.\n- Sign up at /register\n- Company site: bitechteam.org/contact.html", suggestions: [], remaining: 6, limit: 10 }];
    const user = await openChat();
    await user.click(within(panel()).getByRole("button", { name: "What is BiManage?" }));
    const log = within(panel()).getByRole("log");
    expect(await within(log).findByRole("link", { name: "/help/publish-your-store" })).toHaveAttribute("href", "/help/publish-your-store");
    expect(within(log).getByRole("link", { name: "/help?category=store" })).toHaveAttribute("href", "/help?category=store");
    expect(within(log).getByRole("link", { name: "/register" })).toHaveAttribute("href", "/register");
    expect(within(log).queryByRole("link", { name: "/contact" })).toBeNull();
    expect(log.textContent).toContain("bitechteam.org/contact.html");
  });

  it("daily limit: shows the server's message, disables the box and links to sign up and contact", async () => {
    fb.handlers["POST /public/feli"] = () => [429, { message: "You've used today's 10 free messages. Create a free account to keep going.", reason: "daily_limit", links: LINKS, remaining: 0, limit: 10 }];
    const user = await openChat();
    await user.click(within(panel()).getByRole("button", { name: "How do I start?" }));
    const alert = await within(panel()).findByRole("alert");
    expect(alert).toHaveTextContent("You've used today's 10 free messages.");
    expect(within(alert).getByRole("link", { name: "Create a free account" })).toHaveAttribute("href", "/register");
    expect(within(alert).getByRole("link", { name: "Contact us" })).toHaveAttribute("href", "/contact");
    expect(within(panel()).getByLabelText("Message FELI", { selector: "input" })).toBeDisabled();
    expect(within(panel()).getByRole("button", { name: "Send" })).toBeDisabled();
    expect(within(panel()).getByText("0 of 10 left today")).toBeInTheDocument();
    expect(within(alert).queryByRole("button", { name: /try again/i })).toBeNull();
  });

  it("busy: shows the message and allows a retry after a short wait", async () => {
    let n = 0;
    fb.handlers["POST /public/feli"] = () => (n++ ? [200, { reply: "Here to help.", suggestions: [], remaining: 6, limit: 10 }] : [429, { message: "FELI is busy right now. Please try again in a moment.", reason: "busy", links: LINKS, retryAfterSeconds: 2 }]);
    const user = await openChat();
    await user.click(within(panel()).getByRole("button", { name: "Who owns BiManage?" }));
    const alert = await within(panel()).findByRole("alert");
    expect(alert).toHaveTextContent("FELI is busy right now.");
    expect(within(alert).getByRole("button", { name: /try again in \ds/i })).toBeDisabled();
    const retry = await within(alert).findByRole("button", { name: "Try again" }, { timeout: 4000 });
    await user.click(retry);
    expect(await within(panel()).findByText("Here to help.")).toBeInTheDocument();
    expect(posts().map((c) => c.body.message)).toEqual(["Who owns BiManage?", "Who owns BiManage?"]);
  });

  it("Turnstile: sends one token with the first message and re-runs the widget after a 403 verification", async () => {
    let opts: Record<string, (t?: string) => void> = {};
    const ts = {
      render: vi.fn((_el: HTMLElement, o: Record<string, unknown>) => {
        opts = o as typeof opts;
        opts.callback!("tok-1");
        return "w1";
      }),
      reset: vi.fn(() => setTimeout(() => opts.callback!("tok-2"), 10)),
      remove: vi.fn(),
    };
    window.turnstile = ts;
    fb.handlers["GET /public/feli/config"] = () => [200, CONFIG({ turnstileSiteKey: "site-key" })];
    let n = 0;
    fb.handlers["POST /public/feli"] = () => {
      n++;
      if (n === 1) return [403, { message: "Please confirm you're a person.", reason: "verification", links: LINKS }];
      return [200, { reply: `Answer ${n}`, suggestions: [], remaining: 6, limit: 10 }];
    };
    const user = await openChat();
    await waitFor(() => expect(ts.render).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ sitekey: "site-key" })));
    await user.click(within(panel()).getByRole("button", { name: "What is BiManage?" }));
    expect(await within(panel()).findByText("Answer 2")).toBeInTheDocument();
    expect(ts.reset).toHaveBeenCalledWith("w1");
    expect(posts().map((c) => c.body.turnstileToken)).toEqual(["tok-1", "tok-2"]);
    // Verified: later messages carry no token.
    await user.type(within(panel()).getByLabelText("Message FELI", { selector: "input" }), "And pricing?{Enter}");
    expect(await within(panel()).findByText("Answer 3")).toBeInTheDocument();
    expect(posts()[2]!.body.turnstileToken).toBeUndefined();
  });

  it("no Turnstile widget or script when the server sends no site key", async () => {
    const ts = { render: vi.fn(), reset: vi.fn(), remove: vi.fn() };
    window.turnstile = ts;
    fb.handlers["POST /public/feli"] = () => [200, { reply: "Hello.", suggestions: [], remaining: 6, limit: 10 }];
    const user = await openChat();
    await user.click(within(panel()).getByRole("button", { name: "What is BiManage?" }));
    expect(await within(panel()).findByText("Hello.")).toBeInTheDocument();
    expect(ts.render).not.toHaveBeenCalled();
    expect(document.querySelector('script[src*="challenges.cloudflare.com"]')).toBeNull();
    expect(posts()[0]!.body).not.toHaveProperty("turnstileToken");
  });

  it("signed in: Go to dashboard instead of sign-up, and no account data is sent", async () => {
    tokenStore.set("tok");
    fb.handlers["POST /public/feli"] = () => [200, { reply: "Hello.", suggestions: [], remaining: 6, limit: 10 }];
    const user = userEvent.setup();
    renderApp("/contact");
    await user.click(await screen.findByRole("button", { name: "Talk to FELI" }));
    await waitFor(() => expect(within(panel()).getByRole("link", { name: "Go to dashboard" })).toHaveAttribute("href", "/start"));
    expect(within(panel()).queryByRole("link", { name: "Create a free account" })).toBeNull();
    await user.click(await within(panel()).findByRole("button", { name: "What is BiManage?" }));
    await within(panel()).findByText("Hello.");
    expect(posts()[0]!.headers.Authorization).toBeUndefined();
    expect(Object.keys(posts()[0]!.body).sort()).toEqual(["history", "message", "sessionId", "website"]);
    expect(within(panel()).queryByText(/Samuel|sam@x\.com|Dior/)).toBeNull();
  });

  it("is not part of the signed-in app", async () => {
    tokenStore.set("tok");
    renderApp("/dashboard");
    await waitFor(() => expect(fb.calls.some((c) => c.key === "GET /dashboard")).toBe(true));
    expect(screen.queryByRole("button", { name: "Talk to FELI" })).toBeNull();
  });

  it("respects reduced motion: no animation state, and closing is immediate", async () => {
    document.documentElement.classList.add("reduce-motion");
    const user = await openChat();
    expect(panel()).toHaveAttribute("data-motion", "reduce");
    await user.keyboard("{Escape}");
    await act(async () => undefined);
    expect(screen.queryByRole("dialog", { name: "FELI" })).toBeNull();
  });

  it("animates when motion is allowed (open state, then a closing state before it unmounts)", async () => {
    const user = await openChat();
    expect(panel()).toHaveAttribute("data-motion", "full");
    expect(panel()).toHaveAttribute("data-state", "open");
    expect(panel()).toHaveClass("fg-panel");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "FELI", hidden: true })).toHaveAttribute("data-state", "closed");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "FELI", hidden: true })).toBeNull());
  });
});
