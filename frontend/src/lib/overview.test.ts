import { describe, expect, test } from "bun:test";

import { overviewSchedule, plural, scheduleDetail, scheduleDevice, scheduleDue } from "./overview";

const devices = [
  { id: 1, code: "12/A" },
  { id: 2, code: "121/A" },
  { id: 13, code: "205/W" },
];

describe("scheduleDetail", () => {
  test("shows a month for calibrations and checks", () => {
    expect(scheduleDetail({ kind: "CALIBRATION", due: "2026-08-01" })).toBe("termin 08/2026");
    expect(scheduleDetail({ kind: "CHECK", due: "2026-12-01" })).toBe("termin 12/2026");
  });

  test("shows the exact day for reagents", () => {
    expect(scheduleDetail({ kind: "LOT_EXPIRY", due: "2027-04-27" })).toBe("ważna do 27.04.2027");
    expect(scheduleDetail({ kind: "STOCK_COUNT", due: "2026-12-04" })).toBe("spis do 04.12.2026");
    expect(scheduleDetail({ kind: "LOW_STOCK", due: "2026-11-22" })).toBe("stan z 22.11.2026");
  });

  test("says when there is no entry yet", () => {
    expect(scheduleDetail({ kind: "CALIBRATION", due: null })).toBe("brak wpisu");
  });
});

describe("scheduleDue", () => {
  test("prints a calibration deadline as on the sticker and a lot expiry as a day", () => {
    expect(scheduleDue({ kind: "CALIBRATION", due: "2026-08-01" })).toBe("08/2026");
    expect(scheduleDue({ kind: "LOT_EXPIRY", due: "2027-04-01" })).toBe("01.04.2027");
    expect(scheduleDue({ kind: "CHECK", due: null })).toBe("—");
  });
});

describe("scheduleDevice", () => {
  test("finds the device of a calibration row by id", () => {
    expect(
      scheduleDevice({ ref_type: "equipment", ref_id: 2, label: "121/A Waga" }, devices),
    ).toEqual({ id: 2, code: "121/A" });
  });

  test("finds the device of a check row by the code in its label", () => {
    expect(
      scheduleDevice(
        { ref_type: "check_plan", ref_id: 1, label: "121/A Waga - Sprawdzenie" },
        devices,
      ),
    ).toEqual({ id: 2, code: "121/A" });
  });

  test("has no device for reagent rows", () => {
    expect(
      scheduleDevice({ ref_type: "reagent", ref_id: 1, label: "Kwas solny" }, devices),
    ).toBeUndefined();
  });
});

describe("plural", () => {
  test("picks the Polish form for the count", () => {
    const forms = ["urządzenie", "urządzenia", "urządzeń"] as const;
    expect([1, 3, 5, 12, 22, 25].map((count) => plural(count, ...forms))).toEqual([
      "urządzenie",
      "urządzenia",
      "urządzeń",
      "urządzeń",
      "urządzenia",
      "urządzeń",
    ]);
  });
});

describe("overviewSchedule", () => {
  test("keeps urgent and upcoming entries separate and sorts upcoming by real deadlines", () => {
    const rows = [
      { id: 1, status: "OVERDUE", due: "2026-11-01", valid_until: "2026-11-30" },
      { id: 2, status: "DUE_SOON", due: "2026-12-01", valid_until: "2026-12-31" },
      { id: 3, status: "OK", due: "2026-12-03", valid_until: "2026-12-03" },
      { id: 4, status: "NO_DATA", due: null, valid_until: null },
      { id: 5, status: "COUNT_DUE", due: null, valid_until: null },
    ];
    const { pressing, upcoming } = overviewSchedule(rows);
    expect(pressing.map(({ id }) => id)).toEqual([1, 4, 5]);
    expect(upcoming.map(({ id }) => id)).toEqual([3, 2]);
  });
});
