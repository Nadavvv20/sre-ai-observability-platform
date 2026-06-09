# AI Observer - SRE Observability Agent

An AI-powered observability agent that uses LLM function calling to investigate system issues by querying Prometheus metrics and Elasticsearch logs.

## Features

- 🤖 **AI-Powered Investigation**: Uses Claude 3.5 Sonnet via OpenRouter
- 🔧 **Three Tools**: Query Prometheus, Search Logs, Read Metric Catalog
- 💬 **Interactive CLI Chat**: Real-time conversation interface
- 🌐 **HTTP API**: REST endpoint for programmatic access
- 🔄 **Multi-Turn Reasoning**: Agent can make follow-up queries
- 📊 **Context-Aware**: Understands metric definitions and baselines

## Installation

```bash
cd ai-observer
npm install
```

## Configuration

Set your OpenRouter API key:

```bash
# In .env file (project root)
OPENROUTER_API_KEY='sk-or-v1-your-key-here'

# Or export it
export OPENROUTER_API_KEY='sk-or-v1-your-key-here'
```

Get your API key at: https://openrouter.ai/keys

## Usage

### Option 1: Interactive CLI Chat (Recommended)

```bash
npm run chat
```

Or if installed globally:

```bash
npm link
sre-chat
```

**CLI Commands:**
- `help` - Show example questions
- `clear` - Reset conversation history
- `exit` or `quit` - Exit the chat

**Example Session:**
```
╔═══════════════════════════════════════════════════════════╗
║         🤖 SRE AI Observer - Interactive Chat            ║
╚═══════════════════════════════════════════════════════════╝

You > What's the current error rate?
🔧 Using tool: query_prometheus
   Query: sum(rate(ecommerce_http_requests_total{status_code=~"5.."}[5m])) / sum(rate(ecommerce_http_requests_total[5m])) * 100
AI > The current error rate is 2.3%, which is within normal range...

You > Are there any payment errors?
🔧 Using tool: search_logs
   Query: level:error AND action:payment
AI > Found 3 payment errors in the last hour...
```

### Option 2: HTTP API

Start the server:

```bash
npm start
```

Make requests:

```bash
curl -X POST http://localhost:5000/investigate \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the system status?"}'
```

Health check:

```bash
curl http://localhost:5000/health
```

## Available Tools

The AI agent has access to three tools:

### 1. query_prometheus
Executes PromQL queries against Prometheus.

**Example queries:**
- Error rate: `sum(rate(ecommerce_http_requests_total{status_code=~"5.."}[5m]))`
- P95 latency: `histogram_quantile(0.95, rate(ecommerce_payment_duration_seconds_bucket[5m]))`
- Active connections: `ecommerce_db_connection_pool_active`

### 2. search_logs
Searches Elasticsearch logs using query string syntax.

**Example queries:**
- `level:error` - All errors
- `action:payment AND level:error` - Payment errors
- `session_id:abc123` - Logs for specific session

### 3. get_metric_catalog
Reads the metric catalog to understand available metrics and their normal baselines.

## Example Questions

**System Health:**
- "What's the current system status?"
- "Is everything running normally?"
- "Are there any anomalies?"

**Error Investigation:**
- "Are there any errors in the last 15 minutes?"
- "Why is the payment service failing?"
- "Show me recent cart errors"

**Performance:**
- "Why is checkout slow?"
- "What's the P95 latency for payment?"
- "Is the database connection pool healthy?"

**Specific Metrics:**
- "What's the current error rate?"
- "How many requests per second are we handling?"
- "Show me the payment success rate"

## Architecture

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       ├─────────────────┐
       │                 │
┌──────▼──────┐   ┌──────▼──────┐
│  CLI Chat   │   │  HTTP API   │
│  (chat.js)  │   │ (index.js)  │
└──────┬──────┘   └──────┬──────┘
       │                 │
       └────────┬────────┘
                │
         ┌──────▼──────┐
         │  OpenAI SDK │
         │  (Claude)   │
         └──────┬──────┘
                │
       ┌────────┴────────┐
       │                 │
┌──────▼──────┐   ┌──────▼──────────┐
│ Prometheus  │   │ Elasticsearch   │
│ (metrics)   │   │ (logs)          │
└─────────────┘   └─────────────────┘
```

## Docker Usage

The service runs in Docker Compose with the observability stack:

```bash
# Start all services
docker compose up -d

# View AI service logs
docker logs shop-ai-service

# Access the CLI inside container
docker exec -it shop-ai-service npm run chat
```

## Development

**Run locally (outside Docker):**

```bash
# Make sure Prometheus and Elasticsearch are accessible
npm run chat
```

**Add new tools:**

1. Define the tool function
2. Add tool definition to `tools` array
3. Add function call handler in the investigation loop

## Troubleshooting

**"OPENROUTER_API_KEY not set"**
- Ensure the environment variable is set in `.env` or exported

**"Error querying Prometheus"**
- Check Prometheus is running: `curl http://localhost:9090/-/healthy`
- Verify network connectivity

**"Error querying Elasticsearch"**
- Check Elasticsearch is running: `curl http://localhost:9200/_cluster/health`
- Ensure logs are being ingested

**Agent not using tools**
- Check the question is clear and specific
- Try rephrasing to be more direct
- Verify API key has sufficient credits

## Limits

- **Max turns per investigation**: 5
- **Model**: Claude 3.5 Sonnet (via OpenRouter)
- **Conversation history**: Persists during CLI session, resets on restart

## License

ISC
