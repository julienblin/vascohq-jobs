import Decimal from "decimal.js";
import { useMemo } from "react";
import FetchLoader from "../data-loading/FetchLoader";
import { useFetch } from "../data-loading/use-fetch";
import * as formatter from "../formatter";
import {
  MetricsTableRenderer,
  RowsConfiguration,
} from "../metrics-table/MetricsTableRenderer";
import {
  ExtractMetricsNames,
  MetricValue,
  MetricsTableConfiguration,
} from "../metrics-table/metrics-table";
import { SubscribableMetricsTable } from "../metrics-table/subscribable-metrics-table";
import {
  average,
  churnedMRR,
  endingMRR,
  expansionMRR,
} from "../metrics/metrics";
import { isMonth } from "../periods";

const OrganizationMetricsConfiguration = {
  metrics: [
    {
      name: "beginningMRR",
      compute: (table, period, currentValue) => {
        if (isMonth(period)) {
          return period.month === 1
            ? currentValue
            : table.getValue("endingMRR", {
                month: period.month - 1,
                year: period.year,
              });
        }
      },
      aggregate: "first",
    },
    {
      name: "churnRate",
      aggregate: (table, includedPeriods) => {
        const aggregateChurnedMRR = Decimal.sum(
          ...includedPeriods.map((x) =>
            Decimal.mul(
              table.getValue("beginningMRR", x) ?? new Decimal(0),
              table.getValue("churnRate", x) ?? new Decimal(0),
            ),
          ),
        );
        const aggregateAverageBeginningMRR = average(
          ...includedPeriods.map(
            (x) => table.getValue("beginningMRR", x) ?? new Decimal(0),
          ),
        );

        return aggregateChurnedMRR.div(aggregateAverageBeginningMRR);
      },
    },
    {
      name: "expansionRate",
      aggregate: (table, includedPeriods) => {
        const aggregateExpansionMRR = Decimal.sum(
          ...includedPeriods.map((x) =>
            Decimal.mul(
              table.getValue("beginningMRR", x) ?? new Decimal(0),
              table.getValue("expansionRate", x) ?? new Decimal(0),
            ),
          ),
        );

        const aggregateAverageBeginningMRR = average(
          ...includedPeriods.map(
            (x) => table.getValue("beginningMRR", x) ?? new Decimal(0),
          ),
        );

        return aggregateExpansionMRR.div(aggregateAverageBeginningMRR);
      },
    },
    {
      name: "newBusinessMRR",
      aggregate: "sum",
    },
    {
      name: "churnedMRR",
      compute: (table, period) => {
        const beginningMRR = table.getValue("beginningMRR", period);
        const churnRate = table.getValue("churnRate", period);
        if (beginningMRR && churnRate) {
          return churnedMRR({ beginningMRR, churnRate });
        }
      },
    },
    {
      name: "expansionMRR",
      compute: (table, period) => {
        const beginningMRR = table.getValue("beginningMRR", period);
        const expansionRate = table.getValue("expansionRate", period);
        if (beginningMRR && expansionRate) {
          return expansionMRR({ beginningMRR, expansionRate });
        }
      },
    },
    {
      name: "endingMRR",
      compute: (table, period) => {
        const beginningMRR = table.getValue("beginningMRR", period);
        const newBusinessMRR = table.getValue("newBusinessMRR", period);
        const churnedMRR = table.getValue("newBusinessMRR", period);
        const expansionMRR = table.getValue("expansionMRR", period);
        if (beginningMRR && newBusinessMRR && churnedMRR && expansionMRR) {
          return endingMRR({
            beginningMRR,
            newBusinessMRR,
            churnedMRR,
            expansionMRR,
          });
        }
      },
      aggregate: "last",
    },
  ],
  aggregates: {
    quarter: true,
    year: true,
  },
} as const satisfies MetricsTableConfiguration;

const OrganizationRowsConfiguration = {
  beginningMRR: {
    header: "Beginning MRR",
    formatter: formatter.money,
  },
  newBusinessMRR: {
    header: "New Business MRR",
    formatter: formatter.money,
    editable: true,
  },
  churnRate: {
    header: "Churn Rate",
    formatter: formatter.percent,
  },
  expansionRate: {
    header: "Expansion Rate",
    formatter: formatter.percent,
  },
  endingMRR: {
    header: "Ending MRR",
    formatter: formatter.money,
  },
} as const satisfies RowsConfiguration<typeof OrganizationMetricsConfiguration>;

export default function OrganizationTargetsPage() {
  const query = useFetch<ApiMRRTargets[]>("monthlyTargets.json");
  const table = useMemo(
    () =>
      new SubscribableMetricsTable(
        OrganizationMetricsConfiguration,
        convertApiMRRTargetsToMetricValues(query.data || []),
      ),
    [query.data],
  );

  return (
    <FetchLoader {...query}>
      <MetricsTableRenderer
        table={table}
        rows={OrganizationRowsConfiguration}
      />
    </FetchLoader>
  );
}

interface ApiMRRTargets {
  month: number;
  year: number;
  beginningMRR: number;
  newBusinessMRR: number;
  churnRate: number;
  expansionRate: number;
  expansionMRR: number;
  endingMRR: number;
}

function convertApiMRRTargetsToMetricValues(
  targets: ApiMRRTargets[],
): MetricValue<ExtractMetricsNames<typeof OrganizationMetricsConfiguration>>[] {
  return targets.flatMap((target) =>
    [
      "beginningMRR",
      "newBusinessMRR",
      "churnRate",
      "expansionRate",
      "endingMRR",
    ].flatMap((metric) => ({
      metric: metric as ExtractMetricsNames<
        typeof OrganizationMetricsConfiguration
      >,
      period: {
        year: target.year,
        month: target.month,
      },
      value: ["churnRate", "expansionRate"].includes(metric)
        ? // We fix the API to return percentages as decimals
          new Decimal(target[metric as keyof ApiMRRTargets] / 100)
        : new Decimal(target[metric as keyof ApiMRRTargets]),
    })),
  );
}
