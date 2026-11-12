import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Avatar } from "@/components/ui";
import { checkPhoto } from "@/components/profile/PhotoDialog";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { ME, installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";

let fb: FakeBackend;
beforeEach(() => {
  tokenStore.set("tok");
  serverStatus.set("up");
  fb = installFakeBackend();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  tokenStore.clear();
});

describe("Avatar", () => {
  it("shows initials on a brand circle when there's no photo", () => {
    const { container } = render(<Avatar name="Elijah Ayanlere" />);
    expect(container.textContent).toBe("EA");
    expect(container.firstElementChild!.className).toMatch(/bg-brand-navy-mid/);
    expect(container.querySelector("img")).toBeNull();
  });
  it("shows the person's own photo, with no referrer (Google pictures)", () => {
    const { container } = render(<Avatar name="E A" src="https://lh3.googleusercontent.com/a/x=s256-c" />);
    const img = container.querySelector("img")!;
    expect(img.getAttribute("referrerpolicy")).toBe("no-referrer");
  });
  it("is the same small size everywhere unless a large preview is asked for", () => {
    expect(render(<Avatar name="A B" />).container.firstElementChild!.className).toMatch(/size-avatar-sidebar/);
  });
});

describe("photo checks", () => {
  const file = (type: string, size: number) => new File([new Uint8Array(size)], "p", { type });
  it("accepts JPG/PNG/WebP up to 10 MB and refuses the rest", () => {
    expect(checkPhoto(file("image/jpeg", 1000))).toBeNull();
    expect(checkPhoto(file("image/webp", 1000))).toBeNull();
    expect(checkPhoto(file("image/gif", 1000))).toMatch(/JPG, PNG or WebP/);
    expect(checkPhoto(file("image/png", 11 * 1024 * 1024))).toMatch(/under 10 MB/);
  });
});

describe("Settings → Profile", () => {
  it("uses the signed-in user's own photo and removes it back to initials", async () => {
    let avatar: string | null = "https://res.cloudinary.com/x/image/upload/v1/bimanage/avatars/me.jpg";
    fb.handlers["GET /auth/me"] = () => [200, { ...ME, avatar }];
    fb.handlers["DELETE /upload/avatar"] = () => ((avatar = null), [200, { avatar: null }]);
    renderApp("/settings/profile");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /change or remove photo/i }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /remove photo/i }));
    await waitFor(() => expect(fb.calls.some((c) => c.key === "DELETE /upload/avatar")).toBe(true));
    expect(await screen.findByRole("button", { name: /add a photo/i })).toBeInTheDocument();
  });

  it("saves details and shows server validation next to the field", async () => {
    fb.handlers["PUT /profile"] = () => [400, { message: "Username already taken" }];
    renderApp("/settings/profile");
    const user = userEvent.setup();
    const username = await screen.findByLabelText(/username/i);
    await user.type(username, "samuel");
    await user.click(screen.getByRole("button", { name: /save profile/i }));
    expect(await screen.findByText("That username is taken. Try another.")).toBeInTheDocument();
    expect(username).toHaveAttribute("aria-invalid", "true");
  });

  it("an unknown failure shows a friendly message with Try again and Report a problem", async () => {
    fb.handlers["PUT /profile"] = () => [500, { message: "TypeError: Cannot read properties of undefined (reading 'x')" }];
    renderApp("/settings/profile");
    const user = userEvent.setup();
    await screen.findByLabelText(/username/i);
    await user.click(screen.getByRole("button", { name: /save profile/i }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't save your profile. Check your connection and try again.");
    expect(alert).not.toHaveTextContent(/TypeError|undefined|500/);
    expect(within(alert).getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(within(alert).getByRole("link", { name: /report a problem/i })).toHaveAttribute("href", expect.stringMatching(/^mailto:/));
  });
});

describe("account switch", () => {
  it("drops every cached query when the signed-in account changes", async () => {
    const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
    const { AuthProvider, useAuth } = await import("@/lib/auth/AuthProvider");
    const client = new QueryClient();
    let auth: ReturnType<typeof useAuth> | null = null;
    const Grab = () => ((auth = useAuth()), null);
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <Grab />
        </AuthProvider>
      </QueryClientProvider>
    );
    await waitFor(() => expect(auth!.status).toBe("authenticated"));
    client.setQueryData(["business-profile"], { businessName: "First Person Ltd" });
    fb.handlers["GET /auth/me"] = () => [200, { ...ME, _id: "u2", name: "Second Person" }];
    await auth!.signIn("tok2");
    expect(client.getQueryData(["business-profile"])).toBeUndefined();
    client.setQueryData(["business-profile"], { businessName: "Second Person Ltd" });
    fb.handlers["POST /auth/logout"] = () => [200, {}];
    await auth!.signOut();
    expect(client.getQueryData(["business-profile"])).toBeUndefined();
  });
});
