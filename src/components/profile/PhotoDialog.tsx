import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { IconCamera, IconTrash, IconUpload } from "@tabler/icons-react";
import { Avatar, Button, Dialog } from "@/components/ui";
import { AuthNote } from "@/components/layout/AuthLayout";
import { useAuth } from "@/lib/auth/AuthProvider";
import { AVATAR_MAX_INPUT_BYTES, AVATAR_MAX_UPLOAD_BYTES, AVATAR_OUTPUT_PX, AVATAR_TYPES, removeAvatar, uploadAvatar } from "@/lib/auth/profile";
import { errorMessage } from "@/lib/api/errorMessage";

const VIEW = 256; // crop viewport, CSS px

/** Check a picked file before opening it. Returns an error message or null. */
export function checkPhoto(file: File): string | null {
  if (!AVATAR_TYPES.includes(file.type)) return "Choose a JPG, PNG or WebP photo.";
  if (file.size > AVATAR_MAX_INPUT_BYTES) return "That photo is too large. Choose one under 10 MB.";
  return null;
}

interface Crop {
  scale: number; // image px → view px
  x: number; // image offset in view px
  y: number;
}

const clampCrop = (c: Crop, w: number, h: number): Crop => ({
  scale: c.scale,
  x: Math.min(0, Math.max(VIEW - w * c.scale, c.x)),
  y: Math.min(0, Math.max(VIEW - h * c.scale, c.y)),
});

/** Square cropper: drag to move, slider (or +/- keys) to zoom, arrows to nudge. */
function Cropper({ img, crop, setCrop }: { img: HTMLImageElement; crop: Crop; setCrop: (c: Crop) => void }) {
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const cover = VIEW / Math.min(img.naturalWidth, img.naturalHeight);
  const zoom = crop.scale / cover;
  const setZoom = (z: number) => {
    const scale = cover * Math.min(4, Math.max(1, z));
    // zoom around the centre
    const cx = (VIEW / 2 - crop.x) / crop.scale;
    const cy = (VIEW / 2 - crop.y) / crop.scale;
    setCrop(clampCrop({ scale, x: VIEW / 2 - cx * scale, y: VIEW / 2 - cy * scale }, img.naturalWidth, img.naturalHeight));
  };
  const move = (dx: number, dy: number) => setCrop(clampCrop({ ...crop, x: crop.x + dx, y: crop.y + dy }, img.naturalWidth, img.naturalHeight));
  return (
    <div className="flex flex-col items-center gap-4">
      <div
        role="img"
        aria-label="Photo crop area. Drag or use arrow keys to move; plus and minus to zoom."
        tabIndex={0}
        className="relative cursor-grab touch-none overflow-hidden rounded-xl bg-surface-pale outline-none focus-visible:ring-2 focus-visible:ring-brand-navy active:cursor-grabbing"
        style={{ width: VIEW, height: VIEW }}
        onPointerDown={(e: ReactPointerEvent) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { px: e.clientX, py: e.clientY, x: crop.x, y: crop.y };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d) setCrop(clampCrop({ ...crop, x: d.x + e.clientX - d.px, y: d.y + e.clientY - d.py }, img.naturalWidth, img.naturalHeight));
        }}
        onPointerUp={() => (drag.current = null)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 20 : 5;
          const keys: Record<string, () => void> = {
            ArrowLeft: () => move(step, 0),
            ArrowRight: () => move(-step, 0),
            ArrowUp: () => move(0, step),
            ArrowDown: () => move(0, -step),
            "+": () => setZoom(zoom + 0.1),
            "=": () => setZoom(zoom + 0.1),
            "-": () => setZoom(zoom - 0.1),
          };
          if (keys[e.key]) {
            e.preventDefault();
            keys[e.key]!();
          }
        }}
      >
        <img
          src={img.src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute left-0 top-0 max-w-none select-none"
          style={{ width: img.naturalWidth * crop.scale, height: img.naturalHeight * crop.scale, transform: `translate(${crop.x}px, ${crop.y}px)` }}
        />
        {/* circle guide: what the avatar will show */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgb(0_0_0/0.35)]" />
      </div>
      <label className="flex w-full max-w-64 items-center gap-3 text-body-sm text-ink-muted">
        Zoom
        <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-brand-navy" />
      </label>
    </div>
  );
}

