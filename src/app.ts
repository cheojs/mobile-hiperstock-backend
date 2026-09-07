import express, { Express } from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { SyncService } from './services/sync.service.js';
import { SyncController } from './controllers/sync.controller.js';
import { createSyncRouter } from './routes/sync.routes.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { renderOrdersHtml } from './views/ordersView.js';
import { IDatabaseClient, defaultDb } from './config/database.js';

export function createApp(db?: IDatabaseClient | Database.Database): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  const activeDb = db || defaultDb;
  const syncService = new SyncService(activeDb);
  const syncController = new SyncController(syncService);

  // Información del servicio
  app.get('/', (_req, res) => {
    res.status(200).json({
      name: 'HiperStock Sync Backend API',
      version: '1.0.0',
      status: 'ONLINE',
      environment: process.env.NODE_ENV || 'development',
      endpoints: {
        health: '/health',
        orders_view_html: '/orders-view',
        orders_api_json: '/api/v1/orders',
        sync_pull: '/api/v1/sync/pull',
        sync_push: '/api/v1/sync/push',
      },
    });
  });

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: process.env.DATABASE_URL ? 'postgresql' : 'sqlite',
    });
  });

  // Vista HTML con los pedidos recibidos ordenados por fecha descendente
  app.get('/orders-view', async (_req, res, next) => {
    try {
      const orders = await syncService.getAllOrders();
      const html = renderOrdersHtml(orders);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(html);
    } catch (err) {
      next(err);
    }
  });

  // Endpoint API JSON que lista los pedidos ordenados por fecha descendente
  app.get('/api/v1/orders', async (_req, res, next) => {
    try {
      const orders = await syncService.getAllOrders();
      res.status(200).json({
        total: orders.length,
        orders,
      });
    } catch (err) {
      next(err);
    }
  });

  app.use('/api/v1/sync', createSyncRouter(syncController));

  app.use(errorHandler);

  return app;
}
