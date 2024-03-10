/**
 * This modules exposes a system to build metrics tables
 */

import Decimal from "decimal.js";
import { average } from "../metrics/metrics";
import {
  Period,
  getMonthsForQuarter,
  getMonthsForYear,
  isQuarter,
  isYear,
  periodFromKey,
  periodKey,
  periodSorter,
} from "../periods";

export interface MetricsTableConfiguration {
  /**
   * The metrics to store, and eventually compute.
   *
   * For the computed ones, there is no dependency tracking, so the order matters.
   */
  metrics: readonly MetricConfiguration<this>[];
  aggregates?: AggregateConfiguration;
}

export interface MetricConfiguration<
  TConfiguration extends MetricsTableConfiguration,
> {
  /**
   * The name of the metric.
   */
  name: string;

  /**
   * A function that get invoked when the table is recomputed, for each period that is not an aggregate.
   * @param table the metrics table itself
   * @param period the period for which the metric is being computed
   * @param currentValue the current value of the metric, if any
   * @returns the updated value of the metric
   */
  compute?: (
    table: MetricsTable<TConfiguration>,
    period: Period,
    currentValue: Decimal | undefined,
  ) => Decimal | undefined;

  /**
   * The aggregate function to use when computing the metric for aggregate periods.
   *
   *  - first: use the first value of the period
   *  - last: use the last value of the period
   *  - average: use the average for the period
   *  - sum: use the sum for the period
   *  - a custom function that takes the table, the included periods, the period and the current value and returns the new value
   */
  aggregate?:
    | "first"
    | "last"
    | "average"
    | "sum"
    | ((
        table: MetricsTable<TConfiguration>,
        includedPeriods: Period[],
        period: Period,
        currentValue: Decimal | undefined,
      ) => Decimal | undefined);
}

export interface AggregateConfiguration {
  /**
   * Indicates whether or not to compute aggregates for quarters.
   */
  quarter?: boolean;

  /**
   * Indicates whether or not to compute aggregates for years.
   */
  year?: boolean;
}

/**
 * Extract the names of the metrics from a configuration.
 */
export type ExtractMetricsNames<
  TConfiguration extends MetricsTableConfiguration,
> = TConfiguration["metrics"][number]["name"];

export interface MetricValue<TMetrics extends string> {
  metric: TMetrics;
  period: Period;
  value: Decimal | undefined;
}

/**
 * A mutable metrics table that can compute metrics over time and aggregates.
 */
export class MetricsTable<TConfiguration extends MetricsTableConfiguration> {
  private data: Map<ExtractMetricsNames<TConfiguration>, Map<string, Decimal>>;

  constructor(
    protected configuration: TConfiguration,
    initialData?: MetricValue<ExtractMetricsNames<TConfiguration>>[],
  ) {
    this.data = new Map(
      configuration.metrics.map((metric) => [metric.name, new Map()]),
    );

    if (initialData) {
      this.update(...initialData);
    }
  }

  /**
   * Get a metric value for a period, or undefined if the metric is not available.
   */
  public getValue(
    metric: ExtractMetricsNames<TConfiguration>,
    period: Period,
  ): Decimal | undefined {
    const row = this.data.get(metric);
    if (!row) throw new Error(`Unknown metric: ${metric}`);

    return row.get(periodKey(period));
  }

  /**
   * Get all the defined metrics.
   */
  public getMetrics(): ExtractMetricsNames<TConfiguration>[] {
    return Array.from(this.data.keys());
  }

  /**
   * Get all the known periods, sorted naturally (e.g. aggregates are interleaved).
   */
  public getPeriods(): Period[] {
    return Array.from(
      new Set(
        Array.from(this.data.values()).flatMap((periods) =>
          Array.from(periods.keys()),
        ),
      ),
    )
      .map(periodFromKey)
      .sort(periodSorter);
  }

  /**
   * Indicates whether or not a period is an aggregate period.
   */
  public isAggregate(period: Period): boolean {
    if (isQuarter(period)) {
      return this.configuration.aggregates?.quarter ?? false;
    }
    if (isYear(period)) {
      return this.configuration.aggregates?.year ?? false;
    }
    return false;
  }