function renderCrop(img: HTMLImageElement, crop: Crop): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = AVATAR_OUTPUT_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("canvas"));
  const sx = -crop.x / crop.scale;
  const sy = -crop.y / crop.scale;
  const side = VIEW / crop.scale;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_OUTPUT_PX, AVATAR_OUTPUT_PX);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.9));
}

/**
 * "Change photo" — pick, crop to a square, upload; or remove (back to
 * initials). Used from the avatar menu and Settings → Profile.
 */
export function PhotoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, refresh } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>({ scale: 1, x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);

  const reset = useCallback(() => {
    if (img) URL.revokeObjectURL(img.src);
    setImg(null);
    setError(null);
    setBusy(null);
  }, [img]);
  useEffect(() => {
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (file?: File) => {
    setError(null);
    if (!file) return;
    const problem = checkPhoto(file);
    if (problem) return setError(problem);
    const el = new Image();
    el.onload = () => {
      const cover = VIEW / Math.min(el.naturalWidth, el.naturalHeight);
      setCrop({ scale: cover, x: (VIEW - el.naturalWidth * cover) / 2, y: (VIEW - el.naturalHeight * cover) / 2 });
      setImg(el);
    };
    el.onerror = () => setError("We couldn't open that photo. Try a different file.");
    el.src = URL.createObjectURL(file);
  };

  const save = async () => {
    if (!img) return;
    setBusy("save");
    setError(null);
    try {
      const blob = await renderCrop(img, crop);
      if (blob.size > AVATAR_MAX_UPLOAD_BYTES) throw new Error("too-big");
      await uploadAvatar(blob);
      await refresh();
      onClose();
    } catch (err) {
      setError((err as Error).message === "too-big" ? "That photo is still too large after cropping. Try another one." : errorMessage(err, "We couldn't save your photo. Check your connection and try again."));
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy("remove");
    setError(null);
    try {
      await removeAvatar();
      await refresh();
      onClose();
    } catch (err) {
      setError(errorMessage(err, "We couldn't remove your photo. Please try again."));
      setBusy(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      icon={<IconCamera className="size-7" />}
      title={img ? "Crop your photo" : "Profile photo"}
      description={img ? "Drag to position and zoom to fit. Your photo is shown as a circle." : "JPG, PNG or WebP, up to 10 MB. You'll crop it to a square next."}
      actions={
        img ? (
          <>
            <Button variant="outlined" onClick={reset} disabled={busy !== null}>
              Choose another
            </Button>
            <Button onClick={save} loading={busy === "save"} loadingText="Saving…">
              Save photo
            </Button>
          </>
        ) : (
          <>
            <Button variant="outlined" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => input.current?.click()}>
              <IconUpload aria-hidden="true" className="size-icon" /> Choose photo
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col items-center gap-4">
        {img ? (
          <Cropper img={img} crop={crop} setCrop={setCrop} />
        ) : (
          <>
            <Avatar name={user?.name} src={user?.avatar} size="large" />
            {user?.avatar && (
              <Button variant="secondary" size="md" onClick={remove} loading={busy === "remove"} loadingText="Removing…" className="text-danger">
                <IconTrash aria-hidden="true" className="size-icon" /> Remove photo
              </Button>
            )}
          </>
        )}
        {error && (
          <AuthNote tone="danger" className="w-full">
            {error}
          </AuthNote>
        )}
        <input
          ref={input}
          type="file"
          accept={AVATAR_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose a profile photo"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </Dialog>
  );
}
