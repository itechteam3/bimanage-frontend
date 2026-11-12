import { api } from "@/lib/api/client";
import type { User } from "./api";

// The photo is changed only through these two calls (never as a URL).
export const uploadAvatar = (photo: Blob, filename = "avatar.jpg") => {
  const form = new FormData();
  form.append("avatar", photo, filename);
  return api<{ avatar: string }>("/upload/avatar", { method: "POST", body: form });
};

export const removeAvatar = () => api<{ avatar: null }>("/upload/avatar", { method: "DELETE" });

export interface ProfileInput {
  name?: string;
  username?: string;
  phone?: string;
}

export const updateProfile = (input: ProfileInput) => api<User>("/profile", { method: "PUT", body: input });

export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** Largest photo we'll open for cropping; the cropped upload is far smaller. */
export const AVATAR_MAX_INPUT_BYTES = 10 * 1024 * 1024;
/** The server's limit for the uploaded (cropped) file. */
export const AVATAR_MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const AVATAR_OUTPUT_PX = 512;
