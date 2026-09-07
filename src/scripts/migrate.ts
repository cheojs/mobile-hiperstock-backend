import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';

import { resolvePostgresConnectionString } from '../config/database.js';

dotenv.config();

const { Pool } = pg;

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  const sqlFilePath = path.resolve(process.cwd(), 'init-db.sql');

  if (!fs.existsSync(sqlFilePath)) {
    console.error(`[Migration Error] SQL file not found at: ${sqlFilePath}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

  if (databaseUrl && databaseUrl.trim().length > 0) {
    const { primary } = resolvePostgresConnectionString(databaseUrl);
    console.log(`====================================================`);
    console.log(`[Migration] Target: PostgreSQL (Supabase / Remote)`);
    console.log(`[Migration] SSL Mode: { rejectUnauthorized: false }`);
    console.log(`[Migration] Connecting to database endpoint...`);

    const pool = new Pool({
      connectionString: primary,
      ssl: {
        rejectUnauthorized: false,
      },
      connectionTimeoutMillis: 10000,
    });

    let client: pg.PoolClient | null = null;
    try {
      client = await pool.connect();
      console.log(`[Migration] Connected successfully to PostgreSQL.`);

      const versionRes = await client.query('SELECT version()');
      console.log(`[Migration] Database Version: ${versionRes.rows[0].version}`);

      console.log(`[Migration] Executing init-db.sql statements...`);
      await client.query(sqlContent);
      console.log(`[Migration] DDL and Seed statements applied without error.`);

      // Listar tablas y vistas en el esquema public
      const tablesRes = await client.query(`
        SELECT table_name, table_type 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
      `);

      console.log(`====================================================`);
      console.log(`[Migration Result] Tables and Views in 'public':`);
      for (const row of tablesRes.rows) {
        console.log(` - ${row.table_name} (${row.table_type})`);
      }

      // Conteo de registros
      const clientsCount = await client.query('SELECT COUNT(*) as count FROM clients');
      const productsCount = await client.query('SELECT COUNT(*) as count FROM products');
      const ordersCount = await client.query('SELECT COUNT(*) as count FROM orders');
      const itemsCount = await client.query('SELECT COUNT(*) as count FROM order_items');

      console.log(`----------------------------------------------------`);
      console.log(`[Migration Seed Status]:`);
      console.log(` - clients:     ${clientsCount.rows[0].count} rows`);
      console.log(` - products:    ${productsCount.rows[0].count} rows`);
      console.log(` - orders:      ${ordersCount.rows[0].count} rows`);
      console.log(` - order_items: ${itemsCount.rows[0].count} rows`);
      console.log(`====================================================`);
      console.log(`[Migration] SUCCESS! Remote Supabase database is 100% ready.`);
    } catch (err: any) {
      console.error(`====================================================`);
      console.error(`[Migration FAILED] Detailed Error Information:`);
      console.error(` - Message:  ${err.message}`);
      if (err.code) console.error(` - Code:     ${err.code}`);
      if (err.detail) console.error(` - Detail:   ${err.detail}`);
      if (err.hint) console.error(` - Hint:     ${err.hint}`);
      if (err.position) console.error(` - Position: ${err.position}`);
      if (err.stack) console.error(` - Stack:\n${err.stack}`);
      console.error(`====================================================`);
      process.exit(1);
    } finally {
      if (client) client.release();
      await pool.end();
    }
  } else {
    console.log(`[Migration] DATABASE_URL not detected.`);
    console.log(`[Migration] Target: Local SQLite (hiperstock.db)`);

    const dbPath = path.resolve(process.cwd(), 'hiperstock.db');
    const db = new Database(dbPath);

    try {
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');

      const sqliteSql = sqlContent
        .replace(/TIMESTAMP WITH TIME ZONE/gi, 'TEXT')
        .replace(/NUMERIC\(\d+,\s*\d+\)/gi, 'REAL')
        .replace(/BOOLEAN/gi, 'INTEGER')
        .replace(/TRUE/gi, '1')
        .replace(/FALSE/gi, '0')
        .replace(/CREATE OR REPLACE VIEW customers/gi, 'CREATE VIEW IF NOT EXISTS customers');

      db.exec(sqliteSql);

      const clientsCount = db.prepare('SELECT COUNT(*) as count FROM clients').get() as { count: number };
      const productsCount = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };

      console.log(`[Migration] Local SQLite database verified:`);
      console.log(` - Total clients:  ${clientsCount.count}`);
      console.log(` - Total products: ${productsCount.count}`);
      console.log(`[Migration] SUCCESS! Local database is ready.`);
    } catch (err: any) {
      console.error(`[Migration Failed] ${err.message}`);
      process.exit(1);
    } finally {
      db.close();
    }
  }
}

runMigration().catch((err) => {
  console.error('[Fatal Error]', err);
  process.exit(1);
});
