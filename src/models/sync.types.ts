export interface ClientRecord {
  id: string;
  identification: string;
  name: string;
  address: string | null;
  phone: string | null;
  credit_limit: number;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProductRecord {
  id: string;
  code: string;
  name: string;
  price: number;
  stock: number;
  is_active: number;
  updated_at: string;
  deleted_at: string | null;
}

export interface PushOrderItemPayload {
  id?: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface PushOrderPayload {
  client_order_id: string;
  client_id: string;
  total_amount: number;
  notes?: string | null;
  created_at: string;
  items: PushOrderItemPayload[];
}

export interface PushResultItem {
  client_order_id: string;
  server_order_id: string;
  status: 'ACCEPTED' | 'ALREADY_PROCESSED' | 'REJECTED';
  message: string;
}

export interface PullResponse {
  server_timestamp: string;
  clients: ClientRecord[];
  products: ProductRecord[];
}

export interface PushResponse {
  server_timestamp: string;
  results: PushResultItem[];
}
