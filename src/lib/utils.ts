import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Normalize a phone number to a best-effort E.164-ish format.
 * Keeps a leading + and digits only. Not a full libphonenumber, but robust
 * enough to standardize storage and do basic validation.
 */
export function normalizePhone(raw: string, defaultCountryCode = "1"): string {
  if (!raw) return "";
  let s = raw.trim().replace(/[^\d+]/g, "");
  if (s.startsWith("+")) {
    return "+" + s.slice(1).replace(/\D/g, "");
  }
  // strip leading zeros used for local dialing
  s = s.replace(/^0+/, "");
  if (!s) return "";
  // If it already looks like it has a country code (long enough), just prefix +
  if (s.length > 10) return "+" + s;
  return "+" + defaultCountryCode + s;
}

export function isValidPhone(phone: string): boolean {
  if (!phone) return false;
  const normalized = normalizePhone(phone);
  return /^\+\d{8,15}$/.test(normalized);
}

export function isValidEmail(email?: string | null): boolean {
  if (!email) return true; // email is optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatDateTime(date?: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(date?: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function titleCase(s?: string | null): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
