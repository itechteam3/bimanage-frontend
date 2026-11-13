import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { RouteErrorPage } from "./RouteErrorPage";
import { reloader } from "./VersionBanner";
import { isStaleBuildError, reloadForNewVersion } from "@/lib/reloadOnce";
import { labelPeople, type Person } from "@/lib/team/api";

// After a deploy, an open tab asked for page files that no longer existed and
// showed "Unexpected Application Error!" (seen live 2026-11-13).

const boom = (message: string) => () => {
  throw new Error(message);
};
const renderError = (message: string) =>
  render(<RouterProvider router={createMemoryRouter([{ path: "/", element: null, loader: boom(message), errorElement: <RouteErrorPage /> }], { initialEntries: ["/"] })} />);

describe("page files missing after a deploy", () => {
  let reloads: number;
  beforeEach(() => {
    reloads = 0;
    vi.spyOn(reloader, "reload").mockImplementation(() => void (reloads += 1));
    window.sessionStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it("recognises the browsers' wording", () => {
    for (const m of ["Failed to fetch dynamically imported module: https://x/assets/a.js", "Importing a module script failed.", "error loading dynamically imported module"]) expect(isStaleBuildError(new Error(m))).toBe(true);
    expect(isStaleBuildError(new Error("Cannot read properties of undefined"))).toBe(false);
  });

  it("reloads once, then shows a Reload button instead of looping", async () => {
    renderError("Failed to fetch dynamically imported module: https://bimanage/assets/FeliPages-abc.js");
    expect(await screen.findByText("Updating BiManage…")).toBeInTheDocument();
    expect(reloads).toBe(1);
    expect(reloadForNewVersion()).toBe(false);
    expect(reloads).toBe(1);
  });

  it("other errors: a plain message, not the default error screen", async () => {
    renderError("Cannot read properties of undefined");
    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    expect(screen.queryByText(/Unexpected Application Error/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(reloads).toBe(0);
  });
});

describe("people who share a name", () => {
  const p = (id: string, name: string, role: Person["role"], joinedAt: string | null = null): Person => ({ _id: id, name, avatar: null, role, joinedAt });
  it("are told apart by join date (or role); unique names stay as they are", () => {
    const out = labelPeople([p("1", "Elijah Ayanlere", "owner"), p("2", "Dev Elijah", "staff", "2026-04-26T10:00:00Z"), p("3", "Dev Elijah", "staff", "2026-11-12T10:00:00Z"), p("4", "Ada", "admin"), p("5", "Ada", "staff")]);
    expect(out.map((x) => x.label)).toEqual(["Elijah Ayanlere", "Dev Elijah (joined 26 Apr 2026)", "Dev Elijah (joined 12 Nov 2026)", "Ada (admin)", "Ada (staff)"]);
  });
});