  /**
   * Update the table with the given values, recompute and return all the updated values.
   */
  public update(...values: MetricValue<ExtractMetricsNames<TConfiguration>>[]) {
    const updatedValues: UpdatedValues<TConfiguration> = [];
    for (const value of values) {
      this.setValue(value.metric, value.period, value.value, updatedValues);
    }
    this.recompute(updatedValues);

    return updatedValues;
  }

  /**
   * Deep clone the table.
   * This is implemented like that as a workaround around the lack of structuredClone in Decimal
   * https://github.com/MikeMcl/decimal.js/issues/224
   */
  public deepClone() {
    const initialData = Array.from(this.data.entries()).flatMap(
      ([metric, periodWithValue]) =>
        Array.from(periodWithValue.entries()).map(([period, value]) => ({
          metric,
          period: periodFromKey(period),
          value,
        })),
    );
    return new MetricsTable(this.configuration, initialData);
  }

  private recompute(
    updatedValues: UpdatedValues<TConfiguration>,
  ): UpdatedMetricValue<ExtractMetricsNames<TConfiguration>>[] {
    const years = new Set<number>();
    for (const period of this.getPeriods().filter(
      (p) => !this.isAggregate(p),
    )) {
      years.add(period.year);
      for (const metric of this.configuration.metrics) {
        if (metric.compute) {
          const oldValue = this.getValue(metric.name, period);
          const newValue = metric.compute(this, period, oldValue);
          this.setValue(metric.name, period, newValue, updatedValues);
        }
      }
    }
    if (this.configuration.aggregates?.quarter) {
      for (const year of years) {
        for (const quarter of [1, 2, 3, 4]) {
          const period = { quarter, year };
          const months = getMonthsForQuarter(period);
          this.computeAggregate(period, months, updatedValues);
        }
      }
    }
    if (this.configuration.aggregates?.year) {
      for (const year of years) {
        const period = { year };
        const months = getMonthsForYear(period);
        this.computeAggregate(period, months, updatedValues);
      }
    }
    return updatedValues;
  }

  private setValue(
    metric: string,
    period: Period,
    newValue: Decimal | undefined,
    updatedValues: UpdatedValues<TConfiguration>,
  ) {
    if (this.data.get(metric) === undefined) {
      throw new Error(`Unknown metric: ${metric}`);
    }

    const oldValue = this.getValue(metric, period);

    if (!oldValue || !newValue?.eq(oldValue)) {
      if (newValue) {
        this.data.get(metric)?.set(periodKey(period), newValue);
      } else {
        this.data.get(metric)?.delete(periodKey(period));
      }
      updatedValues.push({ metric, period, value: newValue, oldValue });
    }
  }

  private computeAggregate(
    period: Period,
    includedPeriods: Period[],
    updatedValues: UpdatedValues<TConfiguration> = [],
  ) {
    for (const metric of this.configuration.metrics) {
      if (!metric.aggregate) continue;
      const oldValue = this.getValue(metric.name, period);
      let newValue;
      switch (metric.aggregate) {
        case "first":
          newValue = this.getValue(metric.name, includedPeriods[0]);
          break;
        case "last":
          newValue = this.getValue(metric.name, includedPeriods.at(-1)!);
          break;
        case "average":
          newValue = average(
            ...includedPeriods.map(
              (p) => this.getValue(metric.name, p) ?? new Decimal(0),
            ),
          );
          break;
        case "sum":
          newValue = Decimal.sum(
            ...includedPeriods.map(
              (p) => this.getValue(metric.name, p) ?? new Decimal(0),
            ),
          );
          break;
        default:
          newValue = metric.aggregate(this, includedPeriods, period, oldValue);
          break;
      }
      this.setValue(metric.name, period, newValue, updatedValues);
    }
  }
}

export interface UpdatedMetricValue<TMetrics extends string>
  extends MetricValue<TMetrics> {
  oldValue: Decimal | undefined;
}

export type UpdatedValues<TConfiguration extends MetricsTableConfiguration> =
  UpdatedMetricValue<ExtractMetricsNames<TConfiguration>>[];
