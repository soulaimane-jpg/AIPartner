/**
 * Track-record feedback loop.
 *
 * Win/loss, NPS and deal outcomes now feed partner ranking. The danger
 * with any such loop is that it becomes self-reinforcing: whoever wins
 * early keeps getting ranked first, and newcomers can never break in.
 * These tests pin the properties that stop that happening.
 */

import { describe, expect, it } from "vitest";
import {
  scorePerformance,
  type PartnerPerformance,
} from "@/lib/match-score-v2";

const base: PartnerPerformance = {
  winRate: null,
  csat: null,
  proposalsSubmitted: 0,
  csatResponses: 0,
  dealsWon: 0,
};

describe("scorePerformance", () => {
  it("is exactly neutral with no data — never a cold-start penalty", () => {
    expect(scorePerformance(null).multiplier).toBe(1);
    expect(scorePerformance(undefined).multiplier).toBe(1);
    expect(scorePerformance(base).multiplier).toBe(1);
  });

  it("never moves the score by more than ±10%", () => {
    const perfect = scorePerformance({
      ...base,
      winRate: 1,
      csat: 10,
      proposalsSubmitted: 500,
      csatResponses: 500,
      dealsWon: 400,
    });
    const awful = scorePerformance({
      ...base,
      winRate: 0,
      csat: 0,
      proposalsSubmitted: 500,
      csatResponses: 500,
    });
    expect(perfect.multiplier).toBeLessThanOrEqual(1.1);
    expect(awful.multiplier).toBeGreaterThanOrEqual(0.9);
  });

  it("rewards a strong record", () => {
    const good = scorePerformance({
      ...base,
      winRate: 0.8,
      proposalsSubmitted: 20,
      dealsWon: 12,
    });
    expect(good.multiplier).toBeGreaterThan(1);
  });

  it("penalises a weak record", () => {
    const poor = scorePerformance({
      ...base,
      winRate: 0.05,
      proposalsSubmitted: 20,
    });
    expect(poor.multiplier).toBeLessThan(1);
  });

  it("smooths small samples toward neutral", () => {
    // One win from one bid is not evidence of an 100% win rate.
    const thin = scorePerformance({
      ...base,
      winRate: 1,
      proposalsSubmitted: 1,
    });
    const thick = scorePerformance({
      ...base,
      winRate: 1,
      proposalsSubmitted: 100,
    });
    expect(thin.multiplier).toBeLessThan(thick.multiplier);
    // A single win should barely move the needle.
    expect(thin.multiplier).toBeLessThan(1.02);
  });

  it("does not bury a partner for one early loss", () => {
    const unlucky = scorePerformance({
      ...base,
      winRate: 0,
      proposalsSubmitted: 1,
    });
    // Losing your first bid costs under 2% — noise next to capability
    // fit, and fully recoverable.
    expect(unlucky.multiplier).toBeGreaterThan(0.98);
    expect(1 - unlucky.multiplier).toBeLessThan(0.02);
  });

  it("explains itself whenever it moves the score", () => {
    const withRecord = scorePerformance({
      ...base,
      winRate: 0.7,
      csat: 9,
      proposalsSubmitted: 10,
      csatResponses: 5,
      dealsWon: 7,
    });
    expect(withRecord.note).toBeTruthy();
    expect(withRecord.note).toContain("7 delivered engagements");
    expect(withRecord.note).toContain("9.0/10");
  });

  it("stays silent when there is nothing to say", () => {
    expect(scorePerformance(base).note).toBeNull();
  });

  it("treats capability fit as dominant over track record", () => {
    // The swing is ±10%, so a 60-point capability match can never
    // overtake an 80-point one on reputation alone.
    const bestCase = 60 * scorePerformance({
      ...base,
      winRate: 1,
      csat: 10,
      proposalsSubmitted: 1000,
      csatResponses: 1000,
    }).multiplier;
    const worstCase = 80 * scorePerformance({
      ...base,
      winRate: 0,
      csat: 0,
      proposalsSubmitted: 1000,
      csatResponses: 1000,
    }).multiplier;
    expect(bestCase).toBeLessThan(worstCase);
  });
});
