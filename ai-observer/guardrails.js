/**
 * SRE AI Observer - Strict Security & Guardrails Module
 * 
 * Enforces:
 * 1. Zero-token pre-flight rejection of prompt injections, jailbreaks, and exploits.
 * 2. Strict domain boundary enforcement (rejection of general math, trivia, non-SRE chat).
 * 3. Bidirectional PII and secret redaction (scrubbing logs before AI, and outputs before user).
 */

// 1. Jailbreak, Prompt Injection & Exploit Patterns
const JAILBREAK_PATTERNS = [
    /ignore\s+(all\s+)?(previous|prior|above|system)\s+instructions/i,
    /\b(dan|jailbreak|unrestricted|developer\s+mode|chaos\s+mode)\b/i,
    /\b(bypass|disable|override|disregard)\s+(safety|rules|guardrails|instructions|system|filters)/i,
    /\b(tell\s+me\s+your\s+system\s+prompt|show\s+(your\s+)?(system\s+)?prompt|reveal\s+instructions)\b/i,
    /\b(print|reveal|leak|exfiltrate|show)\b.*(api[_-]?key|secret|password|token|env|credentials)/i,
    /\b(rm\s+-rf|drop\s+database|drop\s+table|curl\s+http|cat\s+\/etc\/|powershell|cmd\.exe|bash\s+-c)\b/i,
    /\b(write\s+(a\s+)?malware|exploit|reverse\s+shell|ddos|sql\s+injection|keylogger|payload)\b/i,
    /\b(pretend\s+you\s+are|roleplay\s+as|act\s+as)\s+(an?\s+)?(unrestricted|evil|hacker|different|god)\b/i,
    /\b(system\s+override|sudo\s+mode|maintenance\s+override)\b/i
];

