import { describe, expect, it } from "bun:test";

import { computeAvailability } from "@/lib/availability";

import {
  approveCalibrationPlan,
  decideResultReview,
  recordCalibration,
  saveCalibrationPlan,
  signInAs,
} from "./actions";
import { reagentStock } from "./compose";
import { createDb } from "./seed";

const WARNING = "W tym okresie nie będzie dostępnego termohigrometru. Wymagane minimum: 1.";

describe("demo feature 1: interchangeable equipment availability", () => {
  it("warns during the overlap and clears after the second device moves", () => {
    const db = createDb();
    const labCode = (labId: string): string =>
      db.labs.find((lab) => lab.id === labId)?.code ?? labId;
    const plan = db.calibrationPlans.find((candidate) => candidate.id === "plan-thermo-109");
    expect(plan).toBeDefined();
    if (plan === undefined) {
      return;
    }

    const before = computeAvailability(db.equipment, db.calibrationPlans, plan, labCode);
    expect(before.daysWithout).toBe(5);
    expect(before.warning).toBe(WARNING);

    const saved = saveCalibrationPlan(db, {
      planId: plan.id,
      equipmentId: plan.equipmentId,
      dispatchDate: "2026-12-15",
      returnDate: "2026-12-17",
      note: plan.note,
    });
    expect(saved.ok).toBe(true);

    const after = computeAvailability(db.equipment, db.calibrationPlans, plan, labCode);
    expect(after.daysWithout).toBe(0);
    expect(after.warning).toBeNull();

    expect(signInAs(db, "KIEROWNIK")).toBe(true);
    const approved = approveCalibrationPlan(db, plan.id);
    expect(approved.ok).toBe(true);
    expect(plan.status).toBe("APPROVED");
    expect(plan.approvedBy).toBe("u-manager");
  });

  it("blocks manager approval while the overlap remains", () => {
    const db = createDb();
    expect(signInAs(db, "KIEROWNIK")).toBe(true);
    const approved = approveCalibrationPlan(db, "plan-thermo-102");
    expect(approved.ok).toBe(false);
    if (!approved.ok) {
      expect(approved.error.message).toContain(WARNING);
    }
  });
});

describe("demo feature 2: review after a NOK calibration", () => {
  it("puts earlier results in the queue and records the decision and author", () => {
    const db = createDb();
    const calibration = recordCalibration(db, {
      equipmentId: "eq-ph-meter",
      calibratedMonth: "2026-11",
      vendor: "Mettler Toledo Service",
      certificateNo: "MT/2026/1127",
      adjustments: "Brak",
      result: "NOK",
      note: "",
      reviewPeriodFrom: "2026-09-01",
      reviewPeriodTo: "2026-11-27",
      points: [],
    });
    expect(calibration.ok).toBe(true);
    expect(db.reviews).toHaveLength(3);
    expect(db.reviews.every((review) => review.decision === "PENDING")).toBe(true);

    const first = db.reviews[0];
    expect(first).toBeDefined();
    if (first === undefined) {
      return;
    }
    const decision = decideResultReview(db, first.id, "REPEAT");
    expect(decision.ok).toBe(true);
    expect(first.decision).toBe("REPEAT");
    expect(first.decidedBy).toBe("u-admin");
    expect(db.audit.at(-1)?.entity).toBe("test_result_review");
  });
});

describe("demo feature 3: usable CRM stock", () => {
  it("separates expired stock, applies the threshold and recommends the first valid lot", () => {
    const db = createDb();
    const stock = reagentStock(db, "rg-crm");
    expect(stock.stock).toBe("600");
    expect(stock.usableStock).toBe("200");
    expect(stock.low).toBe(true);
    expect(stock.recommendedLot?.lotNo).toBe("SRM-1889b/26B");
  });
});
