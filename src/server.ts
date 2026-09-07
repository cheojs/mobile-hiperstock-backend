import { createApp } from './app.js';
import { defaultDb } from './config/database.js';

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const app = createApp(defaultDb);

const server = app.listen(PORT, HOST, () => {
  const dbType = process.env.DATABASE_URL ? 'PostgreSQL (Supabase/Remote)' : 'SQLite (Local)';
  console.log(`====================================================`);
  console.log(`[HiperStock Backend] Server running on http://${HOST}:${PORT}`);
  console.log(`[Environment] Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[Database] Engine: ${dbType}`);
  console.log(`[Endpoints]:`);
  console.log(` - Health check:  GET  http://${HOST}:${PORT}/health`);
  console.log(` - Web Monitor:   GET  http://${HOST}:${PORT}/orders-view`);
  console.log(` - Sync Pull:     GET  http://${HOST}:${PORT}/api/v1/sync/pull?last_sync=...`);
  console.log(` - Sync Push:     POST http://${HOST}:${PORT}/api/v1/sync/push`);
  console.log(`====================================================`);
});

// Manejo de señales para cierre limpio (Render / Docker)
process.on('SIGTERM', () => {
  console.log('[HiperStock Backend] SIGTERM received, closing server...');
  server.close(() => {
    console.log('[HiperStock Backend] HTTP server closed.');
    process.exit(0);
  });
});
