import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { pool } from './db.js';

// Create a Registry to register the metrics
export const register = new Registry();

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({ register });

// 1. ecommerce_catalog_request_duration_seconds
// p95 and p99 latency of the /catalog browse endpoint
export const catalogRequestDuration = new Histogram({
  name: 'ecommerce_catalog_request_duration_seconds',
  help: 'p95 and p99 latency of the /catalog browse endpoint',
  labelNames: ['route'],
  buckets: [0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 1, 2, 5],
  registers: [register],
});

// 2. ecommerce_http_requests_total
// Throughput measured in requests per second (RPS), segmented by HTTP status codes
export const httpRequestsTotal = new Counter({
  name: 'ecommerce_http_requests_total',
  help: 'Total HTTP requests by status code',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// 3. ecommerce_cart_add_errors_total
// Count of server-side HTTP 5xx errors on the /cart/add endpoint
export const cartAddErrorsTotal = new Counter({
  name: 'ecommerce_cart_add_errors_total',
  help: 'Count of server-side HTTP 5xx errors on the /cart/add endpoint',
  labelNames: ['error_type'],
  registers: [register],
});

// 4. ecommerce_checkout_duration_seconds
// Total time taken to process the checkout step, excluding external payment processing
export const checkoutDuration = new Histogram({
  name: 'ecommerce_checkout_duration_seconds',
  help: 'Total time taken to process the checkout step',
  labelNames: ['status'],
  buckets: [0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 1, 2],
  registers: [register],
});

// 5. ecommerce_payment_duration_seconds
// p95 latency of the external payment provider API call
export const paymentDuration = new Histogram({
  name: 'ecommerce_payment_duration_seconds',
  help: 'p95 latency of the external payment provider API call',
  labelNames: ['status'],
  buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 1, 2, 5],
  registers: [register],
});

// 6. ecommerce_db_connection_pool_active
// The number of active connections to the database
export const dbConnectionPoolActive = new Gauge({
  name: 'ecommerce_db_connection_pool_active',
  help: 'The number of active connections to the database',
  registers: [register],
});

// Update DB connection pool metric periodically
setInterval(() => {
  try {
    // @ts-ignore - accessing internal pool stats
    const poolStats = pool.pool;
    if (poolStats && typeof poolStats._allConnections !== 'undefined') {
      // @ts-ignore
      dbConnectionPoolActive.set(poolStats._allConnections.length);
    }
  } catch (err) {
    // Silently fail if we can't get pool stats
  }
}, 5000);
