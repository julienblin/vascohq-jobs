import Decimal from "decimal.js";
import { MetricsTable, MetricsTableConfiguration } from "./metrics-table";

describe("MetricsTable", () => {
  it("should work with the empty configuration", () => {
    const metricsTable = new MetricsTable({ metrics: [] });
    expect(metricsTable.getMetrics()).toEqual([]);
    expect(metricsTable.getPeriods()).toEqual([]);
  });

  describe("getValue", () => {
    const configuration = {
      metrics: [
        {
          name: "beginningMRR",
          aggregate: "sum",
        },
        {
          name: "endingMRR",
          compute: (table, period, currentValue) => {
            const beginningMRR = table.getValue("beginningMRR", period);
            if (beginningMRR === undefined) {
              return currentValue;
            }
            return beginningMRR;
          },
        },
        {
          name: "anotherMetric",
        },
      ],
      aggregates: {
        quarter: true,
        year: true,
      },
    } as const satisfies MetricsTableConfiguration;

    it("should throw an error if the metric is unknown", () => {
      const metricsTable = new MetricsTable(configuration);
      expect(() =>
        metricsTable.getValue("unknown" as never, { year: 2023 }),
      ).toThrowError("Unknown metric: unknown");
    });

    it("should return undefined if no value", () => {
      const metricsTable = new MetricsTable(configuration);
      expect(
        metricsTable.getValue("beginningMRR", { year: 2023 }),
      ).toBeUndefined();
    });

    it("should recompute the value if the value is set", () => {
      const metricsTable = new MetricsTable(configuration);
      const result = metricsTable.update({
        metric: "beginningMRR",
        period: { year: 2023, month: 1 },
        value: new Decimal(10),
      });
      expect(
        metricsTable.getValue("endingMRR", { year: 2023, month: 1 }),
      ).toEqual(new Decimal(10));

      expect(result).toEqual([
        {
          metric: "beginningMRR",
          period: { year: 2023, month: 1 },
          value: new Decimal(10),
          oldValue: undefined,
        },
        {
          metric: "endingMRR",
          period: { month: 1, year: 2023 },
          value: new Decimal(10),
          oldValue: undefined,
        },
        {
          metric: "beginningMRR",
          period: { quarter: 1, year: 2023 },
          value: new Decimal(10),
          oldValue: undefined,
        },
        {
          metric: "beginningMRR",
          period: { quarter: 2, year: 2023 },
          value: new Decimal(0),
          oldValue: undefined,
        },
        {
          metric: "beginningMRR",
          period: { quarter: 3, year: 2023 },
          value: new Decimal(0),
          oldValue: undefined,
        },
        {
          metric: "beginningMRR",
          period: { quarter: 4, year: 2023 },
          value: new Decimal(0),
          oldValue: undefined,
        },
        {
          metric: "beginningMRR",
          period: { year: 2023 },
          value: new Decimal(10),
          oldValue: undefined,
        },
      ]);
    });

    it("should recompute aggregates partially", () => {
      const metricsTable = new MetricsTable(configuration);
      metricsTable.update({
        metric: "beginningMRR",
        period: { year: 2023, month: 1 },
        value: new Decimal(10),
      });
      const result = metricsTable.update({
        metric: "beginningMRR",
        period: { year: 2023, month: 12 },
        value: new Decimal(10),
      });
      expect(result).toEqual([
        {
          metric: "beginningMRR",
          period: { year: 2023, month: 12 },
          value: new Decimal(10),
          oldValue: undefined,
        },
        {
          metric: "endingMRR",
          period: { month: 12, year: 2023 },
          value: new Decimal(10),
          oldValue: undefined,
        },
        {
          metric: "beginningMRR",
          period: { quarter: 4, year: 2023 },
          value: new Decimal(10),
          oldValue: new Decimal(0),
        },
        {
          metric: "beginningMRR",
          period: { year: 2023 },
          value: new Decimal(20),
          oldValue: new Decimal(10),
        },
      ]);
    });

    it("should deepClone", () => {
      const metricsTable = new MetricsTable(configuration);
      metricsTable.update({
        metric: "beginningMRR",
        period: { year: 2023, month: 1 },
        value: new Decimal(20),
      });
      const clone = metricsTable.deepClone();
      clone.update({
        metric: "anotherMetric",
        period: { year: 2023, month: 1 },
        value: new Decimal(10),
      });
      expect(clone).not.toBe(metricsTable);
      expect(
        metricsTable.getValue("beginningMRR", { year: 2023, month: 1 }),
      ).toEqual(new Decimal(20));
      expect(clone.getValue("beginningMRR", { year: 2023, month: 1 })).toEqual(
        new Decimal(20),
      );
      expect(clone.getValue("anotherMetric", { year: 2023, month: 1 })).toEqual(
        new Decimal(10),
      );
    });
  });
});
