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
  return zonedDateTimeToUtc(date, time, timeZone).toISOString();
}

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function zonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(values.find((value) => value.type === type)?.value);

  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

function offsetMilliseconds(date: Date, timeZone: string) {
  const parts = zonedDateParts(date, timeZone);
  return (
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) -
    date.getTime()
  );
}

/** Returns the local ISO calendar date for an instant in an IANA timezone. */
export function getZonedDateString(date: Date, timeZone: string): string {
  const parts = zonedDateParts(date, timeZone);
  return `${parts.year.toString().padStart(4, "0")}-${parts.month
    .toString()
    .padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

/**
 * Converts a wall-clock date/time in an IANA timezone to an instant. The
 * second offset lookup handles DST transitions where the offset changes
 * between the initial UTC estimate and the final instant.
 */
export function zonedDateTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second = 0] = time.split(":").map(Number);
  const utcEstimate = Date.UTC(year, month - 1, day, hour, minute, second);
  let result = new Date(utcEstimate - offsetMilliseconds(new Date(utcEstimate), timeZone));
  const correctedOffset = offsetMilliseconds(result, timeZone);
  result = new Date(utcEstimate - correctedOffset);
  return result;
}

/**
 * Produces the exact UTC interval that represents one local calendar day.
 * It is intentionally based on two local midnights rather than a fixed
 * 24-hour duration, so DST days remain correct.
 */
export function getZonedDayRange(date: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const nextDate = `${next.getUTCFullYear().toString().padStart(4, "0")}-${(next.getUTCMonth() + 1)
    .toString()
    .padStart(2, "0")}-${next.getUTCDate().toString().padStart(2, "0")}`;

  return {
    start: zonedDateTimeToUtc(date, "00:00", timeZone),
    end: zonedDateTimeToUtc(nextDate, "00:00", timeZone),
  };
}

/** Returns local weekday and minutes after midnight for availability rules. */
export function getZonedWeekdayAndMinutes(date: Date, timeZone: string) {
  const parts = zonedDateParts(date, timeZone);
  return {
    weekday: new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay(),
    minutes: parts.hour * 60 + parts.minute,
  };
}
