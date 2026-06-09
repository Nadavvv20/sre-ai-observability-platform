import { Router } from 'express';
import { pool, withTransaction } from '../db.js';
import { requireAuth } from '../auth.js';
import { asyncHandler, HttpError, sleep } from '../util.js';
import { config } from '../config.js';
import { paymentDuration } from '../metrics.js';
import { logInfo, logError } from '../logger.js';

const router = Router();
router.use(requireAuth);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const start = Date.now();
    const { order_id, card_number } = (req.body ?? {}) as {
      order_id?: number;
      card_number?: string;
    };
    if (!order_id || !card_number) throw new HttpError(400, 'invalid_input');

    try {
      const [[order]] = await pool.execute<any[]>(
        'SELECT id, user_id, total_cents, status FROM orders WHERE id = ?',
        [order_id]
      );
      if (!order || (order as { user_id: number }).user_id !== req.user!.id) {
        throw new HttpError(404, 'order_not_found');
      }
      if ((order as { status: string }).status !== 'pending_payment') {
        throw new HttpError(
          409,
          'order_not_payable',
          `order is in status ${(order as { status: string }).status}`
        );
      }

      // Simulate calling out to a mock payment provider.
      const paymentStart = Date.now();
      const latency =
        config.paymentLatencyMsMin +
        Math.floor(Math.random() * (config.paymentLatencyMsMax - config.paymentLatencyMsMin));
      await sleep(latency);

      const failed = Math.random() < config.paymentFailureRate;
      const status = failed ? 'failed' : 'succeeded';
      const provider = 'mock-stripe';
      const orderId = (order as { id: number }).id;
      const totalCents = (order as { total_cents: number }).total_cents;

      // Track payment provider latency
      const paymentDurationSec = (Date.now() - paymentStart) / 1000;
      paymentDuration.observe({ status }, paymentDurationSec);

      await withTransaction(async (conn) => {
        await conn.execute(
          'INSERT INTO payments (order_id, status, provider, amount_cents) VALUES (?, ?, ?, ?)',
          [orderId, status, provider, totalCents]
        );
        await conn.execute('UPDATE orders SET status = ? WHERE id = ?', [
          failed ? 'payment_failed' : 'paid',
          orderId,
        ]);
      });

      if (failed) {
        logError({
          service: 'payment_gateway',
          action: 'process_payment',
          message: 'Payment declined by provider',
          user_id: req.user!.id,
          order_id: orderId,
          provider,
          latency_ms: Date.now() - start,
          error: new Error('payment_declined'),
        });
        throw new HttpError(402, 'payment_declined', 'mock provider declined the charge');
      }

      logInfo({
        service: 'payment_gateway',
        action: 'process_payment',
        message: 'Payment processed successfully',
        user_id: req.user!.id,
        order_id: orderId,
        amount_cents: totalCents,
        provider,
        latency_ms: Date.now() - start,
      });

      res.json({ order_id: orderId, status: 'paid', amount_cents: totalCents });
    } catch (error) {
      if (error instanceof HttpError && error.status >= 500) {
        logError({
          service: 'payment_gateway',
          action: 'process_payment',
          message: 'Payment processing failed',
          user_id: req.user!.id,
          order_id,
          error,
          latency_ms: Date.now() - start,
        });
      }
      throw error;
    }
  })
);

export default router;
