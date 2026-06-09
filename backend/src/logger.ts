import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

// Elasticsearch configuration
const esTransportOpts = {
  level: 'info',
  clientOpts: {
    node: process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200',
    maxRetries: 5,
    requestTimeout: 10000,
  },
  index: 'ecommerce-logs',
};

// Create Winston logger with structured JSON format
export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ecommerce_backend' },
  transports: [
    // Console transport for local development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Add Elasticsearch transport if in production/docker environment
if (process.env.NODE_ENV === 'production' || process.env.ELASTICSEARCH_URL) {
  try {
    logger.add(new ElasticsearchTransport(esTransportOpts));
  } catch (err) {
    console.error('Failed to initialize Elasticsearch transport:', err);
  }
}

// Helper function to create structured log entries
export function createLogEntry(params: {
  level: 'info' | 'warn' | 'error';
  service: string;
  action: string;
  message: string;
  session_id?: string;
  user_id?: number;
  latency_ms?: number;
  error?: any;
  [key: string]: any;
}) {
  const entry: any = {
    timestamp: new Date().toISOString(),
    level: params.level,
    service: params.service,
    action: params.action,
    message: params.message,
  };

  if (params.session_id) entry.session_id = params.session_id;
  if (params.user_id) entry.user_id = params.user_id;
  if (params.latency_ms !== undefined) entry.latency_ms = params.latency_ms;
  if (params.error) {
    entry.error = params.error.message || params.error;
    if (params.error.stack) entry.stack = params.error.stack;
  }

  // Add any additional fields
  Object.keys(params).forEach((key) => {
    if (!['level', 'service', 'action', 'message', 'session_id', 'user_id', 'latency_ms', 'error'].includes(key)) {
      entry[key] = params[key];
    }
  });

  return entry;
}

// Log with proper structure
export function logInfo(params: Omit<Parameters<typeof createLogEntry>[0], 'level'>) {
  logger.info(createLogEntry({ ...params, level: 'info' }));
}

export function logWarn(params: Omit<Parameters<typeof createLogEntry>[0], 'level'>) {
  logger.warn(createLogEntry({ ...params, level: 'warn' }));
}

export function logError(params: Omit<Parameters<typeof createLogEntry>[0], 'level'>) {
  logger.error(createLogEntry({ ...params, level: 'error' }));
}
