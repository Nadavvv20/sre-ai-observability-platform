# Observability Implementation Guide

## ✅ Implementation Complete

This application has been fully instrumented with metrics, structured logging, dashboards, and an AI-powered observability service following the blueprint in `initial.md`.

## 🚀 Quick Start

```bash
# 1. Configure .env with your AI provider (Groq, Gemini, OpenRouter, or Ollama)
cp .env.example .env

# 2. Start application & observability stack safely (localhost bound)
docker compose up -d --build

# 3. Start AI Observer locally
cd ai-observer && npm install && npm run chat
```

**Access Points:**
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:4000
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)
- **Elasticsearch**: http://localhost:9200
- **AI Observer**: Local CLI (`npm run chat`)

## 📊 Observability Stack

### 1. Metrics (Prometheus)
The backend exposes `/metrics` endpoint with 6 key metrics defined in `metric_catalog.md`:

- `ecommerce_catalog_request_duration_seconds` - Browse latency (p95/p99)
- `ecommerce_http_requests_total` - Request throughput by status code
- `ecommerce_cart_add_errors_total` - Cart errors
- `ecommerce_checkout_duration_seconds` - Checkout processing time
- `ecommerce_payment_duration_seconds` - Payment provider latency
- `ecommerce_db_connection_pool_active` - Database connections

**View metrics**: http://localhost:9090/graph

### 2. Logs (Elasticsearch)
Structured JSON logs with required fields per `guidelines.md`:
- `timestamp`, `level`, `service`, `action`, `message`
- `session_id`, `user_id`, `latency_ms`, `error`, `stack`

All logs are shipped to Elasticsearch for querying and analysis.

**Query logs**: http://localhost:9200/ecommerce-logs/_search

### 3. Dashboards (Grafana)
Auto-provisioned dashboard: **eCommerce User Journey**

Panels include:
- Global error rate and P95 latency
- Per-endpoint metrics (catalog, cart, checkout, payment)
- Database connection pool monitoring
- Recent error logs panel

**View dashboard**: http://localhost:3000 → Dashboards → eCommerce User Journey

### 4. AI Observability Service 🤖

**Two Ways to Use:**

#### A. Interactive CLI Chat (Recommended) 💬
```bash
cd ai-observer
npm run chat
```

Interactive chat interface with:
- Real-time conversation
- Colored output showing tool usage
- Commands: `help`, `clear`, `exit`
- Persistent conversation history

**Example Session:**
```
You > What's the current error rate?
🔧 Using tool: query_prometheus
AI > The current error rate is 2.3%, within normal range...

You > Show me payment errors
🔧 Using tool: search_logs
AI > Found 3 payment errors in the last hour...
```

#### B. HTTP API
**Endpoint**: `POST http://localhost:5000/investigate`

```bash
curl -X POST http://localhost:5000/investigate \
  -H "Content-Type: application/json" \
  -d '{"question": "anything unusual in the last 15 min?"}'
```

**Capabilities:**
- Multi-turn LLM agent with function calling
- 3 tools available:
  - `query_prometheus(promql_query)` - Query metrics
  - `search_logs(elasticsearch_query)` - Search logs
  - `get_metric_catalog()` - Load metric definitions
- Follows SRE triage loop: Symptom → Metric → Logs → Hypothesis → Confirm
- Powered by Claude 3.5 Sonnet via OpenRouter
- Max 5 turns per investigation

**Example Questions:**
- "Is the payment service healthy?"
- "Why is checkout slow?"
- "Show me recent cart errors"
- "What's the current error rate?"
- "Are there any anomalies in the last hour?"

## 📁 New Files Added

```
ai-observer/
├── index.js              # AI agent with multi-turn loop
├── package.json          # Dependencies: express, openai, node-fetch
├── Dockerfile            # Node.js container
└── metric_catalog.md     # Metric definitions for AI context

backend/src/
├── metrics.ts            # Prometheus metrics definitions
└── logger.ts             # Winston + Elasticsearch logging

grafana/
├── dashboards/
│   └── user-journey.json # Pre-built dashboard
└── provisioning/
    ├── datasources/      # Auto-config Prometheus + Elasticsearch
    └── dashboards/       # Auto-load dashboards

prometheus/
└── prometheus.yml        # Scrape config for backend

.gitignore                # Ignore node_modules and .env
.env                      # OpenRouter API key (not committed)
```

