// Camera barcode scanning (09.04+): the browser's BarcodeDetector where it
// reads the formats we need, otherwise ZXing (Safari/iPhone, Firefox), loaded
// only when someone opens the camera. Retail formats plus QR codes.
//
// The camera stream is always stopped by stop(): on a successful scan, on
// cancel, and when the dialog unmounts.

import { SITE_URL } from "@/lib/seo/meta";

export const SCAN_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "code_93", "codabar", "itf", "qr_code", "data_matrix"] as const;

export type ScanErrorKind = "insecure" | "unsupported" | "blocked" | "missing" | "busy" | "failed";

export class ScanError extends Error {
  constructor(public kind: ScanErrorKind) {
    super(kind);
  }
}

/** Plain-language help for each camera problem. */
export const SCAN_ERROR_TEXT: Record<ScanErrorKind, { title: string; body: string }> = {
  insecure: { title: "The camera needs a secure page", body: "Open BiManage over https:// to use the camera. You can still type the code or use a barcode scanner." },
  unsupported: { title: "This browser can't use the camera", body: "Try the latest Chrome, Safari or Edge, or type the code or use a barcode scanner." },
  blocked: {
    title: "Camera access is blocked",
    body: "Allow the camera for this site: tap the lock or camera icon next to the address, choose Allow for Camera, then try again. On iPhone: Settings → Safari → Camera → Allow.",
  },
  missing: { title: "No camera found", body: "Connect a camera, or type the code or use a USB or Bluetooth barcode scanner." },
  busy: { title: "The camera is in use", body: "Close other apps or tabs using the camera, then try again." },
  failed: { title: "The camera didn't start", body: "Try again, or type the code or use a barcode scanner." },
};

export function scanErrorKind(err: unknown): ScanErrorKind {
  if (err instanceof ScanError) return err.kind;
  const name = (err as { name?: string } | null)?.name;
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return "blocked";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") return "missing";
  if (name === "NotReadableError" || name === "AbortError" || name === "TrackStartError") return "busy";
  return "failed";
}

/** True when this page can ask for the camera at all. */
export const cameraAvailable = () => typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

type Detected = { rawValue: string; format?: string };
type NativeDetector = { detect: (src: CanvasImageSource) => Promise<Detected[]> };
type NativeDetectorCtor = { new (o: { formats: string[] }): NativeDetector; getSupportedFormats?: () => Promise<string[]> };

/** The native detector, if it reads at least EAN-13 and QR codes. */
async function nativeDetector(): Promise<NativeDetector | null> {
  const Ctor = (globalThis as unknown as { BarcodeDetector?: NativeDetectorCtor }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    const supported = (await Ctor.getSupportedFormats?.()) ?? [...SCAN_FORMATS];
    const formats = SCAN_FORMATS.filter((f) => supported.includes(f));
    if (!formats.includes("ean_13") || !formats.includes("qr_code")) return null;
    return new Ctor({ formats });
  } catch {
    return null;
  }
}

/** ZXing fallback, loaded on demand (keeps it out of the main bundle). */
async function zxingDetector(): Promise<NativeDetector> {
  const [{ BrowserMultiFormatReader }, lib] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
  const F = lib.BarcodeFormat;
  const hints = new Map();
  hints.set(lib.DecodeHintType.POSSIBLE_FORMATS, [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.CODE_93, F.CODABAR, F.ITF, F.QR_CODE, F.DATA_MATRIX]);
  hints.set(lib.DecodeHintType.TRY_HARDER, true);
  const reader = new BrowserMultiFormatReader(hints);
  return {
    detect: async (src) => {
      try {
        const r = reader.decodeFromCanvas(src as HTMLCanvasElement);
        return r ? [{ rawValue: r.getText(), format: String(r.getBarcodeFormat()) }] : [];
      } catch {
        return []; // NotFoundException: nothing in this frame
      }
    },
  };
}

export interface ScanSession {
  stop: () => void;
  /** Turn the torch on/off; undefined when the camera has none. */
  setTorch?: (on: boolean) => Promise<void>;
  /** The camera actually in use. */
  deviceId?: string;
}

export interface StartOptions {
  video: HTMLVideoElement;
  onCode: (code: string, format?: string) => void;
  /** A specific camera; otherwise the back camera is preferred. */
  deviceId?: string;
  /** Test seam. */
  detector?: NativeDetector;
}

