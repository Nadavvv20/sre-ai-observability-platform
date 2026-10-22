import fetch from 'node-fetch';
import { scrubSensitiveData } from './guardrails.js';

const PROM_HOST = process.env.PROMETHEUS_URL || 'http://localhost:9090';
const ES_HOST = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
const BACKEND_HOST = process.env.BACKEND_URL || 'http://localhost:4000';
const ES_INDEX = 'ecommerce-logs';

/**
 * 1. GET SYSTEM OVERVIEW:
 * High-efficiency SRE snapshot gathering all golden signals, service health,
 * HTTP traffic breakdown, latencies, DB pool status, and recent error logs in ONE call.
 */
export async function getSystemOverview() {
    const overview = {
        timestamp: new Date().toISOString(),
        overall_status: 'UNKNOWN',
        services: {},
        http_traffic: {},
        latencies: {},
        database: {},
        recent_errors: [],
        alerts: []
    };

    try {
        // Run all telemetry checks in parallel for maximum speed
        const [backendHealth, promTargets, promRequests, promDbPool, promLatencies, esErrors] = await Promise.allSettled([
            // 1. Backend /healthz (tests DB connectivity)
            fetch(`${BACKEND_HOST}/healthz`, { timeout: 3000 }).then(r => r.json().then(data => ({ status: r.status, data }))).catch(e => ({ status: 0, error: e.message })),

            // 2. Prometheus Target Health
            fetch(`${PROM_HOST}/api/v1/targets`, { timeout: 3000 }).then(r => r.json()).catch(e => ({ error: e.message })),

            // 3. HTTP Request counts & status codes
            fetch(`${PROM_HOST}/api/v1/query?query=${encodeURIComponent('ecommerce_http_requests_total')}`, { timeout: 3000 }).then(r => r.json()).catch(e => ({ error: e.message })),

            // 4. DB connection pool
            fetch(`${PROM_HOST}/api/v1/query?query=${encodeURIComponent('ecommerce_db_connection_pool_active')}`, { timeout: 3000 }).then(r => r.json()).catch(e => ({ error: e.message })),

            // 5. Latencies (p95)
            fetch(`${PROM_HOST}/api/v1/query?query=${encodeURIComponent('histogram_quantile(0.95, sum(rate(ecommerce_catalog_request_duration_seconds_bucket[5m])) by (le))')}`, { timeout: 3000 }).then(r => r.json()).catch(e => ({ error: e.message })),

            // 6. Elasticsearch recent error & warning logs (last 1 hour)
            searchLogsInternal({ status_code: '4xx,5xx', time_range: '1h', limit: 8 })
        ]);

        // --- Process Backend Health ---
        if (backendHealth.status === 'fulfilled') {
            const bh = backendHealth.value;
            if (bh.status === 200 && bh.data?.ok) {
                overview.services.backend = { status: 'UP', http_status: 200, db_connected: true };
            } else {
                overview.services.backend = {
                    status: 'DEGRADED',
                    http_status: bh.status,
                    db_connected: false,
                    error: bh.data?.error || bh.error || 'Healthcheck failed'
                };
                overview.alerts.push(`[CRITICAL] Backend /healthz returned ${bh.status}: Database ${bh.data?.database || 'disconnected'} (${bh.data?.error || ''})`);
            }
        } else {
            overview.services.backend = { status: 'DOWN', error: backendHealth.reason?.message };
            overview.alerts.push(`[CRITICAL] Backend unreachable on port 4000`);
        }

        // --- Process Prometheus Targets ---
        if (promTargets.status === 'fulfilled' && promTargets.value?.data?.activeTargets) {
            overview.services.prometheus_targets = promTargets.value.data.activeTargets.map(t => ({
                job: t.labels?.job,
                instance: t.labels?.instance,
                health: t.health,
                lastScrape: t.lastScrape,
                lastError: t.lastError || null
            }));
            const downTargets = overview.services.prometheus_targets.filter(t => t.health !== 'up');
            if (downTargets.length > 0) {
                overview.alerts.push(`[CRITICAL] Down scrape target: ${downTargets.map(t => t.job).join(', ')}`);
            }
        }

        // --- Process HTTP Requests & Status Codes ---
        if (promRequests.status === 'fulfilled' && promRequests.value?.data?.result) {
            const metrics = promRequests.value.data.result;
            let totalReqs = 0;
            let total2xx = 0;
            let total4xx = 0;
            let total5xx = 0;
            const byRoute = {};
            const byCode = {};

            for (const item of metrics) {
                const route = item.metric.route || 'unknown';
                const code = parseInt(item.metric.status_code || '0', 10);
                const count = parseFloat(item.value?.[1] || '0');

                // Don't count /metrics internal scrapes in app traffic
                if (route === '/metrics') continue;

                totalReqs += count;
                byCode[code] = (byCode[code] || 0) + count;

                if (code >= 200 && code < 300) total2xx += count;
                else if (code >= 400 && code < 500) total4xx += count;
                else if (code >= 500) total5xx += count;

                const routeKey = `${item.metric.method || 'GET'} ${route}`;
                if (!byRoute[routeKey]) byRoute[routeKey] = { total: 0, codes: {} };
                byRoute[routeKey].total += count;
                byRoute[routeKey].codes[code] = (byRoute[routeKey].codes[code] || 0) + count;
            }

            const errorRate = totalReqs > 0 ? ((total5xx / totalReqs) * 100).toFixed(1) : 0;
            overview.http_traffic = {
                total_app_requests: totalReqs,
                status_codes: byCode,
                summary: {
                    success_2xx: total2xx,
                    client_errors_4xx: total4xx,
                    server_errors_5xx: total5xx,
                    server_error_rate_pct: `${errorRate}%`
                },
                routes: byRoute
            };

            if (total5xx > 0) {
                overview.alerts.push(`[CRITICAL] Found ${total5xx} server-side HTTP 5xx errors (${errorRate}% error rate)`);
            }
            if (total4xx > 5) {
                overview.alerts.push(`[WARNING] Elevated 4xx client errors (${total4xx} requests)`);
            }
        }

        // --- Process DB Connection Pool ---
        if (promDbPool.status === 'fulfilled' && promDbPool.value?.data?.result?.[0]) {
            const activeConn = parseFloat(promDbPool.value.data.result[0].value?.[1] || '0');
            overview.database.active_connections = activeConn;
            overview.database.max_pool_limit = 10;
            if (activeConn >= 8) {
                overview.alerts.push(`[WARNING] Database connection pool near saturation: ${activeConn}/10 active connections`);
            }
        }

        // --- Process Latencies ---
        if (promLatencies.status === 'fulfilled' && promLatencies.value?.data?.result?.[0]) {
            const p95 = parseFloat(promLatencies.value.data.result[0].value?.[1] || '0');
            overview.latencies.catalog_p95_seconds = p95 ? p95.toFixed(3) : 'no recent traffic';
            if (p95 > 0.5) {
                overview.alerts.push(`[WARNING] Catalog p95 latency high: ${(p95 * 1000).toFixed(0)}ms (threshold: 500ms)`);
            }
        }

        // --- Process Recent Logs from Elasticsearch ---
        if (esErrors.status === 'fulfilled' && esErrors.value) {
            overview.recent_errors = esErrors.value;
            if (esErrors.value.length > 0) {
                const latestErr = esErrors.value[0];
                overview.alerts.push(`[LOG ERROR] ${latestErr.service || 'app'}: ${latestErr.message || latestErr.error || 'error logged'}`);
            }
        }

        // --- Compute Overall Status Badge ---
        const hasCritical = overview.alerts.some(a => a.startsWith('[CRITICAL]'));
        const hasWarning = overview.alerts.some(a => a.startsWith('[WARNING]'));

        if (hasCritical) {
            overview.overall_status = 'CRITICAL OUTAGE';
        } else if (hasWarning) {
            overview.overall_status = 'DEGRADED';
        } else {
            overview.overall_status = 'HEALTHY';
        }

        return JSON.stringify(overview, null, 2);

    } catch (err) {
        return JSON.stringify({
            overall_status: 'CRITICAL',
            error: `Failed to compile system overview: ${err.message}`
        });
    }
}

