import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { SyncService } from '../services/sync.service.js';

const pullQuerySchema = z.object({
  last_sync: z.string().datetime().optional().or(z.string().length(0).optional()),
  salesperson_id: z.string().optional(),
});

const pushOrderItemSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().min(1, 'product_id is required'),
  quantity: z.number().positive('quantity must be greater than 0'),
  unit_price: z.number().nonnegative('unit_price cannot be negative'),
  subtotal: z.number().nonnegative('subtotal cannot be negative'),
});

const pushOrderSchema = z.object({
  client_order_id: z.string().uuid('client_order_id must be a valid UUID'),
  client_id: z.string().min(1, 'client_id is required'),
  total_amount: z.number().nonnegative('total_amount cannot be negative'),
  notes: z.string().nullable().optional(),
  created_at: z.string().datetime('created_at must be an ISO datetime string'),
  items: z.array(pushOrderItemSchema).min(1, 'Order must contain at least one item'),
});

const pushBodySchema = z.object({
  orders: z.array(pushOrderSchema).min(1, 'Payload must contain at least one order'),
});

export class SyncController {
  constructor(private syncService: SyncService) {}

  public pull = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = pullQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          error: 'INVALID_QUERY_PARAMETERS',
          details: parsed.error.format(),
        });
        return;
      }

      const lastSync = parsed.data.last_sync ? parsed.data.last_sync : undefined;
      const result = await this.syncService.getPullDelta(lastSync);

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  public push = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = pushBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'INVALID_PUSH_PAYLOAD',
          details: parsed.error.format(),
        });
        return;
      }

      const result = await this.syncService.processPushOrders(parsed.data.orders);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
