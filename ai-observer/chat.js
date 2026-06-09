#!/usr/bin/env node

import 'dotenv/config';
import readline from 'readline';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Colors for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m'
};

// Initialize OpenAI client lazily
let openai = null;

function getOpenAI() {
    if (!openai) {
        openai = new OpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: process.env.OPENROUTER_API_KEY,
        });
    }
    return openai;
}

// Tool functions
async function queryPrometheus(query) {
    try {
        const res = await fetch(`http://localhost:9090/api/v1/query?query=${encodeURIComponent(query)}`);
        const data = await res.json();
        return JSON.stringify(data.data.result, null, 2);
    } catch (e) {
        return `Error querying Prometheus: ${e.message}`;
    }
}

async function searchLogs(query) {
    try {
        const res = await fetch(`http://localhost:9200/_search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        return JSON.stringify(data.hits.hits.map(h => h._source), null, 2);
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

// Conversation history
const conversationHistory = [
    {
        role: 'system',
        content: 'You are an SRE AI agent helping investigate system issues. Use your tools to query metrics and logs. Be concise but thorough. Follow the Triage Loop: Identify Symptom → Query Metric → Search Logs → Form Hypothesis → Confirm.'
    }
];

async function investigate(userQuestion) {
    conversationHistory.push({ role: 'user', content: userQuestion });

    let turnCount = 0;
    const MAX_TURNS = 5;

    try {
        while (turnCount < MAX_TURNS) {
            turnCount++;
            
            if (turnCount > 1) {
                console.log(`${colors.dim}[Turn ${turnCount}/${MAX_TURNS}]${colors.reset}`);
            }

            const response = await getOpenAI().chat.completions.create({
                model: 'anthropic/claude-4.5-sonnet',
                messages: conversationHistory,
                tools: tools,
                tool_choice: "auto"
            });

            const aiMessage = response.choices[0].message;
            conversationHistory.push(aiMessage);

            if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
                for (const toolCall of aiMessage.tool_calls) {
                    const funcName = toolCall.function.name;
                    const args = JSON.parse(toolCall.function.arguments || "{}");
                    
                    console.log(`${colors.yellow}🔧 Using tool: ${colors.bright}${funcName}${colors.reset}`);
                    if (args.query) {
                        console.log(`${colors.dim}   Query: ${args.query}${colors.reset}`);
                    }

                    let toolResult = "";
                    if (funcName === 'query_prometheus') {
                        toolResult = await queryPrometheus(args.query);
                    } else if (funcName === 'search_logs') {
                        toolResult = await searchLogs(args.query);
                    } else if (funcName === 'get_metric_catalog') {
                        toolResult = getMetricCatalog();
                    }

                    conversationHistory.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: toolResult
                    });
                }
            } else {
                // Final answer
                return aiMessage.content;
            }
        }
        return `⚠️  Reached maximum iterations (${MAX_TURNS}) without a final conclusion.`;
    } catch (error) {
        return `${colors.red}❌ Error: ${error.message}${colors.reset}`;
    }
}

function printBanner() {
    console.log(`${colors.cyan}${colors.bright}`);
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║         🤖 SRE AI Observer - Interactive Chat            ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log(`${colors.reset}`);
    console.log(`${colors.dim}Connected to: Prometheus (localhost:9090) & Elasticsearch (localhost:9200)${colors.reset}`);
    console.log(`${colors.dim}Type your questions or commands:${colors.reset}`);
    console.log(`${colors.green}  • Ask about system status, errors, metrics${colors.reset}`);
    console.log(`${colors.green}  • Type 'help' for examples${colors.reset}`);
    console.log(`${colors.green}  • Type 'clear' to reset conversation${colors.reset}`);
    console.log(`${colors.green}  • Type 'exit' or 'quit' to leave${colors.reset}`);
    console.log();
}

function printHelp() {
    console.log(`${colors.cyan}${colors.bright}Example Questions:${colors.reset}`);
    console.log(`${colors.green}  • "What's the current system status?"${colors.reset}`);
    console.log(`${colors.green}  • "Are there any errors in the last 15 minutes?"${colors.reset}`);
    console.log(`${colors.green}  • "Why is the payment service slow?"${colors.reset}`);
    console.log(`${colors.green}  • "Show me recent cart errors"${colors.reset}`);
    console.log(`${colors.green}  • "What's the P95 latency for checkout?"${colors.reset}`);
    console.log(`${colors.green}  • "Is there anything unusual happening?"${colors.reset}`);
    console.log();
}

async function main() {
    // Check for API key
    if (!process.env.OPENROUTER_API_KEY) {
        console.error(`${colors.red}❌ Error: OPENROUTER_API_KEY environment variable not set${colors.reset}`);
        console.log(`${colors.yellow}Please set it in your .env file or export it:${colors.reset}`);
        console.log(`${colors.dim}  export OPENROUTER_API_KEY='your-key-here'${colors.reset}`);
        process.exit(1);
    }

    printBanner();

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: `${colors.blue}${colors.bright}You >${colors.reset} `
    });

    rl.prompt();

    rl.on('line', async (line) => {
        const input = line.trim();

        if (!input) {
            rl.prompt();
            return;
        }

        // Handle commands
        if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
            console.log(`${colors.cyan}👋 Goodbye!${colors.reset}`);
            process.exit(0);
        }

        if (input.toLowerCase() === 'help') {
            printHelp();
            rl.prompt();
            return;
        }

        if (input.toLowerCase() === 'clear') {
            conversationHistory.length = 1; // Keep only system message
            console.log(`${colors.green}✓ Conversation cleared${colors.reset}\n`);
            rl.prompt();
            return;
        }

        // Process the question
        console.log(`${colors.magenta}${colors.bright}AI >${colors.reset} ${colors.dim}Investigating...${colors.reset}\n`);
        
        try {
            const answer = await investigate(input);
            console.log(`${colors.magenta}${colors.bright}AI >${colors.reset} ${answer}\n`);
        } catch (error) {
            console.error(`${colors.red}❌ Error: ${error.message}${colors.reset}\n`);
        }

        rl.prompt();
    });

    rl.on('close', () => {
        console.log(`\n${colors.cyan}👋 Goodbye!${colors.reset}`);
        process.exit(0);
    });
}

main();
