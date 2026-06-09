import express from 'express';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json());

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY, 
});

async function queryPrometheus(query) {
    try {
        const res = await fetch(`http://prometheus:9090/api/v1/query?query=${encodeURIComponent(query)}`);
        const data = await res.json();
        return JSON.stringify(data.data.result);
    } catch (e) {
        return `Error querying Prometheus: ${e.message}`;
    }
}

async function searchLogs(query) {
    try {
        const res = await fetch(`http://elasticsearch:9200/_search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        return JSON.stringify(data.hits.hits.map(h => h._source));
    } catch (e) {
        return `Error querying Elasticsearch: ${e.message}`;
    }
}

function getMetricCatalog() {
    try {
        return fs.readFileSync(path.resolve('./metric_catalog.md'), 'utf-8');
    } catch (e) {
        return "Catalog not found.";
    }
}

const tools = [
    {
        type: "function",
        function: {
            name: "query_prometheus",
            description: "Execute a PromQL query to get metrics (latency, errors, etc.)",
            parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
        }
    },
    {
        type: "function",
        function: {
            name: "search_logs",
            description: "Search Elasticsearch logs to find specific error messages or session issues",
            parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
        }
    },
    {
        type: "function",
        function: {
            name: "get_metric_catalog",
            description: "Read the metric catalog to understand what metrics exist and what normal looks like",
            parameters: { type: "object", properties: {} }
        }
    }
];

app.post('/investigate', async (req, res) => {
    const userQuestion = req.body.question;
    
    const messages = [
        { 
            role: 'system', 
            content: 'You are an SRE AI agent. Use your tools to investigate system issues based on the user question. Follow the Triage Loop: Identify Symptom -> Query Metric -> Search Logs -> Form Hypothesis -> Confirm.' 
        },
        { role: 'user', content: userQuestion }
    ];

    let turnCount = 0;
    const MAX_TURNS = 5;

    try {
        while (turnCount < MAX_TURNS) {
            turnCount++;
            console.log(`\n--- Agent Turn ${turnCount} ---`);

            const response = await openai.chat.completions.create({
                model: 'anthropic/claude-3.5-sonnet',
                messages: messages,
                tools: tools,
                tool_choice: "auto"
            });

            const aiMessage = response.choices[0].message;
            messages.push(aiMessage);

            if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
                for (const toolCall of aiMessage.tool_calls) {
                    const funcName = toolCall.function.name;
                    const args = JSON.parse(toolCall.function.arguments || "{}");
                    console.log(`AI called tool: ${funcName} with args:`, args);

                    let toolResult = "";
                    if (funcName === 'query_prometheus') toolResult = await queryPrometheus(args.query);
                    if (funcName === 'search_logs') toolResult = await searchLogs(args.query);
                    if (funcName === 'get_metric_catalog') toolResult = getMetricCatalog();

                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: toolResult
                    });
                }
            } else {
                console.log("Investigation complete.");
                return res.json({ insight: aiMessage.content });
            }
        }
        res.json({ insight: "Max iterations reached without a final conclusion." });
    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(5000, () => console.log('AI Observability Service listening on port 5000'));