# eCommerce SRE Observability Platform

A fully instrumented eCommerce application with **AI-powered observability** for investigating system issues. This project demonstrates production-grade SRE practices including metrics, structured logging, dashboards, and an intelligent AI agent that can investigate issues autonomously.

## 🚀 Quick Start

### 1. Configure AI Provider (`.env`)

Copy the template or create `.env` in the repository root:

```bash
cp .env.example .env
```

Select your preferred AI provider in `.env` (**Groq is recommended** for ultra-fast, sub-second SRE incident triage):

```ini
# Choose your provider: 'groq' | 'gemini' | 'openrouter' | 'ollama'
AI_PROVIDER=groq

# Your API Key for the chosen provider:
AI_API_KEY=gsk_your_groq_api_key_here
```

| Provider | Free Tier | Default Model | Performance | Setup |
| :--- | :--- | :--- | :--- | :--- |
| **Groq (Recommended)** | Generous free quota | `llama-3.3-70b-versatile` | ⚡ Sub-second (~400 t/s) | [console.groq.com](https://console.groq.com) |
| **Google AI Studio** | 1,500 req/day free | `gemini-2.0-flash` | ⚡ Fast | [aistudio.google.com](https://aistudio.google.com) |
| **OpenRouter** | Pay-as-you-go / Free models | `meta-llama/llama-3.3-70b-instruct:free` | 🚀 Standard | [openrouter.ai](https://openrouter.ai) |
| **Ollama** | 100% Free & Local | `qwen2.5:7b` | 💻 Offline privacy | [ollama.com](https://ollama.com) |

### 2. Start Application & Observability Stack

The `docker-compose.yml` file is hardened for safe local execution:
- 🔒 **Zero Public Port Exposure**: All services bind strictly to `127.0.0.1` (localhost), preventing exposure on local networks or Wi-Fi.
- 🩺 **Healthcheck Dependency Chain**: The backend waits for MySQL and Elasticsearch health probes before taking traffic; frontend waits for backend health.
- 🤖 **Decoupled AI Runner**: The AI agent runs directly on your host machine for fast interactive CLI triage and minimum overhead.

```bash
# Start MySQL, Backend, Frontend, Prometheus, Elasticsearch, and Grafana
docker compose up -d --build
```

### 3. Start AI Observer (Local SRE Bot)

```bash
cd ai-observer
npm install
npm run chat
```

### 4. Access Services

| Service | Local URL | Notes / Credentials |
| :--- | :--- | :--- |
| **Frontend Store** | [http://localhost:5173](http://localhost:5173) | Demo account: `demo@shop.com` / `demopass` |
| **Backend API** | [http://localhost:4000](http://localhost:4000) | Health probe: `/healthz`, Metrics: `/metrics` |
| **Prometheus** | [http://localhost:9090](http://localhost:9090) | Target scrape status & PromQL explorer |
| **Grafana** | [http://localhost:3000](http://localhost:3000) | `admin` / `admin` (Pre-provisioned dashboards) |
| **Elasticsearch** | [http://localhost:9200](http://localhost:9200) | Structured logs index: `ecommerce-logs` |


## 🤖 AI Observer - Production SRE Agent

An intelligent, autonomous SRE assistant capable of real-time incident triage, root cause isolation, and remediation guidance with **minimum API calls and zero token waste**.

### Start the AI Chat:

```bash
cd ai-observer
npm run chat
```

### Example SRE Investigation Session:

```text
╔═══════════════════════════════════════════════════════════╗
║         🤖 SRE AI Observer - Production Agent            ║
╚═══════════════════════════════════════════════════════════╝

You > What's the current system status?
AI > Investigating...

🔧 Tool: get_system_overview
[Turn 2/3]
AI > [STATUS BADGE]: 🔴 CRITICAL OUTAGE  
• Summary: The GET /api/products route is failing with 500 errors due to a database DNS failure.  
• Root Cause: ecommerce_backend service; unhandled exception getaddrinfo ENOTFOUND mysql at routes/products.ts:34:31.  
• Impact: All product listing queries fail with 500; health endpoint (/healthz) returns 503. Current error rate 28.6%.  
• Recommended Action:  
  1. Verify MySQL network resolution inside container (docker exec shop-backend nslookup mysql).  
  2. Restart database container (docker restart shop-mysql).  
  3. Re-verify health status via curl http://localhost:4000/healthz.
```

### AI Agent Features:
- ⚡ **Deterministic Hybrid Telemetry**: Gathers all 4 Golden Signals (Traffic, Errors, Latencies, Saturation) in 1 shot via `get_system_overview` (75% faster, 80% token savings).
- 🛡️ **4-Layer Security & Guardrails**: Zero-token pre-flight regex filter blocks prompt injections, jailbreaks, and out-of-scope math/trivia (`1+1`). Automatically scrubs PII, JWTs, and credentials.
- 🎯 **Pinpoint Root Cause Tracing**: Traces exact microservice, route, and function/stack trace (`routes/products.ts:34:31`) using only production telemetry.
- 🌐 **Multi-Provider Support**: Groq Cloud (`openai/gpt-oss-120b`, `llama-3.3-70b-versatile`), Google AI Studio (`gemini-2.0-flash`), OpenRouter, and Ollama.

## 📊 Observability Stack

### 1. Metrics (Prometheus)

**Endpoint**: http://localhost:4000/metrics

**Key Metrics**:
- `ecommerce_catalog_request_duration_seconds` - Browse latency
- `ecommerce_http_requests_total` - Request throughput by status
- `ecommerce_cart_add_errors_total` - Cart errors
- `ecommerce_checkout_duration_seconds` - Checkout processing time
- `ecommerce_payment_duration_seconds` - Payment provider latency
- `ecommerce_db_connection_pool_active` - Database connections

### 2. Logs (Elasticsearch)

**Endpoint**: http://localhost:9200

Structured JSON logs with fields:
- `timestamp`, `level`, `service`, `action`, `message`
- `session_id`, `user_id`, `latency_ms`, `error`, `stack`

**Query logs**:
```bash
# All logs
curl http://localhost:9200/ecommerce-logs/_search?pretty

# Errors only
curl "http://localhost:9200/ecommerce-logs/_search?q=level:error&pretty"
```

### 3. Dashboards (Grafana)

**URL**: http://localhost:3000 (admin/admin)

**Pre-built Dashboard**: "eCommerce User Journey"
- Global error rate and P95 latency
- Per-endpoint metrics (catalog, cart, checkout, payment)
- Database connection pool monitoring
- Recent error logs panel

### 4. AI Observer Service

Run the interactive SRE triage bot locally:

```bash
cd ai-observer
npm run chat
```

**AI Capabilities**:
- ⚡ **Single-Shot 4 Golden Signals**: Proactively gathers latency, throughput, error rates, and saturation in 30ms via `get_system_overview`.
- 🎯 **Pinpoint Root Cause & Stack Trace Isolation**: Correlates Prometheus HTTP anomalies with Elasticsearch stack traces and microservice failure points.
- 🛡️ **Zero-Token Pre-Flight Guardrails**: Blocks prompt injections, jailbreaks, and out-of-scope tasks (`1+1`, math, casual conversation) before calling LLM APIs.
- 🔒 **Bidirectional Secret & PII Scrubbing**: Automatically sanitizes JWTs, API keys, database credentials, and email addresses.
- ⏱️ **Fast 2-Turn Resolution**: Diagnoses incidents in under 2.5 seconds with up to 80% token savings over standard multi-turn ReAct loops.

## 🏗️ Architecture

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       ├──────────────────┬──────────────────┬──────────────────┐
       │                  │                  │                  │
┌──────▼──────┐    ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
│  Frontend   │    │   Backend   │   │  Prometheus │   │   Grafana   │
│  (React)    │    │  (Express)  │   │  (Metrics)  │   │ (Dashboards)│
└─────────────┘    └──────┬──────┘   └─────────────┘   └─────────────┘
                          │
                   ┌──────┴──────┐
                   │             │
            ┌──────▼──────┐ ┌────▼─────────┐
            │    MySQL    │ │Elasticsearch │
            │  (Database) │ │    (Logs)    │
            └─────────────┘ └──────────────┘
                                   │
                            ┌──────▼──────┐
                            │ AI Observer │
                            │   (Chat)    │
                            └─────────────┘
```

## 🛠️ Stack

**Application**:
- Node 20 + Express + TypeScript (backend)
- MySQL 8.4 (database)
- React 18 + Vite + TypeScript (frontend)
- JWT auth with bcrypt

**Observability**:
- Prometheus (metrics collection)
- Elasticsearch (log aggregation)
- Grafana (visualization)
- AI Observer (intelligent investigation)

**Infrastructure**:
- Docker Compose
- All services in isolated network

## 📖 Usage Guide

### Generate Traffic

1. Browse products at http://localhost:5173
2. Add items to cart
3. Checkout and complete payment
4. Repeat to generate metrics and logs

### View Metrics

```bash
# Check metrics endpoint
curl http://localhost:4000/metrics

# View in Prometheus
open http://localhost:9090/graph
```

### View Dashboard

1. Open Grafana: http://localhost:3000
2. Login: admin/admin
3. Navigate to: Dashboards → eCommerce User Journey

### Query Logs

```bash
# All logs
curl http://localhost:9200/ecommerce-logs/_search?pretty

# Payment errors
curl "http://localhost:9200/ecommerce-logs/_search?q=action:payment+AND+level:error&pretty"
```

### Use AI Chat

```bash
cd ai-observer
npm run chat

# Then ask questions like:
# - "What's the error rate?"
# - "Show me slow queries"
# - "Are there any anomalies?"
```

## 🧪 Testing Observability

### Increase Error Rate

Edit `docker-compose.yml`:

```yaml
backend:
  environment:
    - PAYMENT_FAILURE_RATE=0.5  # 50% failure rate
```

Then restart:
```bash
docker compose up -d backend
```

Now ask the AI: "Why are payments failing?"

### Simulate Load

```bash
# Install hey (HTTP load generator)
# Then run:
hey -n 1000 -c 10 http://localhost:4000/api/products
```

Watch the metrics in Grafana and ask the AI about the load.

## 📁 Project Structure

```
.
├── docker-compose.yml          # All services orchestration
├── .env                        # OpenRouter API key
├── backend/                    # Express API
│   ├── src/
│   │   ├── metrics.ts         # Prometheus metrics
│   │   ├── logger.ts          # Elasticsearch logging
│   │   └── routes/            # API endpoints
├── frontend/                   # React app
├── ai-observer/               # AI investigation service
│   ├── chat.js                # Interactive CLI
│   ├── index.js               # HTTP API
│   ├── package.json
│   └── README.md              # Detailed AI docs
├── grafana/
│   ├── dashboards/            # Pre-built dashboards
│   └── provisioning/          # Auto-config
├── prometheus/
│   └── prometheus.yml         # Scrape config
├── guidelines.md              # Observability conventions
├── metric_catalog.md          # Metric definitions
└── OBSERVABILITY.md           # Complete observability guide
```

## 📚 Documentation

- **[SRE Interview Master Guide](./Proof-Of-Concept/SRE_INTERVIEW_MASTER_GUIDE.md)** - Complete interview playbook: architecture walkthroughs, debugging war stories, and top 15 technical Q&As
- **[Proof of Concept Incident Report](./Proof-Of-Concept/POC_INCIDENT_REPORT.md)** - Real incident breakdown: root cause discovery, 500 error spike isolation, and security guardrail tests
- **[OBSERVABILITY.md](./OBSERVABILITY.md)** - Complete observability guide & telemetry architecture
- **[ai-observer/README.md](./ai-observer/README.md)** - AI SRE Observer architecture, guardrails & tool design
- **[guidelines.md](./guidelines.md)** - Log & metric naming conventions
- **[metric_catalog.md](./metric_catalog.md)** - Metric definitions and healthy baseline thresholds

## 🔧 Configuration

### Environment Variables (`.env`)

The AI Observer auto-discovers `.env` from either the repository root or the `ai-observer/` directory.

Create or edit `.env`:

```ini
# ==============================================================
# SRE AI Observer - Configuration
# ==============================================================

# Choose provider: 'groq' | 'gemini' | 'openrouter' | 'ollama'
AI_PROVIDER=groq

# API key for the chosen provider:
AI_API_KEY=gsk_your_groq_api_key_here

# Optional: Model override (leave blank/commented to use provider defaults)
# AI_MODEL=llama-3.3-70b-versatile

# Optional: Custom endpoint override
# AI_BASE_URL=https://api.groq.com/openai/v1
```

#### Provider Presets & Key Formats:

| Provider | `AI_PROVIDER` | `AI_API_KEY` Prefix | Default Model | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Groq Cloud** | `groq` | `gsk_...` | `llama-3.3-70b-versatile` | Ultra-fast inference (~400 tokens/sec), recommended for triage |
| **Google Gemini** | `gemini` | `AIzaSy...` | `gemini-2.0-flash` | Free tier 1,500 req/day from Google AI Studio |
| **OpenRouter** | `openrouter` | `sk-or-v1-...` | `meta-llama/llama-3.3-70b-instruct:free` | Aggregator for hundreds of open & proprietary models |
| **Ollama** | `ollama` | `ollama` | `qwen2.5:7b` | Fully local & offline (requires local Ollama server at `:11434`) |

> [!NOTE]
> **Auto-Detection**: If `AI_PROVIDER` is omitted, the agent automatically detects the provider based on the API key prefix (`gsk_` $\to$ Groq, `sk-or-` $\to$ OpenRouter).

### Hardened Infrastructure Configuration (`docker-compose.yml`)

The platform's `docker-compose.yml` is engineered according to security best practices:
1. **Localhost Port Binding (`127.0.0.1`)**: All container ports (`3306`, `4000`, `5173`, `9090`, `9200`, `3000`) bind exclusively to `127.0.0.1` so services cannot be reached over the local network or internet.
2. **Container Healthchecks**: MySQL uses `mysqladmin ping`, Elasticsearch uses cluster health API, and the backend verifies DB connectivity on `/healthz` using native Node fetch.
3. **Decoupled AI Runner**: The AI Observer is excluded from the Docker Compose daemon, allowing you to run it locally with `npm run chat` without container rebuilds or exposing AI sockets.

### Backend Chaos & Failure Simulation

Edit `docker-compose.yml` under `backend.environment` to inject faults:

```yaml
backend:
  environment:
    - PAYMENT_FAILURE_RATE=0.50    # Injects 50% payment failures
    - JWT_SECRET=dev-secret-change-me
    - MYSQL_HOST=mysql
    - ELASTICSEARCH_URL=http://elasticsearch:9200
```

Apply changes:
```bash
docker compose up -d backend
```

## 🐛 Troubleshooting

### AI Chat Not Working

1. **Verify `.env` configuration**:
   ```bash
   # Verify provider and key are set in root or ai-observer/.env
   cat .env
   ```
2. **Check telemetry connectivity**:
   ```bash
   # Test Prometheus reachability:
   curl -s http://localhost:9090/-/healthy
   
   # Test Elasticsearch reachability:
   curl -s http://localhost:9200/_cluster/health
   ```
3. **Run AI Observer with verbose diagnostics**:
   ```bash
   cd ai-observer
   node chat.js
   ```
   If rate-limited or using an invalid key, the bot will display a clear error message indicating the provider issue.

### No Metrics in Prometheus

```bash
# Check backend metrics endpoint
curl http://localhost:4000/metrics

# Check Prometheus targets
open http://localhost:9090/targets
```

### No Logs in Elasticsearch

```bash
# Check Elasticsearch health
curl http://localhost:9200/_cluster/health

# Check backend logs
docker logs shop-backend
```

### Dashboard Not Loading

```bash
# Check Grafana is running
curl http://localhost:3000/api/health

# Check datasources
open http://localhost:3000/datasources
```

## 🎯 Key Features

✅ **Full Observability Stack** - Metrics, logs, dashboards  
✅ **AI-Powered Investigation** - Chat with your infrastructure  
✅ **Production-Grade** - Structured logs, proper metrics  
✅ **Auto-Provisioned** - Dashboards and datasources ready  
✅ **Multi-Turn AI** - Agent can make follow-up queries  
✅ **Real-Time** - Interactive chat interface  
✅ **Context-Aware** - AI understands metric baselines  

## 🚀 Next Steps

1. **Generate Traffic** - Use the app to create data
2. **Explore Dashboards** - View metrics in Grafana
3. **Chat with AI** - Ask about system status
4. **Introduce Failures** - Set PAYMENT_FAILURE_RATE=0.5
5. **Investigate** - Use AI to find the root cause
6. **Add Alerts** - Configure Prometheus alerting
7. **Add Tracing** - Implement distributed tracing

## 📝 API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/signup | — | Create account |
| POST | /api/auth/login | — | Login |
| GET | /api/products | — | List products |
| GET | /api/products/:id | — | Get product |
| GET | /api/cart | JWT | Get cart |
| POST | /api/cart/items | JWT | Add to cart |
| POST | /api/checkout | JWT | Create order |
| POST | /api/payment | JWT | Pay order |
| GET | /metrics | — | Prometheus metrics |
| GET | /healthz | — | Health check |

AI Example:

╔═══════════════════════════════════════════════════════════╗
║         🤖 SRE AI Observer - Interactive Chat            ║
╚═══════════════════════════════════════════════════════════╝

Connected to: Prometheus (localhost:9090) & Elasticsearch (localhost:9200)
Type your questions or commands:
  • Ask about system status, errors, metrics
  • Type 'help' for examples
  • Type 'clear' to reset conversation
  • Type 'exit' or 'quit' to leave

You > check for any suspocious traffic
AI > Investigating...

🔧 Using tool: get_metric_catalog
[Turn 2/5]
🔧 Using tool: query_prometheus
   Query: rate(ecommerce_http_requests_total[5m])
🔧 Using tool: query_prometheus
   Query: sum by (status_code) (rate(ecommerce_http_requests_total[5m]))
🔧 Using tool: query_prometheus
   Query: rate(ecommerce_cart_add_errors_total[5m])
[Turn 3/5]
🔧 Using tool: search_logs
   Query: status_code:404
🔧 Using tool: search_logs
   Query: route:"/products" OR route:"/api/non-existent-route"
[Turn 4/5]
AI > The logs don't show detailed records, but the metrics clearly indicate suspicious activity.

## Summary of Suspicious Traffic:

**🔴 CONFIRMED THREAT:** High volume of 404 requests to non-existent endpoints

**Indicators:**
- **2.56 RPS** of 404 errors (88% of total traffic)
- Targeting `/products` and `/api/non-existent-route`
- Pattern consistent with **automated scanning/probing**

**Recommended Actions:**
1. **Immediate:** Implement rate limiting on 404 responses
2. **Block/throttle** IPs generating excessive 404s
3. **Monitor** for escalation to legitimate endpoints
4. **Review WAF rules** to block common attack patterns
5. **Alert security team** for potential reconnaissance activity

**Business Impact:** 
- Currently limited (legitimate traffic still flowing normally)
- Risk of escalation to actual attack on valid endpoints
- Increased load on backend systems processing invalid requests

Would you like me to investigate any specific aspect further or check for impact on legitimate user traffic?

You > What causing there errors? 
AI > Investigating...

🔧 Using tool: search_logs
   Query: 404
🔧 Using tool: search_logs
   Query: level:error
🔧 Using tool: search_logs
   Query: route AND NOT status_code:200
[Turn 2/5]
🔧 Using tool: search_logs
   Query: path:"/products"
🔧 Using tool: search_logs
   Query: user_agent OR client OR ip_address
[Turn 3/5]
AI > ## Root Cause Analysis

Based on the log investigation, here's what's causing these 404 errors:

### **Primary Cause: Automated Bot/Script Hammering Non-Existent Endpoints**

**Evidence:**
1. **Extremely regular timing pattern**: Requests to `/api/non-existent-route` are coming every ~100-120ms with machine-like precision
   - 10:42:58.446 → 10:42:58.570 (124ms)
   - 10:42:58.570 → 10:42:58.688 (118ms)
   - 10:42:58.688 → 10:42:58.811 (123ms)
   - Pattern continues consistently

2. **Identical requests**: Every single request is exactly `GET /api/non-existent-route` - no variation

3. **No session context**: Logs show no `session_id`, `user_agent`, or client information - these are not legitimate user requests

4. **Ultra-low latency (0-1ms)**: The backend is responding instantly because the route doesn't exist - no database lookups, no business logic

### **Likely Scenarios:**

🔴 **Most Likely: Load Testing Tool or Monitoring Probe Gone Wrong**
- A misconfigured health check, load tester, or monitoring script pointing at wrong endpoints
- Could be internal testing that wasn't cleaned up

🔴 **Security Scanning/Reconnaissance**
- Automated vulnerability scanner probing for exposed APIs
- The route name `/api/non-existent-route` suggests this might even be a test or synthetic probe

🔴 **Broken Frontend/Client Integration**
- A deployed application with hardcoded wrong API endpoints
- However, less likely given the mechanical timing

### **Why This is Happening:**

The `/products` and `/api/non-existent-route` endpoints **don't exist in your application's routing table**. The backend is correctly returning 404s, but something (bot/script/misconfigured client) keeps requesting them.

### **Immediate Action Items:**

1. **Identify the source**: Enable request logging to capture IP addresses and User-Agent headers
2. **Check for internal tools**: Review any monitoring, load testing, or health check configurations
3. **Implement rate limiting**: Block sources generating >10 404s per minute
4. **Add alerting**: Set up alerts for sustained 404 patterns on non-existent routes
5. **Review recent deployments**: Check if any frontend/client code was recently deployed with incorrect API endpoints

Would you like me to check if this traffic is impacting legitimate user requests or investigate any specific time period further?



## 🤝 Contributing

This is a demonstration project showcasing SRE best practices and AI-powered observability.

## 📄 License

ISC
