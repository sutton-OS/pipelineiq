import assert from "node:assert/strict";
import test from "node:test";
import {
  isWithinBusinessHours,
  nextBusinessDaySlots,
} from "@pipelineiq/engine";

const businessHours = {
  mon: [{ start: "09:00", end: "17:00" }],
  tue: [{ start: "09:00", end: "17:00" }],
  wed: [{ start: "09:00", end: "17:00" }],
  thu: [{ start: "09:00", end: "17:00" }],
  fri: [{ start: "09:00", end: "17:00" }],
  sat: [],
  sun: [],
};

test("isWithinBusinessHours handles in-hours and after-hours", () => {
  const inHours = new Date("2026-02-23T15:00:00.000Z");
  const afterHours = new Date("2026-02-23T02:00:00.000Z");

  assert.equal(isWithinBusinessHours(inHours, businessHours, "America/New_York"), true);
  assert.equal(isWithinBusinessHours(afterHours, businessHours, "America/New_York"), false);
});

test("nextBusinessDaySlots skips weekend and returns next three business days", () => {
  const fridayEveningUtc = new Date("2026-02-27T23:30:00.000Z");
  const slots = nextBusinessDaySlots(
    fridayEveningUtc,
    businessHours,
    "America/New_York",
    3,
    60,
  );

  assert.equal(slots.length, 3);

  const dayNames = slots.map((slot) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
    }).format(new Date(slot.startsAt)),
  );

  assert.deepEqual(dayNames, ["Mon", "Tue", "Wed"]);
});
