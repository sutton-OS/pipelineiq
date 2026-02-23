export type BusinessWindow = {
    start: string;
    end: string;
};
export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type BusinessHours = Record<WeekdayKey, BusinessWindow[]>;
export declare function isWithinBusinessHours(now: Date, businessHours: BusinessHours, timezone: string): boolean;
export declare function nextBusinessOpen(now: Date, businessHours: BusinessHours, timezone: string, maxDaysToScan?: number): Date | null;
export type AppointmentSlot = {
    startsAt: string;
    endsAt: string;
};
export declare function nextBusinessDaySlots(now: Date, businessHours: BusinessHours, timezone: string, slotCount?: number, durationMinutes?: number): AppointmentSlot[];
export declare function formatSlotForSms(slotIso: string, timezone: string): string;
export declare function weekdayFromDate(date: Date, timezone: string): WeekdayKey;
export declare function isBusinessDay(date: Date, businessHours: BusinessHours, timezone: string): boolean;
export declare function coerceBusinessHours(input: unknown): BusinessHours;
