import { useCallback, useEffect, useRef, useState } from "react";
import { IconBolt, IconBoltOff, IconCamera, IconCameraRotate } from "@tabler/icons-react";
import { Button, Dialog } from "@/components/ui";
import { AuthNote } from "@/components/layout/AuthLayout";
import { interpretScan, listCameras, SCAN_ERROR_TEXT, scanErrorKind, startScan, type ScanErrorKind, type ScanSession } from "@/lib/scanner/scanner";
import { cn } from "@/lib/cn";

// "Scan with camera" (09.04+): opens the phone or laptop camera, reads a
// barcode or QR code, beeps/buzzes, hands the code back and stops the camera.
// Typing or a USB/Bluetooth scanner (keyboard input) keeps working beside it.

export function ScanDialog({ open, onClose, onCode, title = "Scan a barcode" }: { open: boolean; onClose: () => void; onCode: (code: string) => void; title?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const session = useRef<ScanSession | null>(null);
  const [error, setError] = useState<ScanErrorKind | null>(null);
  const [starting, setStarting] = useState(false);
  const [torch, setTorch] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  // A QR code holding a link that isn't a product code: shown, never opened or filled in.
  const [link, setLink] = useState<string | null>(null);
  const done = useRef(onCode);
  done.current = onCode;
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open || !video.current) return;
    let cancelled = false;
    setError(null);
    setLink(null);
    setStarting(true);
    setTorch(false);
    startScan({
      video: video.current,
      deviceId,
      onCode: (raw) => {
        session.current = null;
        const meant = interpretScan(raw);
        if (meant.kind === "link") return setLink(meant.host);
        done.current(meant.code);
        close.current();
      },
    })
      .then(async (s) => {
        if (cancelled) return s.stop();
        session.current = s;
        setHasTorch(Boolean(s.setTorch));
        setCameras(await listCameras());
      })
      .catch((e) => !cancelled && setError(scanErrorKind(e)))
      .finally(() => !cancelled && setStarting(false));
    return () => {
      cancelled = true;
      session.current?.stop();
      session.current = null;
    };
  }, [open, deviceId, attempt]);

  const switchCamera = () => {
    if (cameras.length < 2) return;
    const current = session.current?.deviceId ?? deviceId;
    const i = cameras.findIndex((c) => c.deviceId === current);
    setDeviceId(cameras[(i + 1) % cameras.length]?.deviceId);
  };

  const toggleTorch = async () => {
    try {
      await session.current?.setTorch?.(!torch);
      setTorch(!torch);
    } catch {
      setHasTorch(false);
    }
  };

  const help = error ? SCAN_ERROR_TEXT[error] : link ? { title: "This QR code is a link, not a product code", body: `It points to ${link}. We haven't opened it. Scan the product's barcode or a BiManage label instead.` } : null;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={help ? undefined : "Point the camera at a barcode or QR code. It scans by itself."}
      icon={<IconCamera className="size-7" />}
      actions={
        <>
          <Button variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          {link ? <Button onClick={() => setAttempt((n) => n + 1)}>Scan again</Button> : error && error !== "insecure" && error !== "unsupported" && <Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button>}
        </>
      }
    >
      {help && (
        <AuthNote tone="danger">
          <strong className="block">{help.title}</strong>
          {help.body}
        </AuthNote>
      )}
      {/* The video stays mounted (hidden on error) so "Try again" can restart it. */}
      {(
        <div className={cn("relative overflow-hidden rounded-lg bg-ink-strong", help && "hidden")}>
          <video ref={video} muted playsInline aria-label="Camera preview" className="aspect-video w-full object-cover" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-[12%] inset-y-[22%] rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
          <p role="status" className="absolute inset-x-0 bottom-2 text-center text-body-sm font-semibold text-white">
            {starting ? "Starting the camera…" : "Looking for a code…"}
          </p>
          {(hasTorch || cameras.length > 1) && (
            <div className="absolute right-2 top-2 flex gap-2">
              {hasTorch && (
                <button type="button" onClick={() => void toggleTorch()} aria-pressed={torch} aria-label={torch ? "Turn the light off" : "Turn the light on"} className={cn("flex size-11 items-center justify-center rounded-full text-white", torch ? "bg-ink-brand" : "bg-black/50")}>
                  {torch ? <IconBoltOff aria-hidden="true" className="size-icon" /> : <IconBolt aria-hidden="true" className="size-icon" />}
                </button>
              )}
              {cameras.length > 1 && (
                <button type="button" onClick={switchCamera} aria-label="Switch camera" className="flex size-11 items-center justify-center rounded-full bg-black/50 text-white">
                  <IconCameraRotate aria-hidden="true" className="size-icon" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

/** A "Scan with camera" button plus its dialog. */
export function ScanButton({ onCode, label = "Scan with camera", iconOnly = false, size = "md", variant = "secondary", className }: { onCode: (code: string) => void; label?: string; iconOnly?: boolean; size?: "md" | "lg"; variant?: "secondary" | "outlined" | "primary"; className?: string }) {
  const [open, setOpen] = useState(false);
  const onClose = useCallback(() => setOpen(false), []);
  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)} aria-label={iconOnly ? label : undefined} className={className}>
        <IconCamera aria-hidden="true" className="size-icon" />
        {!iconOnly && label}
      </Button>
      <ScanDialog open={open} onClose={onClose} onCode={onCode} />
    </>
  );
}
