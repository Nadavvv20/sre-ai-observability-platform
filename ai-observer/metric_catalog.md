# Metric and Log Catalog

This catalog defines the opinionated metrics and log fields required for the AI agent to reason about the system's health. The AI service must read this file to understand the context of the numbers it fetches from Prometheus.

Metrics tell the monitoring and observability teams what is happening in their systems (the known knowns), while logs provide detailed records of events that help understand the *why* behind those events.

## Metrics

### 1. `ecommerce_catalog_request_duration_seconds`
* **Description**: p95 and p99 latency of the `/catalog` browse endpoint.
* **Why it matters**: We measure the 95th (p95) and 99th (p99) percentiles because they shine a light on outliers, frustrating "long tail" latencies, and worst-case scenarios that basic averages miss. The catalog is the entry point; if it's slow, users bounce before creating a cart.
* **What normal looks like**: p95 latency stays under 200ms.
* **What a change implies**: A spike above 500ms usually indicates database query degradation or cache invalidation. The AI should immediately check DB response logs.

### 2. `ecommerce_http_requests_total`
* **Description**: Throughput measured in requests per second (RPS), segmented by HTTP status codes.
* **Why it matters**: Throughput helps answer how many requests the system is handling. It is an essential application metric for monitoring application performance and availability.
* **What normal looks like**: Steady RPS correlating with time-of-day traffic.
* **What a change implies**: A sudden drop in RPS indicates a network bottleneck or an upstream routing failure. The AI should verify if external traffic is reaching the load balancer.

### 3. `ecommerce_cart_add_errors_total`
* **Description**: Count of server-side HTTP 5xx errors (e.g., "500 Internal Server Error") on the `/cart/add` endpoint.
* **Why it matters**: A failure here means a direct loss of intent to purchase. We specifically track 5xx errors for server failures, distinguishing them from client-side 4xx issues.
* **What normal looks like**: Flat zero.
* **What a change implies**: A sudden increase implies session state failures. The AI must search Elasticsearch logs for `service: cart` and `level: error` to find the root cause behind the metric.

### 4. `ecommerce_checkout_duration_seconds`
* **Description**: Total time taken to process the checkout step, *excluding* external payment processing.
* **Why it matters**: Isolates our internal processing speed from external dependencies.
* **What normal looks like**: p95 stays under 300ms.
* **What a change implies**: If this spikes but payment latency is flat, the issue is strictly internal (e.g., slow order creation in the DB). 

### 5. `ecommerce_payment_duration_seconds`
* **Description**: p95 latency of the external payment provider API call.
* **Why it matters**: Payments rely on third parties. External dependency metrics like response speed and error rates are necessary for setting accurate alerting thresholds.
* **What normal looks like**: p95 around 200ms - 300ms.
* **What a change implies**: If payment latency p95 climbs above ~400ms while checkout latency stays flat, the payment provider is degrading independently of our own service. 

### 6. `ecommerce_db_connection_pool_active` (Saturation)
* **Description**: The number of active connections to the database.
* **Why it matters**: Approaching connection limits can degrade service quality or cause downtime, making it a critical saturation metric to monitor.
* **What normal looks like**: Well below the maximum pool size.
* **What a change implies**: If the active connection count hits the maximum limit, queries will queue up, spiking p95 latencies across the board. The AI should look for unclosed DB connections or a sudden surge in complex queries.

---

## Log Fields

Logs act as detailed records of transactions and errors, providing the crucial context for troubleshooting.

### 1. `session_id`
* **Description**: Unique UUID assigned to the user's current session.
* **Why it matters**: Allows the AI to trace a single user's journey. This mimics the behavior of distributed traces, following user requests across services to identify bottlenecks.
* **What normal looks like**: Present and valid in 100% of user action logs.
* **What a change implies**: If `session_id` suddenly becomes `null` during checkout, it implies the session store is dropping data.

### 2. `action`
* **Description**: A strictly typed string representing the user's intent (e.g., `view_catalog`, `add_to_cart`, `process_payment`).
* **Why it matters**: Allows aggregating errors by business logic rather than just HTTP routes, helping understand the business impact of technical issues.
* **What normal looks like**: Every application log has an `action` context.
* **What a change implies**: Spikes in errors tied to a specific action tell the AI exactly which phase of the business logic is failing.