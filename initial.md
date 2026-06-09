# AI Observability Setup Prompt

You are an expert Site Reliability Engineer (SRE) who treats LLMs as a force multiplier. Your task is to transform a provided plain Node.js + React eCommerce app into a fully observable system, and build an AI-driven observability service to investigate it. 

Do not waste time polishing the app's UI or core business logic. Focus entirely on observability and the AI service.

Please execute the following steps in order:

## Step 1: Read the Blueprints
Before writing any code, you MUST read the following two files located in the project root:
1. `guidelines.md`: Contains conventions for log formatting, metric naming, dashboard layouts, and investigation procedures.
2. `metric_catalog.md`: Contains the exact opinionated metrics you need to expose, what normal looks like, and what a change implies.

Confirm you have read and understood these files before proceeding.

## Step 2: Instrument the Application
Modify the existing Node.js + Express backend to include:
*   **Metrics**: Expose a `/metrics` endpoint for Prometheus. Instrument the core user journey (browse -> cart -> checkout -> payment) exactly as defined in `metric_catalog.md`.
*   **Logs**: Implement structured JSON logging. Logs must be sent to Elasticsearch. Follow the required fields and formats defined in `guidelines.md`.

## Step 3: Provision the Observability Stack
Create or update the `docker-compose.yml` to include:
*   The instrumented Node.js backend and React frontend.
*   **Prometheus**: Configured to scrape the backend.
*   **Elasticsearch**: Configured to ingest the backend logs.
*   **Grafana**: Auto-provisioned with data sources (Prometheus, Elasticsearch) and a default dashboard monitoring the user journey.

## Step 4: Build the AI Observability Service
Create a standalone service running in the same `docker-compose.yml` network.
*   **Language/Tech**: Node.js or Python.
*   **Entrypoint**: Expose an HTTP endpoint or a CLI command that takes a natural-language question (e.g., "anything unusual in the last 15 min?").
*   **Capabilities**: The service MUST act as an LLM agent. It must use function calling / tools to query the live backend.
*   **Required Tools**: 
    1. `query_prometheus(promql_query)`
    2. `search_logs(elasticsearch_query)`
    3. `get_metric_catalog(metric_name)` (Loads context from `metric_catalog.md`).
*   **Execution**: The agent must run in a multi-turn loop. It must be able to query a metric, analyze the result, and decide to make a follow-up tool call (e.g., search logs for the specific failing endpoint) before returning a final written insight. Do NOT hardcode the investigation path.

Please begin with Step 1 and let me know when you are ready to proceed to Step 2.