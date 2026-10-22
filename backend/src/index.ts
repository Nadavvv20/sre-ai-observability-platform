import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { config } from './config.js';
import { initSchema } from './db.js';
import { HttpError } from './util.js';
import { register, httpRequestsTotal } from './metrics.js';
import { logInfo, logWarn, logError } from './logger.js';
import authRouter from './routes/auth.js';
import productsRouter from './routes/products.js';
import cartRouter from './routes/cart.js';
import checkoutRouter from './routes/checkout.js';
import paymentRouter from './routes/payment.js';
import ordersRouter from './routes/orders.js';

const app = express();
app.use(cors());
app.use(express.json());

// Middleware to track all HTTP requests
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const route = req.route?.path || req.path;
    
    // Track HTTP request metrics
    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode,
    });
    
    // Log request with proper severity level based on status code
    const logPayload = {
      service: 'http_server',
      action: 'http_request',
      message: `${req.method} ${route} ${res.statusCode}`,
      latency_ms: duration,
      method: req.method,
      path: req.path,
      status_code: res.statusCode,
    };

    if (res.statusCode >= 500) {
      logError(logPayload);
    } else if (res.statusCode >= 400) {
      logWarn(logPayload);
    } else {
      logInfo(logPayload);
    }
  });
  
  next();
});

// Health check endpoint with database probe
app.get('/healthz', async (_req, res) => {
  try {
    const { pool } = await import('./db.js');
    await pool.query('SELECT 1');
    res.json({ ok: true, status: 'healthy', database: 'connected' });
  } catch (err: any) {
    res.status(503).json({
      ok: false,
      status: 'unhealthy',
      database: 'disconnected',
      error: err?.message || String(err),
    });
  }
});

// Prometheus metrics endpoint
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/cart', cartRouter);
app.use('/api/checkout', checkoutRouter);
app.use('/api/payment', paymentRouter);
app.use('/api/orders', ordersRouter);

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'not_found', path: req.path });
});

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    if (err.status >= 500) {
      logError({
        service: 'http_server',
        action: 'http_error',
        message: err.message,
        path: req.path,
        method: req.method,
        status_code: err.status,
        error: err,
      });
    }
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  console.error('unhandled_error', err);
  const errMsg = err instanceof Error ? err.message : String(err);
  logError({
    service: 'http_server',
    action: 'unhandled_error',
    message: errMsg,
    path: req.path,
    method: req.method,
    status_code: 500,
    error: err,
  });
  res.status(500).json({ error: 'internal_error' });
});

(async () => {
  await initSchema();
  app.listen(config.port, () => {
    console.log(`backend listening on :${config.port}`);
  });
})();
