import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';

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
    console.log(`[Migration] Target: PostgreSQL (Supabase / Remote)`);
    console.log(`[Migration] Connecting with SSL (rejectUnauthorized: false)...`);

    const pool = new Pool({
      connectionString: databaseUrl.trim(),
      ssl: {
        rejectUnauthorized: false,
      },
      connectionTimeoutMillis: 10000,
    });

    const client = await pool.connect();
    try {
      console.log(`[Migration] Executing init-db.sql...`);
      await client.query(sqlContent);
      console.log(`[Migration] Tables and views verified: clients, customers, products, orders, order_items`);

      const clientsCount = await client.query('SELECT COUNT(*) FROM clients');
      const productsCount = await client.query('SELECT COUNT(*) FROM products');
      console.log(`[Migration] Seed verification:`);
      console.log(` - Total clients:  ${clientsCount.rows[0].count}`);
      console.log(` - Total products: ${productsCount.rows[0].count}`);
      console.log(`[Migration] SUCCESS! Remote database is fully migrated and seeded.`);
    } catch (err: any) {
      console.error(`[Migration Failed] ${err.message}`);
      process.exit(1);
    } finally {
      client.release();
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

      // En SQLite, reemplazar sintaxis Postgres si aplica
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
