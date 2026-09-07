import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import {
  ClientRecord,
  ProductRecord,
  PullResponse,
  PushOrderPayload,
  PushResponse,
  PushResultItem,
} from '../models/sync.types.js';
import { IDatabaseClient, SqliteDatabaseClient } from '../config/database.js';

export class SyncService {
  private db: IDatabaseClient;

  constructor(db: IDatabaseClient | Database.Database) {
    if ('rawDb' in db || 'isPostgres' in db) {
      this.db = db as IDatabaseClient;
    } else {
      this.db = new SqliteDatabaseClient(db as Database.Database);
    }
  }

  public async getPullDelta(sinceTimestamp?: string): Promise<PullResponse> {
    const serverTimestamp = new Date().toISOString();

    let clientsRows: any[];
    let productsRows: any[];

    if (sinceTimestamp) {
      const clientsRes = await this.db.query(
        'SELECT * FROM clients WHERE updated_at > $1 ORDER BY updated_at ASC',
        [sinceTimestamp]
      );
      clientsRows = clientsRes.rows;

      const productsRes = await this.db.query(
        'SELECT * FROM products WHERE updated_at > $1 ORDER BY updated_at ASC',
        [sinceTimestamp]
      );
      productsRows = productsRes.rows;
    } else {
      const clientsRes = await this.db.query(
        'SELECT * FROM clients ORDER BY updated_at ASC'
      );
      clientsRows = clientsRes.rows;

      const productsRes = await this.db.query(
        'SELECT * FROM products ORDER BY updated_at ASC'
      );
      productsRows = productsRes.rows;
    }

    const clients: ClientRecord[] = clientsRows.map((c) => ({
      id: c.id,
      identification: c.identification,
      name: c.name,
      address: c.address ?? null,
      phone: c.phone ?? null,
      credit_limit: Number(c.credit_limit) || 0.0,
      updated_at: typeof c.updated_at === 'object' && c.updated_at ? c.updated_at.toISOString() : String(c.updated_at),
      deleted_at: c.deleted_at
        ? typeof c.deleted_at === 'object'
          ? c.deleted_at.toISOString()
          : String(c.deleted_at)
        : null,
    }));

    const products: ProductRecord[] = productsRows.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      price: Number(p.price) || 0.0,
      stock: Number(p.stock) || 0.0,
      is_active: p.is_active === true || p.is_active === 1 || p.is_active === '1' ? 1 : 0,
      updated_at: typeof p.updated_at === 'object' && p.updated_at ? p.updated_at.toISOString() : String(p.updated_at),
      deleted_at: p.deleted_at
        ? typeof p.deleted_at === 'object'
          ? p.deleted_at.toISOString()
          : String(p.deleted_at)
        : null,
    }));

    return {
      server_timestamp: serverTimestamp,
      clients,
      products,
    };
  }

  public async processPushOrders(orders: PushOrderPayload[]): Promise<PushResponse> {
    const serverTimestamp = new Date().toISOString();
    const results: PushResultItem[] = [];

    for (const order of orders) {
      try {
        // Validación de cliente existente
        const clientRes = await this.db.query('SELECT id FROM clients WHERE id = $1', [order.client_id]);
        if (clientRes.rows.length === 0) {
          results.push({
            client_order_id: order.client_order_id,
            server_order_id: '',
            status: 'REJECTED',
            message: `Client ${order.client_id} does not exist.`,
          });
          continue;
        }

        // Inserción atómica con ON CONFLICT (client_order_id) DO NOTHING
        const serverOrderId = randomUUID();
        const insertOrderRes = await this.db.query(
          `INSERT INTO orders (id, client_order_id, client_id, total_amount, notes, status, created_at, synced_at)
           VALUES ($1, $2, $3, $4, $5, 'ACCEPTED', $6, $7)
           ON CONFLICT (client_order_id) DO NOTHING`,
          [
            serverOrderId,
            order.client_order_id,
            order.client_id,
            order.total_amount,
            order.notes || null,
            order.created_at,
            serverTimestamp,
          ]
        );

        if (insertOrderRes.rowCount === 0) {
          // Ya existía (idempotencia)
          const existingRes = await this.db.query(
            'SELECT id, client_order_id, status FROM orders WHERE client_order_id = $1',
            [order.client_order_id]
          );
          const existing = existingRes.rows[0];

          results.push({
            client_order_id: order.client_order_id,
            server_order_id: existing ? existing.id : '',
            status: 'ALREADY_PROCESSED',
            message: 'Order was already processed previously (idempotent ON CONFLICT).',
          });
          continue;
        }

        // Inserción de items con ON CONFLICT (id) DO NOTHING
        for (const item of order.items) {
          const itemId = item.id || randomUUID();
          await this.db.query(
            `INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, subtotal)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO NOTHING`,
            [
              itemId,
              serverOrderId,
              item.product_id,
              item.quantity,
              item.unit_price,
              item.subtotal,
            ]
          );
        }

        results.push({
          client_order_id: order.client_order_id,
          server_order_id: serverOrderId,
          status: 'ACCEPTED',
          message: 'Order created and synced successfully.',
        });
      } catch (err: any) {
        results.push({
          client_order_id: order.client_order_id,
          server_order_id: '',
          status: 'REJECTED',
          message: err.message || 'Failed to process order.',
        });
      }
    }

    return {
      server_timestamp: serverTimestamp,
      results,
    };
  }

  public async getAllOrders() {
    const ordersRes = await this.db.query(`
      SELECT 
        o.id,
        o.client_order_id,
        o.client_id,
        COALESCE(c.name, 'Cliente no registrado') as client_name,
        COALESCE(c.identification, 'S/N') as client_identification,
        o.total_amount,
        o.notes,
        o.status,
        o.created_at,
        o.synced_at
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      ORDER BY o.created_at DESC
    `);

    const orders = ordersRes.rows;
    const populatedOrders = [];

    for (const order of orders) {
      const itemsRes = await this.db.query(
        `SELECT 
          oi.id,
          oi.product_id,
          COALESCE(p.code, 'S/C') as product_code,
          COALESCE(p.name, 'Producto no registrado') as product_name,
          oi.quantity,
          oi.unit_price,
          oi.subtotal
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1`,
        [order.id]
      );

      populatedOrders.push({
        ...order,
        total_amount: Number(order.total_amount) || 0.0,
        items: itemsRes.rows.map((item: any) => ({
          ...item,
          quantity: Number(item.quantity) || 0.0,
          unit_price: Number(item.unit_price) || 0.0,
          subtotal: Number(item.subtotal) || 0.0,
        })),
      });
    }

    return populatedOrders;
  }
}
