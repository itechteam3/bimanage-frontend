import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { linkCompanySite } from "./companyLink";

const show = (text: string) => render(<p>{linkCompanySite(text, 0)}</p>);

describe("bitechteam.org in FELI replies", () => {
  it("becomes a link to the website, opened in a new tab", () => {
    show("BiManage is a product of BiTechTeam Limited (bitechteam.org).");
    const a = screen.getByRole("link", { name: "bitechteam.org" });
    expect(a).toHaveAttribute("href", "https://bitechteam.org");
    expect(a).toHaveAttribute("target", "_blank");
    expect(a).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText(/BiManage is a product of BiTechTeam Limited/)).toHaveTextContent("BiManage is a product of BiTechTeam Limited (bitechteam.org).");
  });

  it("keeps a page on the site, and https/www forms", () => {
    show("Use the contact page at bitechteam.org/contact.html or https://www.bitechteam.org.");
    expect(screen.getByRole("link", { name: "bitechteam.org/contact.html" })).toHaveAttribute("href", "https://bitechteam.org/contact.html");
    expect(screen.getByRole("link", { name: "https://www.bitechteam.org" })).toHaveAttribute("href", "https://bitechteam.org");
  });

  it("leaves other domains as plain text", () => {
    show("See example.org or evil-bitechteam.org.uk.");
    expect(screen.queryAllByRole("link").map((a) => a.getAttribute("href"))).not.toContain("https://example.org");
  });
});

describe("approved BiTechTeam facts on the public site", async () => {
  const { renderApp, installFakeBackend } = await import("@/test/fakeBackend");
  const { serverStatus } = await import("@/lib/api/serverStatus");
  const { ALL_FAQS } = await import("@/pages/landing/faq");

  it("the footer has only the copyright line, with BiTechTeam Limited linking to bitechteam.org (no company paragraph)", async () => {
    serverStatus.set("up");
    const fb = installFakeBackend();
    fb.handlers["GET /public/plans"] = () => [200, { plans: [] }];
    fb.handlers["GET /support/faqs"] = () => [200, []];
    renderApp("/faq");
    const footer = await screen.findByRole("contentinfo");
    expect(footer).not.toHaveTextContent("Founder and CEO");
    expect(footer).not.toHaveTextContent("BiTechTeam helps people start and manage businesses");
    const link = screen.getByRole("link", { name: "BiTechTeam Limited" });
    expect(link).toHaveAttribute("href", "https://bitechteam.org");
    expect(footer).toHaveTextContent(/BiManage, a product of BiTechTeam Limited. All rights reserved./);
    expect(footer).not.toHaveTextContent("(bitechteam.org)");
    expect(footer.textContent).not.toMatch(/[–—]/);
  });

  it("the FAQ answers 'Who owns BiManage?' with exactly the approved facts", () => {
    const item = ALL_FAQS.find((f) => f.q === "Who owns BiManage?");
    expect(item).toBeDefined();
    const text = item!.a.join(" ");
    for (const fact of ["BiTechTeam Limited (bitechteam.org)", "founded in June 2023", "December 2025", "Samuel Inyima", "Elijah Ayanlere", "helps people start and manage businesses"]) expect(text).toContain(fact);
  });
});
