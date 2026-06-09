# Observability & AI Investigation Guidelines

This document outlines the strict conventions and procedures for instrumenting the application and for the AI agent to conduct investigations. 

## 1. Conventions

### Log Format & Required Fields
* **Format**: All logs MUST be in structured JSON format. No plain text logging.
* **Required Fields**:
    * `timestamp`: ISO 8601 formatted datetime.
    * `level`: `info`, `warn`, or `error`.
    * `service`: The name of the component (e.g., `checkout_service`, `payment_gateway`).
    * `action`: The specific user action (e.g., `view_catalog`, `add_to_cart`, `process_payment`).
    * `session_id` or `user_id`: To trace a user's journey across requests.
    * `message`: Human-readable description.
    * `latency_ms` (Optional but recommended): Time taken for the operation.

### Metric Naming Conventions
* Follow the Prometheus naming conventions: `<namespace>_<subsystem>_<name>_<unit>`.
* **Namespace**: Always use `ecommerce`.
* **Counters**: Must end with `_total` (e.g., `ecommerce_cart_add_errors_total`).
* **Histograms**: Must end with `_seconds` or `_milliseconds` (e.g., `ecommerce_payment_duration_seconds`).

### Dashboard Layout Rules
* **Top Row**: High-level system health (Global Error Rate, Global P95 Latency).
* **Middle Rows**: User Journey panels ordered sequentially (Browse -> Cart -> Checkout -> Payment).
* **Panel Type**: Use Time Series for latency/duration, and Stat/Bar Gauge for error counts.

### Error-Surfacing Rules
* Any HTTP 5xx response MUST trigger an increment in the respective error metric AND emit an `error` level log with a stack trace.
* Client errors (HTTP 4xx) should be logged as `warn` and tracked separately from server errors.

---

## 2. Reusable Procedures

### How to Add a Metric in this Codebase
1.  Define the metric (Counter/Histogram) in a central `metrics.js` file using `prom-client`.
2.  Import the metric into the relevant route handler.
3.  Call `.inc()` for counters or `.observe()` for histograms immediately after the operation completes or fails.

### How to Emit a Searchable Log
1.  Use a JSON logging library (e.g., `winston` or `pino`).
2.  Do not concatenate strings. Pass context objects directly: `logger.error({ action: 'process_payment', error: err.message, session_id: req.session.id })`.

### How to Add a Grafana Panel via Provisioned JSON
1.  Locate the provisioned dashboard JSON file in the Grafana configuration directory.
2.  Append a new panel object to the `panels` array.
3.  Ensure the `targets` array contains a valid `expr` (PromQL query) matching the metric naming conventions.

---

## 3. The Investigation Triage Loop (For the AI Agent)

When asked to investigate an issue, the AI MUST follow this multi-step loop. Do not stop after a single query.

* **Step 1: Symptom (Identify)** -> Parse the user's natural language question to identify the timeframe and the potential failing component (e.g., "checkout is slow").
* **Step 2: Metric (Query)** -> Use `query_prometheus` to fetch the P95 latency and error rates for the suspected component during the specified timeframe. Use the PromQL pattern: `histogram_quantile(0.95, sum(rate(metric_name_bucket[5m])) by (le))`.
* **Step 3: Log (Search)** -> If the metric shows a spike in latency or errors, use `search_logs` to query Elasticsearch for logs matching the exact component and timeframe. Look for specific `error` levels or high `latency_ms` values.
* **Step 4: Hypothesis (Reasoning)** -> Combine the metric trend and the specific log messages to form a hypothesis (e.g., "The metric shows payment latency spiked to 1.2s, and the logs show 'Timeout waiting for payment provider'.").
* **Step 5: Confirm (Validate)** -> Make a follow-up query to confirm the hypothesis. For example, check if internal database latency is flat to rule out internal issues.
* **Final Output**: Present the final insight, clearly distinguishing between internal application faults and external dependencies.