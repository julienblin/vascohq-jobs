import { Period, periodKey } from "../periods";
import {
  ExtractMetricsNames,
  MetricValue,
  MetricsTable,
  MetricsTableConfiguration,
  UpdatedValues,
} from "./metrics-table";

/**
 * A metrics table that allows to subscribe to changes.
 */
export class SubscribableMetricsTable<
  TConfiguration extends MetricsTableConfiguration,
> extends MetricsTable<TConfiguration> {
  private subscriptions:
    | Map<ExtractMetricsNames<TConfiguration>, Map<string, Set<() => unknown>>>
    | undefined;

  /**
   * Subscribe to metrics update
   * @param metric the updated metric
   * @param period for the updated period
   * @param callback the callback to be called when the metric is updated for the period
   * @returns an unsubscribe function
   */
  public subscribe(
    metric: ExtractMetricsNames<TConfiguration>,
    period: Period,
    callback: () => void,
  ) {
    const key = periodKey(period);
    if (!this.subscriptions) {
      this.subscriptions = new Map(
        this.configuration.metrics.map((metric) => [metric.name, new Map()]),
      );
    }
    if (!this.subscriptions.has(metric)) {
      throw new Error(`Unknown metric: ${metric}`);
    }
    const existing = this.subscriptions.get(metric)!.get(key);
    if (!existing) {
      this.subscriptions.get(metric)!.set(key, new Set([callback]));
    } else {
      existing.add(callback);
    }

    return () => {
      existing?.delete(callback);
    };
  }

  public update(
    ...values: MetricValue<ExtractMetricsNames<TConfiguration>>[]
  ): UpdatedValues<TConfiguration> {
    const updated = super.update(...values);
    for (const { metric, period } of updated) {
      const key = periodKey(period);
      const subscriptions = this.subscriptions?.get(metric)?.get(key);
      for (const subscription of subscriptions || []) {
        subscription();
      }
    }
    return updated;
  }
}
