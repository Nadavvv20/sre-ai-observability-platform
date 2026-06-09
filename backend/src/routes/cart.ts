import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import { asyncHandler, HttpError } from '../util.js';
import { cartAddErrorsTotal } from '../metrics.js';
import { logInfo, logError } from '../logger.js';

const router = Router();
router.use(requireAuth);

async function getOrCreateCart(userId: number): Promise<{ id: number }> {
  const [[cart]] = await pool.execute<any[]>(
    'SELECT id FROM carts WHERE user_id = ?',
    [userId]
  );
  if (cart) return cart as { id: number };
  const [result] = await pool.execute<any>(
    'INSERT INTO carts (user_id) VALUES (?)',
    [userId]
  );
  return { id: (result as { insertId: number }).insertId };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const cart = await getOrCreateCart(req.user!.id);
    const [items] = await pool.execute<any[]>(
      `
      SELECT ci.product_id, ci.quantity, p.name, p.sku, p.price_cents, p.stock
      FROM cart_items ci
      JOIN products p ON p.id = ci.product_id
      WHERE ci.cart_id = ?
      `,
      [cart.id]
    );
    const total_cents = (items as Array<{ price_cents: number; quantity: number }>)
      .reduce((acc, it) => acc + it.price_cents * it.quantity, 0);
    res.json({ items, total_cents });
  })
);

router.post(
  '/items',
  asyncHandler(async (req, res) => {
    const start = Date.now();
    const { product_id, quantity = 1 } = (req.body ?? {}) as {
      product_id?: number;
      quantity?: number;
    };
    if (!product_id || quantity <= 0) throw new HttpError(400, 'invalid_input');

    try {
      const [[product]] = await pool.execute<any[]>(
        'SELECT id, stock FROM products WHERE id = ?',
        [product_id]
      );
      if (!product) throw new HttpError(404, 'product_not_found');
      if ((product as { stock: number }).stock < quantity) {
        throw new HttpError(409, 'insufficient_stock');
      }

      const cart = await getOrCreateCart(req.user!.id);

      const [[existing]] = await pool.execute<any[]>(
        'SELECT quantity FROM cart_items WHERE cart_id = ? AND product_id = ?',
        [cart.id, product_id]
      );
      if (existing) {
        await pool.execute(
          'UPDATE cart_items SET quantity = quantity + ? WHERE cart_id = ? AND product_id = ?',
          [quantity, cart.id, product_id]
        );
      } else {
        await pool.execute(
          'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)',
          [cart.id, product_id, quantity]
        );
      }
      
      const duration = Date.now() - start;
      logInfo({
        service: 'cart',
        action: 'add_to_cart',
        message: 'Item added to cart successfully',
        user_id: req.user!.id,
        product_id,
        quantity,
        latency_ms: duration,
      });
      
      res.status(201).json({ ok: true });
    } catch (error) {
      const duration = Date.now() - start;
      
      // Track 5xx errors
      if (error instanceof HttpError && error.status >= 500) {
        cartAddErrorsTotal.inc({ error_type: error.code });
        
        logError({
          service: 'cart',
          action: 'add_to_cart',
          message: 'Failed to add item to cart',
          user_id: req.user!.id,
          product_id,
          error,
          latency_ms: duration,
        });
      }
      
      throw error;
    }
  })
);

router.delete(
  '/items/:productId',
  asyncHandler(async (req, res) => {
    const cart = await getOrCreateCart(req.user!.id);
    await pool.execute(
      'DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?',
      [cart.id, req.params['productId']!]
    );
    res.json({ ok: true });
  })
);

export default router;
