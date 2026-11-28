/** Wording and links for live schedule rows. Statuses and dates come from the API. */

import { formatDate } from "./format";
import { formatMonth } from "./months";

type ScheduleItem = { kind: string; due: string | null };

/** Calibrations and checks fall due within a month (MM/RRRR); reagent dates are exact days. */
export function scheduleDue(item: ScheduleItem): string {
  if (item.due === null) {
    return "—";
  }
  return item.kind === "CALIBRATION" || item.kind === "CHECK"
    ? formatMonth(item.due.slice(0, 7))
    : formatDate(item.due);
}

export function scheduleDetail(item: ScheduleItem): string {
  if (item.due === null) {
    return "brak wpisu";
  }
  const due = scheduleDue(item);
  switch (item.kind) {
    case "CALIBRATION":
    case "CHECK":
      return `termin ${due}`;
    case "LOT_EXPIRY":
      return `ważna do ${due}`;
    case "LOW_STOCK":
      return `stan z ${due}`;
    default:
      return `spis do ${due}`;
  }
}

/** The device whose card holds this row: the device itself, or the owner of a check plan. */
export function scheduleDevice<T extends { id: number; code: string }>(
  item: { ref_type: string; ref_id: number; label: string },
  devices: T[],
): T | undefined {
  if (item.ref_type === "equipment") {
    return devices.find((device) => device.id === item.ref_id);
  }
  if (item.ref_type === "check_plan") {
    // shortcut: check rows carry the plan id, and the API starts their label with the device code;
    // switch to an equipment id once /schedule returns one.
    return devices.find((device) => item.label.startsWith(`${device.code} `));
  }
  return undefined;
}

/** Polish noun form for a count: 1 urządzenie, 2–4 urządzenia, 5+ (and 12–14) urządzeń. */
export function plural(count: number, one: string, few: string, many: string): string {
  if (count === 1) {
    return one;
  }
  const tens = count % 100;
  return count % 10 >= 2 && count % 10 <= 4 && (tens < 12 || tens > 14) ? few : many;
}

const attentionStatuses = new Set(["OVERDUE", "NO_DATA", "LOW", "COUNT_DUE"]);
const upcomingStatuses = new Set(["DUE_SOON", "OK"]);

/** Keep overdue alerts apart from the upcoming calendar, without recalculating API statuses. */
export function overviewSchedule<
  T extends { status: string; due: string | null; valid_until: string | null },
>(rows: T[]) {
  const pressing: T[] = [];
  const upcoming: (T & { due: string })[] = [];
  for (const row of rows) {
    if (attentionStatuses.has(row.status)) {
      pressing.push(row);
    } else if (upcomingStatuses.has(row.status) && row.due !== null) {
      upcoming.push({ ...row, due: row.due });
    }
  }
  upcoming.sort((a, b) => (a.valid_until ?? a.due).localeCompare(b.valid_until ?? b.due));
  return { pressing, upcoming };
}