## 🧪 Testing the Setup

### 1. Generate Traffic
- Browse products at http://localhost:5173
- Add items to cart
- Checkout and complete payment
- Try multiple times to generate data

### 2. View Metrics
```bash
# Check if metrics endpoint is working
curl http://localhost:4000/metrics

# View in Prometheus UI
open http://localhost:9090/graph
```

### 3. View Dashboard
```bash
# Open Grafana (admin/admin)
open http://localhost:3000

# Navigate to: Dashboards → eCommerce User Journey
```

### 4. Query Logs
```bash
# Search all logs
curl http://localhost:9200/ecommerce-logs/_search?pretty

# Search for errors
curl "http://localhost:9200/ecommerce-logs/_search?q=level:error&pretty"
```

### 5. Ask the AI
```bash
# System status
curl -X POST http://localhost:5000/investigate \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the current system status?"}'

# Check for errors
curl -X POST http://localhost:5000/investigate \
  -H "Content-Type: application/json" \
  -d '{"question": "Are there any errors in the payment service?"}'
```

## 🔧 Configuration

### Increase Payment Failures
To test error monitoring, increase the failure rate:

```yaml
# In docker-compose.yml, add to backend environment:
environment:
  - PAYMENT_FAILURE_RATE=0.5  # 50% failure rate
```

Then restart: `docker compose up -d backend`

### AI Service Configuration
The AI observer supports Groq, Gemini, OpenRouter, and Ollama. Configure `.env` in the root:

```ini
AI_PROVIDER=groq
AI_API_KEY=gsk_your_groq_api_key_here
```

## 📚 Documentation Files

- **`Proof-Of-Concept/POC_INCIDENT_REPORT.md`** - Real incident triage tests & guardrail validations
- **`guidelines.md`** - Log formatting, metric naming, dashboard conventions
- **`metric_catalog.md`** - Detailed metric definitions and normal baselines
- **`initial.md`** - Original implementation blueprint (4-step plan)
- **`OBSERVABILITY.md`** - This file (usage guide)

## 🎯 Implementation Status

✅ **Step 1**: Read guidelines and metric catalog  
✅ **Step 2**: Instrument application (metrics + logs)  
✅ **Step 3**: Provision observability stack (Prometheus, Elasticsearch, Grafana)  
✅ **Step 4**: Build hardened AI observability bot (deterministic Golden Signals, zero-token guardrails, PII redaction)

## 🐛 Troubleshooting

### AI Service Not Working
- Check `.env` file exists with valid `AI_API_KEY` and `AI_PROVIDER`
- Test local execution: `cd ai-observer && node chat.js`
- Verify Prometheus (`http://localhost:9090`) and Elasticsearch (`http://localhost:9200`) are accessible from the host

### No Metrics in Prometheus
- Verify backend is running: `curl http://localhost:4000/metrics`
- Check Prometheus targets: http://localhost:9090/targets
- Ensure backend service is healthy

### No Logs in Elasticsearch
- Check Elasticsearch health: `curl http://localhost:9200/_cluster/health`
- Verify backend has `ELASTICSEARCH_URL` env var set
- Check backend logs: `docker logs shop-backend`

### Dashboard Not Loading
- Verify Grafana is running: http://localhost:3000
- Check datasources: Configuration → Data Sources
- Verify dashboard provisioning: `docker logs shop-grafana`

## 🚀 Next Steps

1. **Generate realistic load** - Use a load testing tool to simulate traffic
2. **Introduce failures** - Set `PAYMENT_FAILURE_RATE=0.5` and observe
3. **Query the AI** - Ask it to investigate the increased error rate
4. **Create alerts** - Add Prometheus alerting rules
5. **Add tracing** - Implement distributed tracing with Jaeger/Tempo
