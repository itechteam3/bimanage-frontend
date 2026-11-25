import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/auth/tokenStore";
import { serverStatus } from "@/lib/api/serverStatus";
import { installFakeBackend, renderApp, type FakeBackend } from "@/test/fakeBackend";
import { SCAN_ERROR_TEXT, ScanError, scanErrorKind, startScan } from "@/lib/scanner/scanner";
import { ScanDialog } from "./ScanButton";

// A fake camera: one track we can check is stopped.
function fakeCamera() {
  const track = { stop: vi.fn(), getCapabilities: () => ({ torch: true }), getSettings: () => ({ deviceId: "back" }), applyConstraints: vi.fn(async () => undefined) };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
  const getUserMedia = vi.fn(async () => stream);
  vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { mediaDevices: { getUserMedia, enumerateDevices: async () => [{ kind: "videoinput", deviceId: "back" }] }, vibrate: vi.fn() }));
  return { track, getUserMedia };
}

function fakeVideo() {
  const v = document.createElement("video");
  Object.defineProperty(v, "readyState", { value: 4 });
  Object.defineProperty(v, "videoWidth", { value: 640 });
  Object.defineProperty(v, "videoHeight", { value: 480 });
  v.play = vi.fn(async () => undefined);
  return v;
}

beforeEach(() => {
  // jsdom has no canvas 2D context; scanning falls back to the video frame.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("camera scanning engine", () => {
  it("reads a code, hands it back once and stops the camera", async () => {
    const { track, getUserMedia } = fakeCamera();
    const onCode = vi.fn();
    const detect = vi.fn().mockResolvedValueOnce([]).mockResolvedValue([{ rawValue: " 5901234123457 ", format: "ean_13" }]);
    const s = await startScan({ video: fakeVideo(), onCode, detector: { detect } });
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false, video: expect.objectContaining({ facingMode: { ideal: "environment" } }) }));
    await waitFor(() => expect(onCode).toHaveBeenCalledWith("5901234123457", "ean_13"));
    expect(onCode).toHaveBeenCalledTimes(1);
    expect(track.stop).toHaveBeenCalled();
    expect(navigator.vibrate).toHaveBeenCalled();
    expect(s.setTorch).toBeTypeOf("function");
  });

  it("stop() on cancel releases the camera without a code", async () => {
    const { track } = fakeCamera();
    const onCode = vi.fn();
    const s = await startScan({ video: fakeVideo(), onCode, detector: { detect: async () => [] } });
    s.stop();
    expect(track.stop).toHaveBeenCalled();
    expect(onCode).not.toHaveBeenCalled();
  });

  it("explains blocked, missing and busy cameras", () => {
    expect(scanErrorKind({ name: "NotAllowedError" })).toBe("blocked");
    expect(scanErrorKind({ name: "NotFoundError" })).toBe("missing");
    expect(scanErrorKind({ name: "NotReadableError" })).toBe("busy");
    expect(scanErrorKind(new ScanError("insecure"))).toBe("insecure");
    expect(SCAN_ERROR_TEXT.blocked.body).toMatch(/allow/i);
  });

  it("refuses on a page that isn't HTTPS", async () => {
    fakeCamera();
    vi.stubGlobal("isSecureContext", false);
    await expect(startScan({ video: fakeVideo(), onCode: vi.fn(), detector: { detect: async () => [] } })).rejects.toMatchObject({ kind: "insecure" });
  });
});

describe("Scan dialog", () => {
  it("shows how to allow the camera when it's blocked", async () => {
    vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { mediaDevices: { getUserMedia: async () => Promise.reject(Object.assign(new Error("no"), { name: "NotAllowedError" })) } }));
    render(<ScanDialog open onClose={() => undefined} onCode={() => undefined} />);
    expect(await screen.findByText(/camera access is blocked/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});

describe("scanning into a new order", () => {
  let fb: FakeBackend;
  beforeEach(() => {
    tokenStore.set("tok");
    serverStatus.set("up");
    fb = installFakeBackend();
    fb.handlers["GET /subscriptions/current"] = () => [200, { plan: "standard", status: "active", features: { orders: true, invoices: true, inventory: true } }];
    fb.handlers["GET /inventory/products"] = () => [200, [
      { _id: "p1", name: "Linen shirt", sellingPrice: 25000, stockQuantity: 18, barcode: "5901234123457", sku: "LS-1" },
      { _id: "p2", name: "Canvas tote", sellingPrice: 5000, stockQuantity: 0, barcode: "4006381333931" },
    ]];
  });
  afterEach(() => tokenStore.clear());

  it("a barcode reader (keyboard + Enter) fills a line, then adds to its quantity", async () => {
    renderApp("/orders/new");
    const user = userEvent.setup();
    const box = await screen.findByLabelText(/scan or type a barcode/i);
    await user.type(box, "5901234123457{Enter}");
    expect(screen.getByText(/added linen shirt/i)).toBeInTheDocument();
    expect((screen.getAllByLabelText(/^product/i)[0] as HTMLSelectElement).value).toBe("p1");
    await user.type(box, "ls-1{Enter}");
    expect(screen.getByText(/quantity now 2/i)).toBeInTheDocument();
    expect((screen.getAllByLabelText(/^quantity/i)[0] as HTMLInputElement).value).toBe("2");
    await user.type(box, "4006381333931{Enter}");
    expect(screen.getByText(/canvas tote is out of stock/i)).toBeInTheDocument();
    await user.type(box, "000{Enter}");
    expect(screen.getByText(/no product matches/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /scan with camera/i })).toBeInTheDocument();
  });

  it("product form: both typing and the camera button are offered for the barcode", async () => {
    fb.handlers["GET /inventory/stats"] = () => [200, {}];
    renderApp("/inventory/products/new");
    expect(await screen.findByRole("button", { name: /scan with camera/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^barcode/i })).toBeInTheDocument();
  });
});
