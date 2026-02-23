"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWithinBusinessHours = isWithinBusinessHours;
exports.nextBusinessOpen = nextBusinessOpen;
exports.nextBusinessDaySlots = nextBusinessDaySlots;
exports.formatSlotForSms = formatSlotForSms;
exports.weekdayFromDate = weekdayFromDate;
exports.isBusinessDay = isBusinessDay;
exports.coerceBusinessHours = coerceBusinessHours;
const WEEKDAY_ORDER = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
function parseTimeParts(value) {
    const [hoursRaw, minutesRaw] = value.split(":");
    const hours = Number(hoursRaw ?? "0");
    const minutes = Number(minutesRaw ?? "0");
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
        return { hours: 0, minutes: 0 };
    }
    return {
        hours: Math.max(0, Math.min(23, Math.trunc(hours))),
        minutes: Math.max(0, Math.min(59, Math.trunc(minutes))),
    };
}
function parseOffsetMinutes(timeZoneName) {
    const match = timeZoneName.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
    if (!match)
        return 0;
    const sign = match[1] === "-" ? -1 : 1;
    const hours = Number(match[2] ?? "0");
    const minutes = Number(match[3] ?? "0");
    return sign * (hours * 60 + minutes);
}
function getOffsetMinutes(timezone, date) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        timeZoneName: "shortOffset",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).formatToParts(date);
    const tzName = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+0";
    return parseOffsetMinutes(tzName);
}
function getZonedParts(date, timezone) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(date);
    const partValue = (type) => {
        const value = parts.find((part) => part.type === type)?.value;
        return value ?? "0";
    };
    const weekdayRaw = partValue("weekday").slice(0, 3).toLowerCase();
    const weekday = (weekdayRaw === "mon" ||
        weekdayRaw === "tue" ||
        weekdayRaw === "wed" ||
        weekdayRaw === "thu" ||
        weekdayRaw === "fri" ||
        weekdayRaw === "sat" ||
        weekdayRaw === "sun"
        ? weekdayRaw
        : "mon");
    return {
        year: Number(partValue("year")),
        month: Number(partValue("month")),
        day: Number(partValue("day")),
        weekday,
        hour: Number(partValue("hour")),
        minute: Number(partValue("minute")),
    };
}
function zonedDateTimeToUtc(timezone, year, month, day, hour, minute) {
    const naiveUtcMillis = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    let utcDate = new Date(naiveUtcMillis);
    const initialOffset = getOffsetMinutes(timezone, utcDate);
    utcDate = new Date(naiveUtcMillis - initialOffset * 60_000);
    const secondOffset = getOffsetMinutes(timezone, utcDate);
    if (secondOffset !== initialOffset) {
        utcDate = new Date(naiveUtcMillis - secondOffset * 60_000);
    }
    return utcDate;
}
function toMinutes(hours, minutes) {
    return hours * 60 + minutes;
}
function isWithinBusinessHours(now, businessHours, timezone) {
    const zoned = getZonedParts(now, timezone);
    const windows = businessHours[zoned.weekday] ?? [];
    const currentMinutes = toMinutes(zoned.hour, zoned.minute);
    return windows.some((window) => {
        const start = parseTimeParts(window.start);
        const end = parseTimeParts(window.end);
        return currentMinutes >= toMinutes(start.hours, start.minutes) && currentMinutes < toMinutes(end.hours, end.minutes);
    });
}
function nextBusinessOpen(now, businessHours, timezone, maxDaysToScan = 14) {
    for (let dayOffset = 0; dayOffset <= maxDaysToScan; dayOffset += 1) {
        const candidateDate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
        const zoned = getZonedParts(candidateDate, timezone);
        const windows = businessHours[zoned.weekday] ?? [];
        if (windows.length === 0)
            continue;
        const sortedWindows = [...windows].sort((a, b) => a.start.localeCompare(b.start));
        for (const window of sortedWindows) {
            const start = parseTimeParts(window.start);
            let slotHour = start.hours;
            let slotMinute = start.minutes;
            if (dayOffset === 0) {
                const nowMinutes = toMinutes(zoned.hour, zoned.minute);
                const startMinutes = toMinutes(start.hours, start.minutes);
                const roundedNowMinutes = Math.ceil(nowMinutes / 15) * 15;
                if (roundedNowMinutes > startMinutes) {
                    slotHour = Math.floor(roundedNowMinutes / 60);
                    slotMinute = roundedNowMinutes % 60;
                }
            }
            const utcDate = zonedDateTimeToUtc(timezone, zoned.year, zoned.month, zoned.day, slotHour, slotMinute);
            if (utcDate > now) {
                return utcDate;
            }
        }
    }
    return null;
}
function nextBusinessDaySlots(now, businessHours, timezone, slotCount = 3, durationMinutes = 60) {
    const slots = [];
    for (let dayOffset = 1; dayOffset <= 14 && slots.length < slotCount; dayOffset += 1) {
        const candidateDate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
        const zoned = getZonedParts(candidateDate, timezone);
        const windows = businessHours[zoned.weekday] ?? [];
        if (windows.length === 0)
            continue;
        const firstWindow = [...windows].sort((a, b) => a.start.localeCompare(b.start))[0];
        if (!firstWindow)
            continue;
        const startParts = parseTimeParts(firstWindow.start);
        const endParts = parseTimeParts(firstWindow.end);
        const startMinutes = toMinutes(startParts.hours, startParts.minutes);
        const endMinutes = toMinutes(endParts.hours, endParts.minutes);
        if (endMinutes - startMinutes < durationMinutes) {
            continue;
        }
        const startsAt = zonedDateTimeToUtc(timezone, zoned.year, zoned.month, zoned.day, startParts.hours, startParts.minutes);
        const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
        slots.push({ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() });
    }
    return slots;
}
function formatSlotForSms(slotIso, timezone) {
    const slotDate = new Date(slotIso);
    return new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(slotDate);
}
function weekdayFromDate(date, timezone) {
    const zoned = getZonedParts(date, timezone);
    return zoned.weekday;
}
function isBusinessDay(date, businessHours, timezone) {
    const weekday = weekdayFromDate(date, timezone);
    const windows = businessHours[weekday] ?? [];
    return windows.length > 0;
}
function coerceBusinessHours(input) {
    const fallback = {
        mon: [{ start: "09:00", end: "17:00" }],
        tue: [{ start: "09:00", end: "17:00" }],
        wed: [{ start: "09:00", end: "17:00" }],
        thu: [{ start: "09:00", end: "17:00" }],
        fri: [{ start: "09:00", end: "17:00" }],
        sat: [],
        sun: [],
    };
    if (!input || typeof input !== "object") {
        return fallback;
    }
    const source = input;
    const result = { ...fallback };
    for (const day of WEEKDAY_ORDER) {
        const windowsRaw = source[day];
        if (!Array.isArray(windowsRaw)) {
            result[day] = [];
            continue;
        }
        result[day] = windowsRaw
            .map((window) => {
            if (!window || typeof window !== "object")
                return null;
            const candidate = window;
            if (typeof candidate.start !== "string" || typeof candidate.end !== "string")
                return null;
            return { start: candidate.start, end: candidate.end };
        })
            .filter((value) => value !== null);
    }
    return result;
}