/**
 * Internal helper for Elasticsearch querying with rich SRE field extraction
 */
async function searchLogsInternal({ query, status_code, time_range = '1h', limit = 10 }) {
    try {
        const mustClauses = [];
        const shouldClauses = [];

        // Time range filter
        const gteTime = time_range === '15m' ? 'now-15m'
            : time_range === '6h' ? 'now-6h'
            : time_range === '24h' ? 'now-24h'
            : 'now-1h';

        mustClauses.push({
            range: { '@timestamp': { gte: gteTime, lte: 'now' } }
        });

        // Status code filter
        if (status_code) {
            if (status_code.includes('5xx') || status_code === '500') {
                shouldClauses.push({ range: { 'fields.status_code': { gte: 500, lte: 599 } } });
                shouldClauses.push({ term: { 'severity.keyword': 'error' } });
            }
            if (status_code.includes('4xx')) {
                shouldClauses.push({ range: { 'fields.status_code': { gte: 400, lte: 499 } } });
                shouldClauses.push({ term: { 'severity.keyword': 'warn' } });
            }
            const numericCode = parseInt(status_code, 10);
            if (!isNaN(numericCode) && numericCode >= 100 && numericCode < 600) {
                shouldClauses.push({ term: { 'fields.status_code': numericCode } });
            }
        }

        // Query text matching across relevant SRE fields
        if (query && query.trim()) {
            const q = query.trim();
            if (q.includes('500') || q.toLowerCase().includes('error') || q.toLowerCase().includes('fail')) {
                shouldClauses.push(
                    { range: { 'fields.status_code': { gte: 500, lte: 599 } } },
                    { term: { 'severity.keyword': 'error' } }
                );
            }
            shouldClauses.push(
                { match: { message: q } },
                { match: { 'fields.path': q } },
                { match: { 'fields.service': q } },
                { match: { 'fields.action': q } },
                { match: { 'fields.error': q } }
            );
        }

        const boolQuery = { must: mustClauses };
        if (shouldClauses.length > 0) {
            boolQuery.should = shouldClauses;
            boolQuery.minimum_should_match = 1;
        }

        const res = await fetch(`${ES_HOST}/${ES_INDEX}/_search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                size: limit,
                sort: [{ '@timestamp': { order: 'desc' } }],
                query: { bool: boolQuery }
            })
        });

        if (!res.ok) return [];

        const data = await res.json();
        const hits = data.hits?.hits || [];

        return hits.map(h => {
            const s = h._source || {};
            const f = s.fields || {};
            // Extract concise stack trace (first 2-3 lines only) to save tokens
            let stackSnippet = undefined;
            if (f.stack) {
                stackSnippet = f.stack.split('\n').slice(0, 3).map(l => l.trim()).join(' -> ');
            }

            const rawMsg = s.message ? scrubSensitiveData(String(s.message)) : undefined;
            const rawErr = f.error ? scrubSensitiveData(String(f.error)) : undefined;
            const rawStack = stackSnippet ? scrubSensitiveData(String(stackSnippet)) : undefined;

            return {
                timestamp: f.timestamp || s['@timestamp'],
                severity: s.severity,
                status_code: f.status_code,
                method: f.method,
                path: f.path,
                service: f.service,
                action: f.action,
                latency_ms: f.latency_ms,
                message: rawMsg,
                error: rawErr,
                stack: rawStack
            };
        });

    } catch (e) {
        return [];
    }
}

/**
 * 2. SEARCH LOGS TOOL:
 * SRE tool to search Elasticsearch logs with flexible filtering
 */
export async function searchLogs({ query = '', status_code = '', time_range = '1h', limit = 10 } = {}) {
    try {
        let logs = await searchLogsInternal({ query, status_code, time_range, limit });

        // If no logs found in requested time_range, search last 24h as a fallback
        if (logs.length === 0 && time_range !== '24h') {
            logs = await searchLogsInternal({ query, status_code, time_range: '24h', limit: 5 });
            if (logs.length > 0) {
                return JSON.stringify({
                    notice: `No logs found in last ${time_range}. Showing ${logs.length} matching events from the last 24 hours:`,
                    logs
                }, null, 2);
            }
        }

        if (logs.length === 0) {
            return `No log entries found matching criteria (query: "${query || 'any'}", status_code: "${status_code || 'any'}", time: "${time_range}").`;
        }

        return JSON.stringify(logs, null, 2);
    } catch (e) {
        return `Error searching logs: ${e.message}`;
    }
}

/**
 * 3. QUERY PROMETHEUS TOOL:
 * PromQL tool with intelligent explanation for rates vs counters
 */
export async function queryPrometheus(query) {
    try {
        const res = await fetch(`${PROM_HOST}/api/v1/query?query=${encodeURIComponent(query)}`);
        if (!res.ok) {
            return `Prometheus HTTP Error ${res.status}: ${res.statusText}`;
        }
        const data = await res.json();
        const results = data.data?.result || [];

        if (results.length === 0) {
            // Check if it's a rate query and explain
            if (query.includes('rate(') || query.includes('increase(')) {
                return `Query "${query}" returned 0 results. This means no metric updates occurred in the scrape window (idle traffic). Check the raw counter to see historical totals.`;
            }
            return `No metrics found for query: "${query}".`;
        }

        // Simplify metric outputs to conserve tokens
        const simplified = results.map(r => {
            const labels = { ...r.metric };
            delete labels.__name__;
            return {
                metric: r.metric.__name__ || query,
                labels: Object.keys(labels).length > 0 ? labels : undefined,
                value: r.value?.[1]
            };
        });

        return JSON.stringify(simplified, null, 2);
    } catch (e) {
        return `Error querying Prometheus: ${e.message}`;
    }
}

/**
 * Tool definitions exposed to OpenAI / Groq function calling
 */
export const toolsDefinitions = [
    {
        type: "function",
        function: {
            name: "get_system_overview",
            description: "CRITICAL FIRST STEP: Get a complete SRE golden-signals overview in ONE call: service up/down status, HTTP status codes (2xx, 4xx, 5xx), total errors, p95 latencies, DB pool status, and recent error logs with stack traces. Always call this first when investigating system status, outages, or performance.",
            parameters: {
                type: "object",
                properties: {},
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "search_logs",
            description: "Search application logs in Elasticsearch. Filter by text (e.g. 'mysql', 'declined'), HTTP status code ('500', '5xx', '4xx', '409'), or time range ('15m', '1h', '24h').",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Keyword, endpoint, or error pattern" },
                    status_code: { type: "string", description: "Filter by HTTP status code, e.g. '500', '5xx', '4xx', '409'" },
                    time_range: { type: "string", description: "Time window: '15m', '1h', '6h', '24h' (default: '1h')" },
                    limit: { type: "number", description: "Max logs to return (default: 10)" }
                },
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "query_prometheus",
            description: "Execute a PromQL query for specific metrics, latencies, or rates (e.g. 'ecommerce_http_requests_total', 'ecommerce_db_connection_pool_active').",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "PromQL expression" }
                },
                required: ["query"]
            }
        }
    }
];
