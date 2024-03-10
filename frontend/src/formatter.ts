/**
 * This module contains functions to format numbers and periods.
 */

import Decimal from "decimal.js";
import { Period, periodSelector } from "./periods";

/**
 * Take a month number and year and return a formatted string with current locale (e.g. Jan 23).
 */
export function formatPeriod(period: Period | undefined): string {
  if (!period) {
    return "";
  }

  return periodSelector(period, {
    year: (year) => year.year.toString(),
    quarter: (quarter) => `Q${quarter.quarter} ${quarter.year}`,
    month: (month) =>
      new Intl.DateTimeFormat(undefined, {
        month: "short",
        year: "2-digit",
      }).format(new Date(month.year, month.month - 1)),
  });
}

/**
 * Take a number and return a formatted string with current locale (e.g. $1,234.56).
 */
export function money(value: number | Decimal | undefined) {
  if (value == undefined) {
    return "";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value instanceof Decimal ? value.toNumber() : value);
}

/**
 * Format a number as a percentage with current locale (e.g. 12%).
 */
export function percent(value: number | Decimal | undefined) {
  if (value == undefined) {
    return "";
  }

  return new Intl.NumberFormat(undefined, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value instanceof Decimal ? value.toNumber() : value);
}