/** Start the camera and scan until a code is read or stop() is called. */
export async function startScan({ video, onCode, deviceId, detector }: StartOptions): Promise<ScanSession> {
  if (typeof window !== "undefined" && window.isSecureContext === false) throw new ScanError("insecure");
  if (!cameraAvailable()) throw new ScanError("unsupported");

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
  } catch (e) {
    throw new ScanError(scanErrorKind(e));
  }

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const track = stream.getVideoTracks()[0];
  const stop = () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    stream.getTracks().forEach((t) => t.stop());
    if (video.srcObject === stream) video.srcObject = null;
  };

  try {
    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    video.muted = true;
    await video.play().catch(() => undefined);
    const reader = detector ?? (await nativeDetector()) ?? (await zxingDetector());
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const tick = async () => {
      if (stopped) return;
      let found: Detected[] = [];
      if (video.readyState >= 2 && video.videoWidth) {
        let src: CanvasImageSource = video;
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          src = canvas;
        }
        found = await reader.detect(src).catch(() => []);
      }
      if (stopped) return;
      const hit = found.find((f) => f.rawValue && f.rawValue.trim());
      if (hit) {
        stop();
        feedback();
        onCode(hit.rawValue.trim(), hit.format);
        return;
      }
      timer = setTimeout(() => void tick(), 180);
    };
    void tick();
  } catch (e) {
    stop();
    throw new ScanError(scanErrorKind(e));
  }

  const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
  return {
    stop,
    deviceId: track?.getSettings?.().deviceId,
    setTorch: caps.torch && track ? (on) => track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }) : undefined,
  };
}

/** Cameras on this device (labels appear once permission is granted). */
export async function listCameras(): Promise<MediaDeviceInfo[]> {
  try {
    return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
  } catch {
    return [];
  }
}

/** A short beep and a buzz on phones that support it. */
export function feedback() {
  try {
    navigator.vibrate?.(80);
  } catch {
    /* not supported */
  }
  try {
    const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = 1760;
    gain.gain.setValueAtTime(0.12, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.12);
    osc.connect(gain).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + 0.13);
    osc.onended = () => void ac.close();
  } catch {
    /* audio blocked */
  }
}

// ---------------------------------------------------------------------------
// What a scan means. Barcodes are product codes. QR codes can also hold a
// link: we take the product code out of links that carry one (GS1 Digital
// Link, ?barcode= / ?sku=, and BiManage label links), and refuse any other
// link. A link is never opened and never put in a field.

export type ScanMeaning = { kind: "code"; code: string } | { kind: "link"; host: string };

/** Hosts that serve BiManage label links (…/inventory/lookup?code=…). */
const ownHosts = () => {
  const hosts = new Set([new URL(SITE_URL).host]);
  if (typeof window !== "undefined" && window.location?.host) hosts.add(window.location.host);
  return hosts;
};

/** The link printed in a product label's QR code (labels PR). */
export const labelLink = (code: string) => `${SITE_URL}/inventory/lookup?code=${encodeURIComponent(code)}`;

const CODE = /^[A-Za-z0-9-]{1,64}$/;

export function interpretScan(raw: string): ScanMeaning {
  const text = raw.trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text) && !/^www\./i.test(text)) return { kind: "code", code: text };
  let url: URL;
  try {
    url = new URL(/^www\./i.test(text) ? `https://${text}` : text);
  } catch {
    return { kind: "code", code: text };
  }
  const host = url.host || url.protocol.replace(/:$/, "");
  const ok = (v: string | null) => (v && CODE.test(v.trim()) ? v.trim() : null);
  // BiManage label: /inventory/lookup?code=…
  if (ownHosts().has(url.host)) {
    const own = ok(url.searchParams.get("code"));
    if (own) return { kind: "code", code: own };
  }
  // ?barcode= / ?sku= on any site
  const param = ok(url.searchParams.get("barcode")) ?? ok(url.searchParams.get("sku"));
  if (param) return { kind: "code", code: param };
  // GS1 Digital Link: …/01/<GTIN-8/12/13/14>/…  (a GTIN-14 starting 0 is the EAN-13/UPC)
  const gtin = url.pathname.match(/\/01\/(\d{8}|\d{12,14})(?:\/|$)/)?.[1];
  if (gtin) return { kind: "code", code: gtin.length === 14 && gtin.startsWith("0") ? gtin.slice(1) : gtin };
  return { kind: "link", host };
}
