import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns the UTC offset (e.g. "+04:00", "-05:00") for the given IANA
 * timezone at the given date. Used to correctly convert a wall-clock time
 * entered by an admin (in the company's configured timezone) into an ISO
 * timestamp with an explicit offset, instead of assuming a fixed offset
 * like "+02:00" for every company regardless of where it operates.
 */
export function getUtcOffsetString(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    }).formatToParts(date);
    const offsetPart = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+0";
    const match = offsetPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!match) return "+00:00";
    const [, sign, hours, minutes = "00"] = match;
    return `${sign}${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
  } catch {
    return "+00:00";
  }
}

/**
 * Builds a correct ISO timestamp from a date ("YYYY-MM-DD"), a time
 * ("HH:mm"), and the IANA timezone that time is expressed in.
 */
export function toIsoWithTimezone(date: string, time: string, timeZone: string): string {
  // Anchor the offset lookup to midday on the given date to avoid the
  // rare case where a naive midnight construction lands on the wrong
  // side of a DST transition for the offset calculation itself.
  const offset = getUtcOffsetString(new Date(`${date}T12:00:00Z`), timeZone);
  return `${date}T${time}:00${offset}`;
}