// 2. Out-of-Scope / Irrelevant Intent Patterns (Math, Trivia, General Chat, Creative Writing)
const OUT_OF_SCOPE_PATTERNS = [
    // Math operations, e.g. "1+1", "calculate 25 * 4", "what is 10 divided by 2", "sqrt(16)"
    /^\s*[\d\s\+\-\*\/\^\(\)\.\=]+\s*$/,
    /\b(calculate|compute|solve|math|equation)\b\s*[\d\+\-\*\/\^]/i,
    /\bwhat\s+is\s+\d+\s*[\+\-\*\/x\^]\s*\d+/i,
    /\b(what('s| is) \d+\s*(plus|minus|times|divided by)\s*\d+)/i,

    // General trivia, creative writing, casual chitchat
    /\b(tell\s+(me\s+)?a\s+(joke|story|poem|riddle|song)|sing\s+a\s+song)\b/i,
    /\b(who\s+won|who\s+is\s+the\s+president|what\s+is\s+the\s+capital\s+of|weather\s+in)\b/i,
    /\b(recipe\s+for|recommend\s+(a\s+)?(movie|book|game|restaurant))\b/i,
    /\b(translate\s+.+\s+to\s+[a-z]+|write\s+an\s+essay|write\s+a\s+letter)\b/i,
    /\b(write\s+(a\s+)?(python|java|c\+\+|javascript|html)\s+(game|snake|script|calculator|scraper))\b/i,
    /^\s*(hi|hello|hey|how\s+are\s+you|who\s+are\s+you|what's\s+up|sup)\s*[\?\!\.]*\s*$/i
];

// 3. Permitted SRE & Observability Domain Keywords
const SRE_DOMAIN_KEYWORDS = [
    'sre', 'system', 'status', 'health', 'outage', 'incident', 'error', 'errors', 'warn', 'warning',
    'metric', 'metrics', 'log', 'logs', 'latency', 'duration', 'p95', 'p99', 'rps', 'traffic', 'spike',
    'prometheus', 'elasticsearch', 'grafana', 'service', 'services', 'container', 'docker',
    'backend', 'frontend', 'mysql', 'database', 'db', 'connection', 'pool', 'saturation', 'bottleneck',
    'cart', 'checkout', 'payment', 'catalog', 'products', 'auth', 'login', 'signup',
    '500', '503', '502', '5xx', '400', '401', '402', '403', '404', '409', '4xx', '200', '2xx',
    'request', 'requests', 'down', 'crash', 'failing', 'failure', 'trace', 'root cause', 'triage',
    'remediation', 'slow', 'timeout', 'overview', 'telemetry', 'econnrefused', 'enotfound', 'declined'
];

/**
 * Validate incoming user query.
 * Blocks malicious jailbreak attempts AND strictly blocks non-SRE topics (even "1+1").
 * Zero LLM API calls, zero tokens consumed.
 */
export function validateUserInput(input) {
    if (!input || typeof input !== 'string' || input.trim().length === 0) {
        return {
            safe: false,
            reason: '⚠️ Empty request. Please ask an SRE observability question (e.g., "What is the system status?").'
        };
    }

    const trimmed = input.trim();

    // Check for explicit jailbreak / prompt injection / exploit attempts
    for (const pattern of JAILBREAK_PATTERNS) {
        if (pattern.test(trimmed)) {
            return {
                safe: false,
                reason: '🛡️ [SECURITY REJECTION]: Prompt rejected by SRE Security Guardrail. Unauthorized instruction, jailbreak attempt, or security violation detected.'
            };
        }
    }

    // Check for explicit out-of-scope tasks (math, general trivia, unrelated requests)
    for (const pattern of OUT_OF_SCOPE_PATTERNS) {
        if (pattern.test(trimmed)) {
            return {
                safe: false,
                reason: '🛡️ [SCOPE RESTRICTION]: I am exclusively an SRE Observability Agent for this e-commerce platform. I cannot perform general math (e.g. 1+1), trivia, casual chat, or unrelated coding. Please ask about system health, metrics, logs, or platform incidents.'
            };
        }
    }

    // Domain relevance verification:
    // If the input is longer than 15 characters and contains NONE of the SRE domain keywords,
    // verify whether it has any operational relevance.
    const lower = trimmed.toLowerCase();
    const hasSreKeyword = SRE_DOMAIN_KEYWORDS.some(k => lower.includes(k));

    // Allow standard short commands (help, clear, exit)
    if (['help', 'clear', 'exit', 'quit', '?'].includes(lower)) {
        return { safe: true };
    }

    // If completely unrelated to platform, observability, or errors
    if (!hasSreKeyword && trimmed.length > 8) {
        return {
            safe: false,
            reason: '🛡️ [SCOPE RESTRICTION]: Query is outside the SRE observability domain. I only inspect platform health, microservices, metrics, Elasticsearch logs, HTTP codes, and performance bottlenecks.'
        };
    }

    return { safe: true };
}

/**
 * Scrub sensitive data (PII, credentials, API keys, JWTs, hashes) from raw text.
 * Used to sanitize untrusted logs before the AI sees them, and sanitize outputs before display.
 */
export function scrubSensitiveData(text) {
    if (!text || typeof text !== 'string') return text;

    return text
        // Scrub Bearer & JWT tokens
        .replace(/Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/gi, 'Bearer [REDACTED_JWT]')
        // Scrub Groq, OpenAI, Google API keys
        .replace(/(gsk_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_]{20,}|AQ\.[A-Za-z0-9_-]{20,})/gi, '[REDACTED_API_KEY]')
        // Scrub passwords, secrets in JSON fields
        .replace(/"(password|password_hash|secret|jwt_secret|private_key)":\s*"[^"]+"/gi, '"$1": "[REDACTED]"')
        // Scrub password in key=value or url strings
        .replace(/([?&;,\s]password=)[^&;\s]+/gi, '$1[REDACTED]')
        // Scrub MySQL/DB connection URI credentials (mysql://user:pass@host)
        .replace(/([a-zA-Z]+:\/\/[^:]+:)[^@]+(@)/g, '$1[REDACTED]$2')
        // Scrub bcrypt password hashes
        .replace(/\$2[aby]?\$\d+\$[./A-Za-z0-9]{53}/g, '[REDACTED_PASSWORD_HASH]');
}

/**
 * Final output sanitizer to ensure no sensitive credentials leak in model output.
 */
export function redactOutput(response) {
    if (!response || typeof response !== 'string') return response;
    return scrubSensitiveData(response);
}
