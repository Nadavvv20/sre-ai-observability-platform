import express from 'express';
import { createAIClient, getSystemPrompt } from './ai-client.js';
import { getSystemOverview, searchLogs, queryPrometheus, toolsDefinitions } from './tools.js';
import { validateUserInput, redactOutput, scrubSensitiveData } from './guardrails.js';

const app = express();
app.use(express.json());

// Initialize AI Client lazily
let aiInstance = null;
function getAI() {
    if (!aiInstance) {
        aiInstance = createAIClient();
    }
    return aiInstance;
}

app.post('/investigate', async (req, res) => {
    const userQuestion = req.body.question;

    if (!userQuestion) {
        return res.status(400).json({ error: 'Question is required' });
    }

    // Pre-AI Guardrail check (0 tokens)
    const validation = validateUserInput(userQuestion);
    if (!validation.safe) {
        return res.status(400).json({
            error: validation.reason,
            blocked_by_guardrail: true
        });
    }

    const messages = [
        {
            role: 'system',
            content: getSystemPrompt()
        },
        { role: 'user', content: userQuestion }
    ];

    let turnCount = 0;
    const TOOL_TURNS = 2;

    try {
        const { client, model } = getAI();

        while (turnCount < TOOL_TURNS) {
            turnCount++;
            console.log(`\n--- Agent Turn ${turnCount}/${TOOL_TURNS + 1} ---`);

            const response = await client.chat.completions.create({
                model: model,
                messages: messages,
                tools: toolsDefinitions,
                tool_choice: 'auto',
                max_tokens: 900
            });

            const aiMessage = response.choices[0].message;
            messages.push(aiMessage);

            if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
                // Execute tools in parallel
                const toolPromises = aiMessage.tool_calls.map(async (toolCall) => {
                    const funcName = toolCall.function.name;
                    let args = {};
                    try {
                        args = JSON.parse(toolCall.function.arguments || "{}");
                    } catch (e) {
                        args = {};
                    }

                    console.log(`AI calling tool: ${funcName}`);

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
                    messages.push(toolResultMsg);
                }
            } else {
                console.log("Investigation complete.");
                return res.json({ insight: redactOutput(aiMessage.content) });
            }
        }

        // Final synthesis
        console.log(`\n--- Synthesis Turn ---`);
        const synthResponse = await client.chat.completions.create({
            model: model,
            messages: [
                ...messages,
                { role: 'user', content: 'Provide the final concise SRE assessment in the 🔴/🟡/🟢 format. State Root Cause, Impact, and Recommended Action.' }
            ],
            tools: toolsDefinitions,
            tool_choice: 'auto',
            max_tokens: 900
        });

        const synthMsg = synthResponse.choices[0].message;
        return res.json({ insight: redactOutput(synthMsg.content || 'Investigation complete.') });
    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    try {
        const { config } = getAI();
        res.json({
            status: 'healthy',
            service: 'ai-observer',
            provider: config.providerName,
            model: config.model
        });
    } catch (e) {
        res.status(500).json({ status: 'unhealthy', error: e.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`AI Observability Service listening on port ${PORT}`);
    try {
        const { config } = getAI();
        console.log(`AI Provider: ${config.providerName} | Model: ${config.model}`);
    } catch (e) {
        console.warn(`Warning: AI configuration not initialized: ${e.message}`);
    }
});
