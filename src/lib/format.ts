import { format, parseISO } from "date-fns";

export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

export function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return "—";
    try {
        return format(parseISO(dateStr), "MMM dd, yyyy");
    } catch {
        return dateStr;
    }
}

/** Format an ISO timestamp as "MMM dd, yyyy · hh:mm a" e.g. "Apr 08, 2026 · 5:03 PM" */
export function formatDateTime(dateStr: string | null | undefined): string {
    if (!dateStr) return "—";
    try {
        return format(parseISO(dateStr), "MMM dd, yyyy · h:mm a");
    } catch {
        return dateStr;
    }
}

/** Format an ISO timestamp as time only "h:mm a" e.g. "5:03 PM" */
export function formatTimestamp(dateStr: string | null | undefined): string {
    if (!dateStr) return "—";
    try {
        return format(parseISO(dateStr), "h:mm a");
    } catch {
        return dateStr;
    }
}

export function formatTime(timeStr: string): string {
    try {
        return format(parseISO(`2000-01-01T${timeStr}`), "hh:mm a");
    } catch {
        return timeStr;
    }
}

export function getInitials(name: string): string {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

// ─── Phone Validation (PH Format) ────────────────────────────────

/**
 * Philippine phone number formats:
 * - Mobile: +63 9XX XXX XXXX or 09XX XXX XXXX
 * - Landline: +63 2 XXXX XXXX (Metro Manila) or +63 XX XXX XXXX (provincial)
 */
const PH_MOBILE_REGEX = /^(?:\+63|0)9\d{9}$/;
const PH_LANDLINE_REGEX = /^(?:\+63|0)(?:2\d{7,8}|[3-8]\d{7,9})$/;
const INTERNATIONAL_REGEX = /^\+[1-9]\d{6,14}$/;

export interface PhoneValidationResult {
  valid: boolean;
  formatted?: string;
  type?: "mobile" | "landline" | "international";
  warning?: string;
}

/**
 * Validate and format a phone number.
 * Accepts PH format (+63/0) or international format (+XX).
 */
export function validatePhone(phone: string | undefined | null): PhoneValidationResult {
  if (!phone || phone.trim() === "") {
    return { valid: true }; // Empty is OK (optional field)
  }

  // Remove spaces, dashes, parentheses
  const cleaned = phone.replace(/[\s\-()]/g, "");

  // Check PH mobile
  if (PH_MOBILE_REGEX.test(cleaned)) {
    const normalized = cleaned.startsWith("0") ? "+63" + cleaned.slice(1) : cleaned;
    return {
      valid: true,
      formatted: normalized,
      type: "mobile",
    };
  }

  // Check PH landline
  if (PH_LANDLINE_REGEX.test(cleaned)) {
    const normalized = cleaned.startsWith("0") ? "+63" + cleaned.slice(1) : cleaned;
    return {
      valid: true,
      formatted: normalized,
      type: "landline",
    };
  }

  // Check international
  if (INTERNATIONAL_REGEX.test(cleaned)) {
    return {
      valid: true,
      formatted: cleaned,
      type: "international",
    };
  }

  // Invalid format
  return {
    valid: false,
    warning: "Invalid phone format. Use +63 9XX XXX XXXX for PH mobile or +XX for international.",
  };
}

/**
 * Format a phone number for display (with spaces).
 */
export function formatPhoneDisplay(phone: string | undefined | null): string {
  if (!phone) return "";
  const result = validatePhone(phone);
  if (!result.valid || !result.formatted) return phone;

  const num = result.formatted;
  if (result.type === "mobile" && num.startsWith("+63")) {
    // +63 9XX XXX XXXX
    return `+63 ${num.slice(3, 6)} ${num.slice(6, 9)} ${num.slice(9)}`;
  }
  return num;
}

/**
 * Validate email domain — only allows well-known email providers and legitimate company domains.
 * Rejects obviously fake/random domains like "akshdja.com".
 * 
 * Allowed:
 * - Major providers: gmail.com, yahoo.com, outlook.com, hotmail.com, icloud.com, etc.
 * - PH providers: globe.com.ph, smart.com.ph, pldt.net, etc.
 * - Company domains: any domain with a valid TLD that has 2+ characters in the name part
 * 
 * Rejected:
 * - Random/gibberish domains (no vowels, too short, suspicious patterns)
 * - Single-use/disposable email domains
 */

const ALLOWED_EMAIL_PROVIDERS = new Set([
  // Company domain
  "nexsdsi.com",
  // Global providers
  "gmail.com", "googlemail.com",
  "yahoo.com", "yahoo.com.ph", "yahoo.co.uk", "yahoo.co.jp",
  "outlook.com", "hotmail.com", "live.com", "msn.com",
  "icloud.com", "me.com", "mac.com",
  "protonmail.com", "proton.me",
  "zoho.com", "zohomail.com",
  "aol.com",
  "mail.com",
  "yandex.com", "yandex.ru",
  "tutanota.com", "tuta.io",
  "fastmail.com",
  "gmx.com", "gmx.net",
  // PH providers
  "globe.com.ph", "smart.com.ph", "pldt.net", "converge.com.ph",
  "email.com",
]);

// Known disposable/temporary email domains to block
const BLOCKED_DOMAINS = new Set([
  "tempmail.com", "throwaway.email", "guerrillamail.com", "mailinator.com",
  "yopmail.com", "sharklasers.com", "guerrillamailblock.com", "grr.la",
  "dispostable.com", "trashmail.com", "10minutemail.com", "temp-mail.org",
  "fakeinbox.com", "maildrop.cc", "getnada.com",
]);

export interface EmailValidationResult {
  valid: boolean;
  error?: string;
}

export function validateEmailDomain(email: string): EmailValidationResult {
  if (!email || !email.trim()) {
    return { valid: false, error: "Email address is required" };
  }

  const trimmed = email.trim().toLowerCase();
  
  // Basic format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { valid: false, error: "Please enter a valid email address" };
  }

  const [, domain] = trimmed.split("@");
  if (!domain) {
    return { valid: false, error: "Please enter a valid email address" };
  }

  // Only allow company domain
  if (domain !== "nexsdsi.com") {
    return { valid: false, error: "Only @nexsdsi.com email addresses are allowed" };
  }

  return { valid: true };
}
