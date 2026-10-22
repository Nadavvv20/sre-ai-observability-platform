#!/usr/bin/env node

import readline from 'readline';
import fetch from 'node-fetch';
import { createAIClient, getSystemPrompt } from './ai-client.js';
import { getSystemOverview, searchLogs, queryPrometheus, toolsDefinitions } from './tools.js';
import { validateUserInput, redactOutput, scrubSensitiveData } from './guardrails.js';

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

// Initialize AI Client and configuration
let aiInstance = null;
function getAI() {
    if (!aiInstance) {
        aiInstance = createAIClient();
    }
    return aiInstance;
}

// Conversation history initialized with optimized System Prompt
let conversationHistory = [
    {
        role: 'system',
        content: getSystemPrompt()
    }
];

// Multi-turn reasoning loop with fast single-shot telemetry and parallel execution
async function investigate(userQuestion) {
    // Keep conversation clean — retain system message and at most last assistant summary
    if (conversationHistory.length > 8) {
        const systemMsg = conversationHistory[0];
        const lastAssistant = conversationHistory.filter(m => m.role === 'assistant' && m.content).slice(-1)[0];
        conversationHistory = [systemMsg];
        if (lastAssistant) {
            conversationHistory.push({ role: 'assistant', content: `[Previous SRE assessment]: ${lastAssistant.content.slice(0, 300)}...` });
        }
    }

    conversationHistory.push({ role: 'user', content: userQuestion });

    let turnCount = 0;
    const TOOL_TURNS = 2;   // Fast triage: Turn 1 telemetry, Turn 2 diagnosis
    const { client, model } = getAI();

    try {
        while (turnCount < TOOL_TURNS) {
            turnCount++;

            if (turnCount > 1) {
                console.log(`${colors.dim}[Turn ${turnCount}/${TOOL_TURNS + 1}]${colors.reset}`);
            }

            const response = await client.chat.completions.create({
                model: model,
                messages: conversationHistory,
                tools: toolsDefinitions,
                tool_choice: 'auto',
                max_tokens: 900
            });

            const aiMessage = response.choices[0].message;
            conversationHistory.push(aiMessage);

            if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
                // Execute tool calls in parallel
                const toolPromises = aiMessage.tool_calls.map(async (toolCall) => {
                    const funcName = toolCall.function.name;
                    let args = {};
                    try {
                        args = JSON.parse(toolCall.function.arguments || "{}");
                    } catch (e) {
                        args = {};
                    }

                    const queryDisplay = args.query ? ` → ${args.query}` : (args.status_code ? ` → ${args.status_code}` : '');
                    console.log(`${colors.yellow}🔧 Tool: ${colors.bright}${funcName}${colors.reset}${colors.dim}${queryDisplay}${colors.reset}`);

                    let toolResult = "";
                    if (funcName === 'get_system_overview') {
                        toolResult = await getSystemOverview();
                    } else if (funcName === 'query_prometheus') {
                        toolResult = await queryPrometheus(args.query);
                    } else if (funcName === 'search_logs') {
                        toolResult = await searchLogs(args);
                    } else {
                        toolResult = `Tool ${funcName} not recognized.`;
                    }

                    return {
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: scrubSensitiveData(toolResult)
                    };
                });

                const executedResults = await Promise.all(toolPromises);
                for (const toolResultMsg of executedResults) {
                    conversationHistory.push(toolResultMsg);
                }
            } else {
                // Model answered directly
                return redactOutput(aiMessage.content);
            }
        }

        // Final synthesis call if tool turns were used
        console.log(`${colors.dim}[Synthesis Turn]${colors.reset}`);
        const synthResponse = await client.chat.completions.create({
            model: model,
            messages: [
                ...conversationHistory,
                { role: 'user', content: 'Provide the final concise SRE assessment in the 🔴/🟡/🟢 format. State Root Cause, Impact, and Recommended Action.' }
            ],
            tools: toolsDefinitions,
            tool_choice: 'auto',
            max_tokens: 900
        });

        const synthMsg = synthResponse.choices[0].message;
        conversationHistory.push(synthMsg);

        if (synthMsg.content) {
            return redactOutput(synthMsg.content);
        }

        // Fallback if model made another tool call on synthesis
        if (synthMsg.tool_calls && synthMsg.tool_calls.length > 0) {
            return 'Investigation completed. Check recent errors and metrics in system overview.';
        }

        return 'Investigation concluded.';

    } catch (error) {
        return `${colors.red}❌ Error: ${error.message}${colors.reset}`;
    }
}

function printBanner(config) {
    console.log(`${colors.cyan}${colors.bright}`);
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║         🤖 SRE AI Observer - Production Agent            ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log(`${colors.reset}`);
    console.log(`${colors.yellow}Provider : ${colors.bright}${config.providerName}${colors.reset}`);
    console.log(`${colors.yellow}Model    : ${colors.bright}${config.model}${colors.reset}`);
    console.log(`${colors.dim}Targets  : Prometheus (localhost:9090) & Elasticsearch (localhost:9200)${colors.reset}`);
    console.log(`${colors.dim}Commands : 'help', 'clear', 'exit'${colors.reset}`);
    console.log();
}

function printHelp() {
    console.log(`${colors.cyan}${colors.bright}Example Questions:${colors.reset}`);
    console.log(`${colors.green}  • "What's the current system status?"${colors.reset}`);
    console.log(`${colors.green}  • "Are there any errors in the last 15 minutes?"${colors.reset}`);
    console.log(`${colors.green}  • "Why is the checkout duration high?"${colors.reset}`);
    console.log(`${colors.green}  • "Show me recent cart errors and active DB connections"${colors.reset}`);
    console.log(`${colors.green}  • "What is the P95 latency for catalog requests?"${colors.reset}`);
    console.log(`${colors.green}  • "Is the backend down?"${colors.reset}`);
    console.log();
}

async function main() {
    try {
        const { config } = getAI();
        printBanner(config);
    } catch (e) {
        console.error(`${colors.red}❌ Configuration Error: ${e.message}${colors.reset}`);
        console.log(`${colors.yellow}Please configure your .env file with AI_PROVIDER and AI_API_KEY.${colors.reset}\n`);
        process.exit(1);
    }

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

        // Commands
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
            conversationHistory = [
                {
                    role: 'system',
                    content: getSystemPrompt()
                }
            ];
            console.log(`${colors.green}✓ Conversation cleared${colors.reset}\n`);
            rl.prompt();
            return;
        }

        // Pre-AI Guardrail: Block jailbreaks, malicious payloads, and non-SRE topics (0 tokens)
        const validation = validateUserInput(input);
        if (!validation.safe) {
            console.log(`${colors.yellow}${validation.reason}${colors.reset}\n`);
            rl.prompt();
            return;
        }

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
