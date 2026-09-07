import request from 'supertest';
import { createApp } from '../app';
import { createDatabase } from '../config/database';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';

describe('Sync API Integration Tests', () => {
  let db: Database.Database;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    // Usar base de datos en memoria fresca para aislar cada test
    db = createDatabase({ inMemory: true });
    app = createApp(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('GET /api/v1/sync/pull', () => {
    it('debería retornar el catálogo completo si no se envía last_sync', async () => {
      const response = await request(app).get('/api/v1/sync/pull');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('server_timestamp');
      expect(response.body.clients.length).toBe(3);
      expect(response.body.products.length).toBe(10);

      const firstProduct = response.body.products[0];
      expect(firstProduct).toHaveProperty('code');
      expect(firstProduct).toHaveProperty('price');
      expect(firstProduct).toHaveProperty('stock');
    });

    it('debería retornar solo registros con updated_at posterior a last_sync', async () => {
      // 1. Tomar un timestamp en el futuro respecto a la semilla
      const futureTimestamp = new Date(Date.now() + 100000).toISOString();
      const emptyRes = await request(app).get(`/api/v1/sync/pull?last_sync=${encodeURIComponent(futureTimestamp)}`);

      expect(emptyRes.status).toBe(200);
      expect(emptyRes.body.clients).toHaveLength(0);
      expect(emptyRes.body.products).toHaveLength(0);

      // 2. Insertar un nuevo producto con timestamp posterior
      const newProductTimestamp = new Date(Date.now() + 150000).toISOString();
      db.prepare(`
        INSERT INTO products (id, code, name, price, stock, is_active, updated_at)
        VALUES ('prod-new', 'NEW-001', 'Producto Nuevo Test', 3.50, 10, 1, ?)
      `).run(newProductTimestamp);

      const deltaRes = await request(app).get(`/api/v1/sync/pull?last_sync=${encodeURIComponent(futureTimestamp)}`);
      expect(deltaRes.status).toBe(200);
      expect(deltaRes.body.products).toHaveLength(1);
      expect(deltaRes.body.products[0].id).toBe('prod-new');
    });
  });

  describe('POST /api/v1/sync/push', () => {
    it('debería registrar un pedido nuevo y retornar status ACCEPTED', async () => {
      const clientOrderId = randomUUID();
      const orderPayload = {
        orders: [
          {
            client_order_id: clientOrderId,
            client_id: 'client-001',
            total_amount: 3.75,
            notes: 'Entregar por la mañana',
            created_at: new Date().toISOString(),
            items: [
              {
                product_id: 'prod-001',
                quantity: 3,
                unit_price: 1.25,
                subtotal: 3.75,
              },
            ],
          },
        ],
      };

      const response = await request(app)
        .post('/api/v1/sync/push')
        .send(orderPayload);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('server_timestamp');
      expect(response.body.results).toHaveLength(1);

      const result = response.body.results[0];
      expect(result.client_order_id).toBe(clientOrderId);
      expect(result.status).toBe('ACCEPTED');
      expect(result.server_order_id).toBeDefined();

      // Verificar persistencia en base de datos
      const savedOrder = db.prepare('SELECT * FROM orders WHERE client_order_id = ?').get(clientOrderId) as any;
      expect(savedOrder).toBeDefined();
      expect(savedOrder.total_amount).toBe(3.75);

      const savedItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(savedOrder.id);
      expect(savedItems).toHaveLength(1);
    });

    it('debería ser IDEMPOTENTE: enviar el mismo client_order_id dos veces no duplica y retorna ALREADY_PROCESSED', async () => {
      const clientOrderId = randomUUID();
      const orderPayload = {
        orders: [
          {
            client_order_id: clientOrderId,
            client_id: 'client-001',
            total_amount: 2.50,
            notes: 'Prueba idempotencia',
            created_at: new Date().toISOString(),
            items: [
              {
                product_id: 'prod-001',
                quantity: 2,
                unit_price: 1.25,
                subtotal: 2.50,
              },
            ],
          },
        ],
      };

      // Primer envío
      const firstRes = await request(app).post('/api/v1/sync/push').send(orderPayload);
      expect(firstRes.status).toBe(200);
      expect(firstRes.body.results[0].status).toBe('ACCEPTED');
      const initialServerId = firstRes.body.results[0].server_order_id;

      // Segundo envío idéntico (simulando reintento por timeout de red móvil)
      const secondRes = await request(app).post('/api/v1/sync/push').send(orderPayload);
      expect(secondRes.status).toBe(200);
      expect(secondRes.body.results[0].status).toBe('ALREADY_PROCESSED');
      expect(secondRes.body.results[0].server_order_id).toBe(initialServerId);

      // Verificar que sigue habiendo exactamente 1 registro en la base de datos
      const orderCount = db.prepare('SELECT COUNT(*) as count FROM orders WHERE client_order_id = ?').get(clientOrderId) as any;
      expect(orderCount.count).toBe(1);

      const itemsCount = db.prepare('SELECT COUNT(*) as count FROM order_items WHERE order_id = ?').get(initialServerId) as any;
      expect(itemsCount.count).toBe(1);
    });

    it('debería retornar 400 si el payload es inválido', async () => {
      const badPayload = {
        orders: [
          {
            client_order_id: 'no-es-un-uuid',
            client_id: '',
            total_amount: -10,
            items: [],
          },
        ],
      };

      const res = await request(app).post('/api/v1/sync/push').send(badPayload);
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'INVALID_PUSH_PAYLOAD');
    });
  });
});
