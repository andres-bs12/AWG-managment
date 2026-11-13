import type { BuyMetric } from '../api/contracts'

/** Preserve the anonymous step and field dimensions accepted by the backend. */
export function buyMetricForHttp(metric: BuyMetric): BuyMetric {
  return metric
}
