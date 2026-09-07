-- =====================================================================
-- Esquema de Base de Datos para Preventa Offline-First (HiperStock)
-- Compatible con PostgreSQL y SQLite
-- =====================================================================

-- 1. Tabla de Clientes
CREATE TABLE IF NOT EXISTS clients (
    id VARCHAR(36) PRIMARY KEY,
    identification VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    credit_limit NUMERIC(12, 2) DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_clients_updated_at ON clients(updated_at);
CREATE INDEX IF NOT EXISTS idx_clients_identification ON clients(identification);

-- 2. Tabla de Productos (Catálogo)
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    price NUMERIC(12, 2) NOT NULL,
    stock NUMERIC(12, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);

-- 3. Tabla de Pedidos (Ventas Sincronizadas)
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(36) PRIMARY KEY,
    client_order_id VARCHAR(36) UNIQUE NOT NULL,
    client_id VARCHAR(36) NOT NULL REFERENCES clients(id),
    total_amount NUMERIC(12, 2) NOT NULL,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACCEPTED',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    synced_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_client_order_id ON orders(client_order_id);

-- 4. Tabla de Items de Pedido
CREATE TABLE IF NOT EXISTS order_items (
    id VARCHAR(36) PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(36) NOT NULL REFERENCES products(id),
    quantity NUMERIC(12, 2) NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- =====================================================================
-- SEED DE DATOS INICIALES (3 Clientes y 10 Productos)
-- =====================================================================

-- Clientes
INSERT INTO clients (id, identification, name, address, phone, credit_limit, updated_at)
VALUES 
('client-001', '1790012345001', 'Comercial La Favorita S.A.', 'Av. Amazonas y Eloy Alfaro', '0991234567', 5000.00, CURRENT_TIMESTAMP),
('client-002', '1790098765001', 'Distribuidora del Norte Cía. Ltda.', 'Panamericana Norte Km 10', '0987654321', 3500.00, CURRENT_TIMESTAMP),
('client-003', '1712345678001', 'Minimarket Los Andes', 'Calle Guayaquil 456 y Rocafuerte', '0978901234', 1200.00, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Productos
INSERT INTO products (id, code, name, price, stock, is_active, updated_at)
VALUES
('prod-001', 'BEB-001', 'Bebida Hidratante 500ml', 1.25, 150.00, TRUE, CURRENT_TIMESTAMP),
('prod-002', 'SNK-001', 'Galletas de Avena y Miel 120g', 0.85, 300.00, TRUE, CURRENT_TIMESTAMP),
('prod-003', 'LAC-001', 'Leche Entera Larga Vida 1L', 1.10, 220.00, TRUE, CURRENT_TIMESTAMP),
('prod-004', 'ACE-001', 'Aceite Vegetal Puro 1L', 2.75, 80.00, TRUE, CURRENT_TIMESTAMP),
('prod-005', 'ARR-001', 'Arroz Flor Especial 1kg', 1.45, 250.00, TRUE, CURRENT_TIMESTAMP),
('prod-006', 'ATU-001', 'Atún en Lomitos en Aceite 160g', 1.60, 180.00, TRUE, CURRENT_TIMESTAMP),
('prod-007', 'PAS-001', 'Pasta Espagueti 400g', 0.95, 210.00, TRUE, CURRENT_TIMESTAMP),
('prod-008', 'BEB-002', 'Jugo de Naranja Natural 1L', 1.80, 90.00, TRUE, CURRENT_TIMESTAMP),
('prod-009', 'LIM-001', 'Detergente en Polvo 1kg', 2.30, 115.00, TRUE, CURRENT_TIMESTAMP),
('prod-010', 'SNK-002', 'Papas Fritas Clásicas 115g', 1.15, 160.00, TRUE, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;
