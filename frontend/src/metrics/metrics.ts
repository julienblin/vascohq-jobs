/**
 * This modules contains individual functions to compute metrics.
 */

import Decimal from "decimal.js";

export function endingMRR({
  beginningMRR,
  newBusinessMRR,
  churnedMRR,
  expansionMRR,
}: {
  beginningMRR: Decimal;
  newBusinessMRR: Decimal;
  churnedMRR: Decimal;
  expansionMRR: Decimal;
}): Decimal {
  return Decimal.sum(beginningMRR, newBusinessMRR, expansionMRR, churnedMRR);
}

export function churnedMRR({
  beginningMRR,
  churnRate,
}: {
  beginningMRR: Decimal;
  churnRate: Decimal;
}): Decimal {
  return beginningMRR.mul(churnRate).negated();
}

export function expansionMRR({
  beginningMRR,
  expansionRate,
}: {
  beginningMRR: Decimal;
  expansionRate: Decimal;
}): Decimal {
  return beginningMRR.mul(expansionRate);
}

export function average(...values: Decimal[]): Decimal {
  if (values?.length === 0) return new Decimal(0);
  return Decimal.sum(...values).dividedBy(values.length);
}
