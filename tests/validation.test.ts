/**
 * Boundary validation tests — the shared schemas every route parses through.
 */
import { describe, expect, it } from "vitest";
import { mergeGuestSchema, profileSchema } from "@/lib/validation";

describe("mergeGuestSchema", () => {
  it("requires the idempotency importId (exactly-once guarantee)", () => {
    const missing = mergeGuestSchema.safeParse({
      profile: null,
      shortlist: [],
    });
    expect(missing.success).toBe(false);
  });

  it("accepts a valid merge payload with importId + confirmReplace", () => {
    const ok = mergeGuestSchema.safeParse({
      importId: "imp-1111-2222",
      confirmReplace: false,
      shortlist: ["mext-undergraduate-embassy"],
      plan: {
        horizonMonths: 18,
        tasks: [
          {
            stableKey: "t1",
            title: "Task",
            purpose: "p",
            category: "language",
            effortHours: 2,
            dateBasis: "estimated",
            status: "todo",
            order: 0,
          },
        ],
      },
    });
    expect(ok.success).toBe(true);
  });

  it("rejects task stable keys that are empty or oversized", () => {
    const bad = mergeGuestSchema.safeParse({
      importId: "imp-1111-2222",
      plan: {
        horizonMonths: 18,
        tasks: [{ stableKey: "", title: "T", purpose: "p", category: "x", effortHours: 1, dateBasis: "estimated", status: "todo", order: 0 }],
      },
    });
    expect(bad.success).toBe(false);
  });
});

describe("profileSchema", () => {
  it("defaults are conservative and types are strict", () => {
    const parsed = profileSchema.parse({
      degreeLevel: "bachelor",
    });
    expect(parsed.onboardingCompleted).toBe(false);
    expect(parsed.tests).toEqual([]);
    expect(parsed.citizenships).toEqual([]);
  });

  it("out-of-range intake years are rejected", () => {
    const bad = profileSchema.safeParse({ degreeLevel: "bachelor", targetIntakeYear: 1999 });
    expect(bad.success).toBe(false);
  });
});
