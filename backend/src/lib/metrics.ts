type RouteMetric = {
  count: number;
  errors: number;
  totalMs: number;
};

const startedAt = Date.now();
const routeMetrics = new Map<string, RouteMetric>();

export const recordRequestMetric = (route: string, statusCode: number, durationMs: number) => {
  const metric = routeMetrics.get(route) ?? { count: 0, errors: 0, totalMs: 0 };
  metric.count += 1;
  metric.totalMs += durationMs;
  if (statusCode >= 500) metric.errors += 1;
  routeMetrics.set(route, metric);
};

export const getMetricsSnapshot = () => ({
  service: "cipherlend-api",
  uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
  routes: Array.from(routeMetrics.entries()).map(([route, metric]) => ({
    route,
    count: metric.count,
    errors: metric.errors,
    averageMs: metric.count === 0 ? 0 : Math.round(metric.totalMs / metric.count),
  })),
});
