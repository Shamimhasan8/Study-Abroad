/**
 * Date helpers — date-only precision is sacred.
 *
 * Rules (from the product contract):
 * - A date-only value never gains a time or timezone.
 * - ICS export of date-only events uses VALUE:DATE (all-day), so no
 *   timezone shift can move the event.
 * - Unknown precision renders as text, never as a fabricated date.
 */

export type DatePrecision = "date" | "month" | "window" | "unknown";

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function parseISODate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function isoOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

/** Human label honoring precision — never invents a day. */
export function deadlineLabel(
  precision: DatePrecision,
  closeDate?: string,
  lang: "en" | "bn" = "en",
): string {
  const bnMonths = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
  const enMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  if (!closeDate) return lang === "bn" ? "অজানা" : "Unknown";
  const parsed = parseISODate(closeDate);
  if (!parsed) return lang === "bn" ? "অজানা" : "Unknown";
  const months = lang === "bn" ? bnMonths : enMonths;
  switch (precision) {
    case "date":
      return `${months[parsed.getMonth()]} ${parsed.getDate()}, ${parsed.getFullYear()}`;
    case "month":
      return `${months[parsed.getMonth()]} ${parsed.getFullYear()}`;
    case "window":
      return lang === "bn"
        ? `${months[parsed.getMonth()]} ${parsed.getFullYear()} — আনুমানিক সময়সীমা`
        : `${months[parsed.getMonth()]} ${parsed.getFullYear()} — approximate window`;
    default:
      return lang === "bn" ? "অজানা" : "Unknown";
  }
}

// ---------- ICS export (RFC 5545 subset) ----------

function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export interface IcsEvent {
  uid: string;
  date: string; // ISO date-only
  summary: string;
  description?: string;
  allDay: true; // date-only events are always all-day
}

/** Build an ICS calendar with all-day events — no times, no timezones. */
export function buildICS(events: IcsEvent[], calendarName: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Uraan//Study Abroad Preparation//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
  ];
  for (const event of events) {
    const compact = event.date.replace(/-/g, "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}@uraan.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact}`,
      `DTEND;VALUE=DATE:${compact}`,
      `SUMMARY:${icsEscape(event.summary)}`,
    );
    if (event.description) {
      lines.push(`DESCRIPTION:${icsEscape(event.description)}`);
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  // RFC 5545 line folding at 75 octets
  const folded: string[] = [];
  for (const line of lines) {
    if (line.length <= 74) {
      folded.push(line);
    } else {
      let rest = line;
      folded.push(rest.slice(0, 74));
      rest = rest.slice(74);
      while (rest.length > 0) {
        folded.push(" " + rest.slice(0, 73));
        rest = rest.slice(73);
      }
    }
  }
  return folded.join("\r\n") + "\r\n";
}
