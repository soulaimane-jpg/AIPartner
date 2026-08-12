/**
 * Partner-facing benchmarks are the second identity firewall: partners
 * bid against each other, so a cohort statistic must never be solvable
 * back to one competitor. These tests pin the small-n suppression and
 * the direction of each percentile.
 */

import { describe, expect, it } from "vitest";
import {
  buildBenchmark,
  median,
  percentileRank,
  MIN_BENCHMARK_COHORT,
} from "@/lib/partner-self-analytics";

describe("median", () => {
  it("returns null with no data", () => {
    expect(median([])).toBeNull();
  });

  it("averages the middle pair on an even cohort", () => {
    expect(median([1, 2, 3, 4])).toBe(3); // rounds 2.5 up
    expect(median([10, 20, 30])).toBe(20);
  });
});

describe("percentileRank", () => {
  it("splits ties evenly rather than crowning everyone", () => {
    expect(percentileRank(0.5, [0.5, 0.5, 0.5], true)).toBe(50);
  });

  it("inverts for metrics where lower is better", () => {
    const cohort = [10, 20, 30, 40];
    expect(percentileRank(5, cohort, false)).toBe(100);
    expect(percentileRank(5, cohort, true)).toBe(0);
  });
});

describe("buildBenchmark", () => {
  it(`suppresses the benchmark below ${MIN_BENCHMARK_COHORT} peers`, () => {
    for (let n = 0; n < MIN_BENCHMARK_COHORT; n++) {
      const cohort = Array.from({ length: n }, (_, i) => i + 1);
      expect(buildBenchmark(1, cohort, true)).toBeNull();
    }
  });

  it("publishes aggregate-only fields once the cohort is large enough", () => {
    const stat = buildBenchmark(0.4, [0.1, 0.3, 0.9], true);
    expect(stat).not.toBeNull();
    expect(Object.keys(stat!).sort()).toEqual([
      "median",
      "percentile",
      "sampleSize",
    ]);
    expect(stat!.sampleSize).toBe(3);
  });

  it("reports the cohort median even when the caller has no value", () => {
    const stat = buildBenchmark(null, [1, 2, 3], true);
    expect(stat!.percentile).toBeNull();
    expect(stat!.median).toBe(2);
  });
});
