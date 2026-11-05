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
  // Local calendar date, not UTC: for UTC+6 users (the primary audience)
  // the UTC date is still "yesterday" between 00:00 and 06:00 local, which
  // shifted overdue detection, round anchoring, and capacity math by a day.
  // Matches the local-date convention used elsewhere in the app.
  const now = new Date();
  return isoOf(now);
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

// ---------- Deadline round selection (display) ----------

export interface DeadlineDisplay<T> {
  event: T;
  /** True when this round's close date is in the past (round closed). */
  expired: boolean;
}

/**
 * Compact-surface selection (list cards, compare): the NEXT upcoming dated
 * round — earliest future closeDate, with today itself still counting as
 * open. When every round has closed, the most recent past round is returned
 * and flagged expired so callers can label it honestly instead of presenting
 * a closed round as current (the old `deadlines.find(d => d.closeDate)`
 * picked the FIRST array entry — an expired Early Action over a live
 * Regular Action). Never invents a date; null when no dated rounds exist.
 * The planning engine's anchorDeadline stays authoritative for scheduling.
 */
export function nextDeadlineDisplay<T extends { closeDate?: string }>(
  deadlines: T[],
): DeadlineDisplay<T> | null {
  const dated = deadlines
    .map((event) => {
      const t = event.closeDate ? parseISODate(event.closeDate)?.getTime() : undefined;
      return t === undefined ? null : { event, t };
    })
    .filter((x): x is { event: T; t: number } => x !== null);
  if (dated.length === 0) return null;
  const today = parseISODate(todayISO())?.getTime() ?? Date.now();
  const upcoming = dated.filter((x) => x.t >= today).sort((a, b) => a.t - b.t);
  if (upcoming.length > 0) return { event: upcoming[0].event, expired: false };
  const past = dated.filter((x) => x.t < today).sort((a, b) => b.t - a.t);
  return past.length > 0 ? { event: past[0].event, expired: true } : null;
}

/** Per-round state for detail surfaces that list every dated round. */
export function deadlineExpired(closeDate: string): boolean {
  const t = parseISODate(closeDate)?.getTime();
  if (t === undefined) return false;
  const today = parseISODate(todayISO())?.getTime() ?? Date.now();
  return t < today;
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
    // RFC 5545: DTEND for VALUE:DATE is NON-INCLUSIVE. DTEND == DTSTART
    // describes a zero-length event, which strict clients (Outlook, Apple
    // Calendar) drop or render oddly. A one-day all-day event ends the next
    // day; the date-only arithmetic below never crosses a timezone.
    const parsed = parseISODate(event.date);
    const endCompact = parsed ? isoOf(addDays(parsed, 1)).replace(/-/g, "") : compact;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}@uraan.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact}`,
      `DTEND;VALUE=DATE:${endCompact}`,
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
