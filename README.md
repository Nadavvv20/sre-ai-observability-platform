# eCommerce SRE Observability Platform

A fully instrumented eCommerce application with **AI-powered observability** for investigating system issues. This project demonstrates production-grade SRE practices including metrics, structured logging, dashboards, and an intelligent AI agent that can investigate issues autonomously.

## 🚀 Quick Start

```bash
# 1. Set your OpenRouter API key (required for AI features)
echo "OPENROUTER_API_KEY='your-key-here'" > .env

# 2. Start the entire stack
docker compose up --build

# 3. Access the services
# - Frontend: http://localhost:5173
# - Backend API: http://localhost:4000
# - Prometheus: http://localhost:9090
# - Grafana: http://localhost:3000 (admin/admin)
# - Elasticsearch: http://localhost:9200
```

**Demo credentials**: `demo@shop.com` / `demopass`

## 🤖 AI Chat - Interactive Observability

The killer feature! Chat with an AI agent that can investigate your system in real-time.

### Start the AI Chat:

```bash
cd ai-observer
npm run chat
```

### Example Conversation:

```
╔═══════════════════════════════════════════════════════════╗
║         🤖 SRE AI Observer - Interactive Chat            ║
╚═══════════════════════════════════════════════════════════╝

You > What's the current system status?
AI > Investigating...
🔧 Using tool: query_prometheus
   Query: up{job="backend"}
AI > All services are healthy. Backend is up and responding...

You > Are there any errors?
🔧 Using tool: search_logs
   Query: level:error
AI > Found 3 errors in the last hour, all from payment service...

You > Why is payment failing?
🔧 Using tool: query_prometheus
   Query: rate(ecommerce_http_requests_total{status_code="500",route="/api/payment"}[5m])
AI > Payment service has a 12% error rate, above the 8% baseline...
```

### AI Chat Commands:

- `help` - Show example questions
- `clear` - Reset conversation history
- `exit` or `quit` - Exit the chat

### Example Questions to Ask:

- "What's the current error rate?"
- "Why is checkout slow?"
- "Show me recent payment errors"
- "Is there anything unusual in the last 15 minutes?"
- "What's the P95 latency for the payment service?"

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

**Two ways to use**:

#### A. Interactive CLI Chat (Recommended)
```bash
cd ai-observer
npm run chat
```

#### B. HTTP API
```bash
curl -X POST http://localhost:5000/investigate \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the system status?"}'
```

**AI Capabilities**:
- Queries Prometheus metrics
- Searches Elasticsearch logs
- Reads metric catalog for context
- Multi-turn reasoning (up to 5 turns)
- Follows SRE triage loop

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

- **[OBSERVABILITY.md](./OBSERVABILITY.md)** - Complete observability guide
- **[ai-observer/README.md](./ai-observer/README.md)** - AI service documentation
- **[guidelines.md](./guidelines.md)** - Log/metric conventions
- **[metric_catalog.md](./metric_catalog.md)** - Metric definitions

## 🔧 Configuration

### Environment Variables

Create `.env` file in project root:

```bash
OPENROUTER_API_KEY='sk-or-v1-your-key-here'
```

Get your key at: https://openrouter.ai/keys

### Backend Configuration

Edit `docker-compose.yml` backend environment:

```yaml
backend:
  environment:
    - PAYMENT_FAILURE_RATE=0.08    # Payment failure rate (0-1)
    - JWT_SECRET=your-secret
    - MYSQL_HOST=mysql
    - ELASTICSEARCH_URL=http://elasticsearch:9200
```

## 🐛 Troubleshooting

### AI Chat Not Working

```bash
# Check API key is set
cat .env

# Verify services are running
docker ps | grep -E "prometheus|elasticsearch"

# Check AI service logs
docker logs shop-ai-service
```

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
