import { useSyncExternalStore } from "react";
import { Period } from "../periods";
import { MetricsTableConfiguration } from "./metrics-table";
import { SubscribableMetricsTable } from "./subscribable-metrics-table";

/**
 * In combination with a mutable SubscribableMetricsTable, returns the value of a metric for a given period
 * and subscribe to changes to the value of the metric.
 *
 * This will rerender the component when the value of the metric changes, without a change to the table instance
 * itself.
 * @param table the SubscribableMetricsTable instance to subscribe to
 * @param metric the metric to get the value of
 * @param period the period to get the value for
 * @returns the metric value.
 */
export function useSubscribableMetricsTableValue<
  TConfiguration extends MetricsTableConfiguration,
>(
  table: SubscribableMetricsTable<TConfiguration>,
  metric: string,
  period: Period,
) {
  return useSyncExternalStore(
    (callback) => table.subscribe(metric, period, callback),
    () => table.getValue(metric, period),
  );
}
