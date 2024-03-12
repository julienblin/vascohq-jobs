import clsx from "clsx";
import Decimal from "decimal.js";
import { useRef, useState } from "react";
import { formatPeriod } from "../formatter";
import { Period, periodKey } from "../periods";
import {
  cellCurrentlyEdited,
  editableCell,
  summaryCell,
  tableOverflowContainer,
  tableTargets,
} from "./MetricsTableRenderer.module.css";
import {
  ExtractMetricsNames,
  MetricsTableConfiguration,
} from "./metrics-table";
import { SubscribableMetricsTable } from "./subscribable-metrics-table";
import { useSubscribableMetricsTableValue } from "./use-subscribable-metrics-table-value";

export type RowsConfiguration<
  TConfiguration extends MetricsTableConfiguration,
> = Partial<
  Record<
    ExtractMetricsNames<TConfiguration>,
    {
      header: string;
      formatter: (value: Decimal | undefined) => string;
      editable?: boolean;
    }
  >
>;

export interface MetricsTableRendererProps<
  TConfiguration extends MetricsTableConfiguration,
> {
  table: SubscribableMetricsTable<TConfiguration>;

  /**
   * The actual metrics rows to render, in order.
   */
  rows: RowsConfiguration<TConfiguration>;
}

/**
 * Renders a metrics table, following the row configuration.
 */
export function MetricsTableRenderer<
  TConfiguration extends MetricsTableConfiguration,
>({ table, rows }: MetricsTableRendererProps<TConfiguration>) {
  return (
    <div className={tableOverflowContainer}>
      <table className={tableTargets}>
        <caption>
          <div>Targets</div>
        </caption>
        <thead>
          <tr>
            <th></th>
            {table.getPeriods().map((period) => (
              <th
                key={periodKey(period)}
                className={clsx({
                  [summaryCell]: table.isAggregate(period),
                })}
              >
                {formatPeriod(period)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.keys(rows).map((metric) => (
            <MetricsTableRow
              key={metric}
              table={table}
              rows={rows}
              metric={metric}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MetricsTableRow<
  TConfiguration extends MetricsTableConfiguration,
>({
  table,
  metric,
  rows,
}: {
  table: SubscribableMetricsTable<TConfiguration>;
  metric: ExtractMetricsNames<TConfiguration>;
  rows: RowsConfiguration<TConfiguration>;
}) {
  return (
    <tr>
      <th>{rows[metric]!.header}</th>
      {table.getPeriods().map((period) => (
        <MetricsTableCell
          key={periodKey(period)}
          table={table}
          metric={metric}
          rows={rows}
          period={period}
        />
      ))}
    </tr>
  );
}

export function MetricsTableCell<
  TConfiguration extends MetricsTableConfiguration,
>({
  table,
  metric,
  rows,
  period,
}: {
  table: SubscribableMetricsTable<TConfiguration>;
  metric: ExtractMetricsNames<TConfiguration>;
  rows: RowsConfiguration<TConfiguration>;
  period: Period;
}) {
  const [inEdition, setInEdition] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const value = useSubscribableMetricsTableValue(table, metric, period);
  const formattedValue = rows[metric]!.formatter(value);

  return (
    <td
      className={clsx({
        [editableCell]:
          Boolean(rows[metric]!.editable) && !table.isAggregate(period),
        [summaryCell]: table.isAggregate(period),
        [cellCurrentlyEdited]: inEdition,
      })}
      onClick={() => {
        if (!inEdition) {
          setInEdition(true);
          inputRef.current!.value = value?.toNumber().toString() ?? "";
          inputRef.current!.focus();
        }
      }}
    >
      {!inEdition && formattedValue}
      {Boolean(rows[metric]!.editable) && (
        <input
          type="number"
          ref={inputRef}
          onChange={(evt) => {
            evt.stopPropagation();
            table.update({
              metric,
              period,
              value: new Decimal(evt.target.value),
            });
          }}
          onKeyDown={(evt) => {
            evt.stopPropagation();
            if (evt.code === "Enter") {
              setInEdition(false);
            }
          }}
          onBlur={(evt) => {
            evt.stopPropagation();
            setInEdition(false);
          }}
        />
      )}
    </td>
  );
}
