const MAX_SAMPLES_PER_ROUTE = 240;
const MAX_WINDOW_MS = 60 * 60 * 1000; // keep up to 60 minutes
const routes = new Map();

function normalizePath(path) {
  if (!path) return "/";
  const [rawPath] = String(path).split("?");
  const parts = rawPath.split("/").map((segment) => {
    if (!segment) return "";
    if (/^[0-9a-f]{24}$/i.test(segment)) return ":id"; // Mongo ObjectId
    if (/^[0-9]+$/.test(segment)) return ":id";
    if (/^[0-9a-f-]{32,}$/i.test(segment)) return ":id";
    return segment;
  });
  return parts.join("/") || "/";
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

function trimOld(samples, now) {
  const cutoff = now - MAX_WINDOW_MS;
  while (samples.length > 0 && samples[0].t < cutoff) samples.shift();
}

export function recordRequestTiming({ method, path, status, ms }) {
  const now = Date.now();
  const normalized = normalizePath(path);
  const key = `${String(method || "GET").toUpperCase()} ${normalized}`;

  let route = routes.get(key);
  if (!route) {
    route = {
      key,
      method: String(method || "GET").toUpperCase(),
      path: normalized,
      count: 0,
      errorCount: 0,
      samples: [],
      lastStatus: 0,
      lastMs: 0,
      lastAt: 0,
    };
    routes.set(key, route);
  }

  route.count += 1;
  if (Number(status) >= 500) route.errorCount += 1;
  route.lastStatus = Number(status) || 0;
  route.lastMs = Number(ms) || 0;
  route.lastAt = now;

  route.samples.push({ t: now, ms: Number(ms) || 0, status: Number(status) || 0 });
  trimOld(route.samples, now);
  if (route.samples.length > MAX_SAMPLES_PER_ROUTE) {
    route.samples.splice(0, route.samples.length - MAX_SAMPLES_PER_ROUTE);
  }
}

export function getLatencySnapshot({ top = 15, windowMs = 15 * 60 * 1000 } = {}) {
  const now = Date.now();
  const cutoff = now - Math.min(Math.max(Number(windowMs) || 0, 60 * 1000), MAX_WINDOW_MS);

  const routeStats = [];
  for (const route of routes.values()) {
    trimOld(route.samples, now);
    const within = route.samples.filter((s) => s.t >= cutoff);
    if (!within.length) continue;

    const latencies = within.map((s) => s.ms);
    const errors = within.filter((s) => s.status >= 500).length;
    const slowOver1s = within.filter((s) => s.ms >= 1000).length;
    const totalMs = latencies.reduce((sum, value) => sum + value, 0);

    routeStats.push({
      key: route.key,
      method: route.method,
      path: route.path,
      count: within.length,
      errors,
      errorRate: Number(((errors / within.length) * 100).toFixed(2)),
      p50: Number(percentile(latencies, 50).toFixed(1)),
      p95: Number(percentile(latencies, 95).toFixed(1)),
      p99: Number(percentile(latencies, 99).toFixed(1)),
      avg: Number((totalMs / within.length).toFixed(1)),
      max: Number(Math.max(...latencies).toFixed(1)),
      slowOver1s,
      lastStatus: route.lastStatus,
      lastMs: Number(route.lastMs.toFixed(1)),
      lastAt: route.lastAt,
    });
  }

  const totalRequests = routeStats.reduce((sum, r) => sum + r.count, 0);
  const totalErrors = routeStats.reduce((sum, r) => sum + r.errors, 0);
  const allLatencies = routeStats.flatMap((r) => {
    const route = routes.get(r.key);
    return (route?.samples || []).filter((s) => s.t >= cutoff).map((s) => s.ms);
  });

  routeStats.sort((a, b) => b.count - a.count);

  return {
    generatedAt: now,
    windowMs: cutoff ? now - cutoff : windowMs,
    summary: {
      totalRequests,
      totalErrors,
      errorRate: totalRequests ? Number(((totalErrors / totalRequests) * 100).toFixed(2)) : 0,
      p50: Number(percentile(allLatencies, 50).toFixed(1)),
      p95: Number(percentile(allLatencies, 95).toFixed(1)),
      p99: Number(percentile(allLatencies, 99).toFixed(1)),
      slowOver1s: allLatencies.filter((ms) => ms >= 1000).length,
    },
    routes: routeStats.slice(0, Math.max(1, Number(top) || 15)),
  };
}
