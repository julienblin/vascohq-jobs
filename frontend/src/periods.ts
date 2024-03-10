/**
 * This module exposes features related to time periods.
 */

export type Period = Month | Quarter | Year;

export interface Month {
  month: number;
  year: number;
}

export interface Quarter {
  quarter: number;
  year: number;
}

export interface Year {
  year: number;
}

export function isMonth(period: Period): period is Month {
  return "month" in period;
}

export function isQuarter(period: Period): period is Quarter {
  return "quarter" in period;
}

export function isYear(period: Period): period is Year {
  return !isMonth(period) && !isQuarter(period);
}

/**
 * Select and execute the proper action based on the period type.
 */
export function periodSelector<T>(
  period: Period,
  actions: {
    year: (year: Year) => T;
    quarter: (quarter: Quarter) => T;
    month: (month: Month) => T;
  },
): T {
  if (isYear(period)) {
    return actions.year(period);
  }
  if (isQuarter(period)) {
    return actions.quarter(period);
  }
  return actions.month(period);
}

/**
 * Return an unique key for a period.
 * Implementation is inspired by the ISO 8601 EDTF.
 * https://en.wikipedia.org/wiki/ISO_8601#EDTF.
 * Years are "2023"
 * Months are "2023-01"
 * Quarters use the extended Level 2 syntax: "2023-33" for Q1 and "2023-36" for Q4.
 */
export function periodKey(period: Period) {
  if (isMonth(period)) {
    return `${period.year}-${period.month.toString().padStart(2, "0")}`;
  }
  if (isQuarter(period)) {
    return `${period.year}-${period.quarter + 32}`;
  }
  return `${period.year}`;
}

/**
 * Inverse of periodKey - create a period from a period key.
 */
export function periodFromKey(key: string): Period {
  if (key.length === 4) {
    return { year: parseInt(key, 10) };
  }

  const [year, month] = key.split("-").map((x) => parseInt(x, 10));
  if (month <= 12) {
    return { month, year };
  }
  return { quarter: month - 32, year };
}

/**
 * Sorts period by interleaving month, quarter and year in the right order.
 * Months < Quarter for the months < Year
 */
export function periodSorter(a: Period, b: Period) {
  if (a.year === b.year) {
    if (isMonth(a)) {
      if (isMonth(b)) {
        return a.month - b.month;
      }
      if (isQuarter(b)) {
        return a.month - b.quarter * 3;
      }
      return -1;
    }
    if (isQuarter(a)) {
      if (isMonth(b)) {
        return a.quarter * 3 - b.month;
      }
      if (isQuarter(b)) {
        return a.quarter - b.quarter;
      }
      return 1;
    }
  }
  return a.year - b.year;
}

export function getMonthsForQuarter(period: Quarter): Month[] {
  return Array.from({ length: 3 }, (_, i) => ({
    month: 3 * period.quarter - 2 + i,
    year: period.year,
  }));
}

export function getMonthsForYear(year: Year): Month[] {
  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    year: year.year,
  }));
}
