import Database from 'better-sqlite3';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool, types } = pg;
// Parse PostgreSQL numeric/decimal (OID 1700) as float
types.setTypeParser(1700, (val: string) => parseFloat(val));

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface IDatabaseClient {
  isPostgres: boolean;
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
  close(): Promise<void>;
}

export class PgDatabaseClient implements IDatabaseClient {
  public readonly isPostgres = true;
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
    const client = await this.pool.connect();
    try {
      const res = await client.query(sql, params);
      return {
        rows: res.rows as T[],
        rowCount: res.rowCount ?? res.rows.length,
      };
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

export class SqliteDatabaseClient implements IDatabaseClient {
  public readonly isPostgres = false;
  public readonly rawDb: Database.Database;

  constructor(db: Database.Database) {
    this.rawDb = db;
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
    // Transformar parámetros $1, $2 en ? para compatibilidad con SQLite
    const sqliteSql = sql.replace(/\$\d+/g, '?');
    const isSelect = /^\s*SELECT/i.test(sqliteSql);

    const stmt = this.rawDb.prepare(sqliteSql);
    if (isSelect) {
      const rows = stmt.all(...params) as T[];
      return {
        rows,
        rowCount: rows.length,
      };
    } else {
      const result = stmt.run(...params);
      return {
        rows: [],
        rowCount: result.changes,
      };
    }
  }

  public async close(): Promise<void> {
    this.rawDb.close();
  }
}

export interface DatabaseOptions {
  inMemory?: boolean;
  filePath?: string;
}

export function createDatabase(options: DatabaseOptions = {}): Database.Database {
  const dbPath = options.inMemory
    ? ':memory:'
    : options.filePath || path.resolve(process.cwd(), 'hiperstock.db');

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema(db);
  seedInitialData(db);

  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      identification TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      credit_limit REAL DEFAULT 0.0,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_clients_updated_at ON clients(updated_at);
    CREATE INDEX IF NOT EXISTS idx_clients_identification ON clients(identification);

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      stock REAL NOT NULL,
      is_active INTEGER DEFAULT 1,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at);
    CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      client_order_id TEXT UNIQUE NOT NULL,
      client_id TEXT NOT NULL,
      total_amount REAL NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'ACCEPTED',
      created_at TEXT NOT NULL,
      synced_at TEXT NOT NULL,
      FOREIGN KEY(client_id) REFERENCES clients(id)
    );

    CREATE INDEX IF NOT EXISTS idx_orders_client_order_id ON orders(client_order_id);

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id)
    );
  `);
}

function seedInitialData(db: Database.Database): void {
  const clientCount = db.prepare('SELECT COUNT(*) as count FROM clients').get() as { count: number };
  if (clientCount.count === 0) {
    const insertClient = db.prepare(`
      INSERT INTO clients (id, identification, name, address, phone, credit_limit, updated_at)
      VALUES (@id, @identification, @name, @address, @phone, @credit_limit, @updated_at)
    `);

    const now = new Date().toISOString();
    const seedClients = [
      {
        id: 'client-001',
        identification: '1790012345001',
        name: 'Comercial La Favorita S.A.',
        address: 'Av. Amazonas y Eloy Alfaro',
        phone: '0991234567',
        credit_limit: 5000.0,
        updated_at: now,
      },
      {
        id: 'client-002',
        identification: '1790098765001',
        name: 'Distribuidora del Norte Cía. Ltda.',
        address: 'Panamericana Norte Km 10',
        phone: '0987654321',
        credit_limit: 3500.0,
        updated_at: now,
      },
      {
        id: 'client-003',
        identification: '1712345678001',
        name: 'Minimarket Los Andes',
        address: 'Calle Guayaquil 456 y Rocafuerte',
        phone: '0978901234',
        credit_limit: 1200.0,
        updated_at: now,
      },
    ];

    for (const c of seedClients) {
      insertClient.run(c);
    }
  }

  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
  if (productCount.count === 0) {
    const insertProduct = db.prepare(`
      INSERT INTO products (id, code, name, price, stock, is_active, updated_at)
      VALUES (@id, @code, @name, @price, @stock, @is_active, @updated_at)
    `);

    const now = new Date().toISOString();
    const seedProducts = [
      {
        id: 'prod-001',
        code: 'BEB-001',
        name: 'Bebida Hidratante 500ml',
        price: 1.25,
        stock: 150.0,
        is_active: 1,
        updated_at: now,
      },
      {
        id: 'prod-002',
        code: 'SNK-001',
        name: 'Galletas de Avena y Miel 120g',
        price: 0.85,
        stock: 300.0,
        is_active: 1,
        updated_at: now,
      },
      {
        id: 'prod-003',
        code: 'LAC-001',
        name: 'Leche Entera Larga Vida 1L',
        price: 1.10,
        stock: 220.0,
        is_active: 1,
        updated_at: now,
      },
      {
        id: 'prod-004',
        code: 'ACE-001',
        name: 'Aceite Vegetal Puro 1L',
        price: 2.75,
        stock: 80.0,
        is_active: 1,
        updated_at: now,
      },
      {
        id: 'prod-005',
        code: 'ARR-001',
        name: 'Arroz Flor Especial 1kg',
        price: 1.45,
        stock: 250.0,
        is_active: 1,
        updated_at: now,
      },
      {
        id: 'prod-006',
        code: 'ATU-001',
        name: 'Atún en Lomitos en Aceite 160g',
        price: 1.60,
        stock: 180.0,
        is_active: 1,
        updated_at: now,
      },
      {
        id: 'prod-007',
        code: 'PAS-001',
        name: 'Pasta Espagueti 400g',
        price: 0.95,
        stock: 210.0,
        is_active: 1,
        updated_at: now,
      },
      {
        id: 'prod-008',
        code: 'BEB-002',
        name: 'Jugo de Naranja Natural 1L',
        price: 1.80,
        stock: 90.0,
        is_active: 1,
        updated_at: now,
      },
      {
        id: 'prod-009',
        code: 'LIM-001',
        name: 'Detergente en Polvo 1kg',
        price: 2.30,
        stock: 115.0,
        is_active: 1,
        updated_at: now,
      },
      {
        id: 'prod-010',
        code: 'SNK-002',
        name: 'Papas Fritas Clásicas 115g',
        price: 1.15,
        stock: 160.0,
        is_active: 1,
        updated_at: now,
      },
    ];

    for (const p of seedProducts) {
      insertProduct.run(p);
    }
  }
}

let defaultDbClientInstance: IDatabaseClient | null = null;

export function getDatabaseClient(): IDatabaseClient {
  if (defaultDbClientInstance) {
    return defaultDbClientInstance;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && databaseUrl.trim().length > 0) {
    console.log('[Database] Connecting to PostgreSQL (Supabase/Render) with SSL...');
    defaultDbClientInstance = new PgDatabaseClient(databaseUrl.trim());
  } else {
    console.log('[Database] DATABASE_URL not set. Falling back to local SQLite (hiperstock.db)...');
    defaultDbClientInstance = new SqliteDatabaseClient(createDatabase());
  }

  return defaultDbClientInstance;
}

// Instancia singleton por defecto para runtime
export const defaultDb = getDatabaseClient();
