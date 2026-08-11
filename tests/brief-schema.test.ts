import { describe, expect, it } from "vitest";
import { CreateBriefInput } from "@/lib/schemas/brief";

describe("CreateBriefInput", () => {
  it("accepts the ProjectRouter payload, which sends no delivery model", () => {
    const parsed = CreateBriefInput.safeParse({
      services: ["RESELLING", "SUPPORT"],
      deliveryModel: [],
      title: "testing brief test",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.deliveryModel).toEqual([]);
  });

  it("accepts the QualificationWizard payload, which omits deliveryModel entirely", () => {
    const parsed = CreateBriefInput.safeParse({
      services: ["CONSULTING"],
      usesCloud: true,
      hadPartner: false,
      procurement: "UNSURE",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.deliveryModel).toEqual([]);
  });

  it("still requires at least one service", () => {
    const parsed = CreateBriefInput.safeParse({ services: [] });
    expect(parsed.success).toBe(false);
    expect(parsed.success === false && parsed.error.issues[0]?.message).toBe(
      "Select at least one service",
    );
  });

  it("still rejects unknown delivery models and more than three", () => {
    expect(
      CreateBriefInput.safeParse({
        services: ["CONSULTING"],
        deliveryModel: ["retainer"],
      }).success,
    ).toBe(false);
    expect(
      CreateBriefInput.safeParse({
        services: ["CONSULTING"],
        deliveryModel: ["project", "ongoing", "advisory", "project"],
      }).success,
    ).toBe(false);
  });
});
