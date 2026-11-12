/**
 * Formatting for luxon values. luxon is type-only here: these functions call methods on the values they are given
 * (from whichever copy of luxon created them) and never construct luxon values themselves.
 */
import type { DateTime, Duration } from "luxon";

/** The user's locale (en-US outside a browser). */
export function currentLocale(): string {
    if (typeof window === "undefined") return "en-US";
    return window.navigator.language;
}

/** Normalize a duration to all of the proper units. */
export function normalizeDuration(duration: Duration): Duration {
    return duration
        .shiftTo("years", "months", "weeks", "days", "hours", "minutes", "seconds", "milliseconds")
        .normalize();
}

/** Render a date with `dateFormat`, or with `dateTimeFormat` when it has a time of day. */
export function renderMinimalDate(time: DateTime, dateFormat: string, dateTimeFormat: string, locale?: string): string {
    // If there is no relevant time specified, fall back to just rendering the date.
    if (time.second == 0 && time.minute == 0 && time.hour == 0) {
        return time.toLocal().toFormat(dateFormat, { locale });
    }

    return time.toLocal().toFormat(dateTimeFormat, { locale });
}

/** Render a duration in a minimal format to avoid bloating the result: "3 hours, 20 minutes". */
export function renderMinimalDuration(duration: Duration): string {
    const normalized = normalizeDuration(duration);

    // TODO: Luxon does not have multi-lingual/locale-aware duration rendering.
    let result = "";
    if (normalized.years) result += `${normalized.years} years, `;
    if (normalized.months) result += `${normalized.months} months, `;
    if (normalized.weeks) result += `${normalized.weeks} weeks, `;
    if (normalized.days) result += `${normalized.days} days, `;
    if (normalized.hours) result += `${normalized.hours} hours, `;
    if (normalized.minutes) result += `${normalized.minutes} minutes, `;
    if (normalized.seconds) result += `${Math.round(normalized.seconds)} seconds, `;
    if (normalized.milliseconds) result += `${Math.round(normalized.milliseconds)} ms, `;

    if (result.endsWith(", ")) result = result.substring(0, result.length - 2);
    return result;
}
