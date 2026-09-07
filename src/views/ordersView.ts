export function renderOrdersHtml(orders: any[]): string {
  const totalAmount = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const totalItems = orders.reduce((sum, o) => sum + (o.items?.length || 0), 0);

  const rowsHtml = orders.length === 0
    ? `<tr>
        <td colspan="6" style="text-align: center; padding: 48px; color: #64748b;">
          <svg style="width: 48px; height: 48px; margin-bottom: 12px; color: #94a3b8;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
          </svg>
          <div style="font-size: 16px; font-weight: 600;">No se han recibido pedidos aún</div>
          <div style="font-size: 13px; margin-top: 4px;">Los pedidos sincronizados desde la app móvil aparecerán aquí automáticamente.</div>
        </td>
      </tr>`
    : orders.map((o, idx) => {
        const itemsHtml = o.items.map((it: any) => `
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; font-size: 13px;">
            <div>
              <span style="font-weight: 600; color: #1e293b;">${escapeHtml(it.product_name)}</span>
              <span style="background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 6px;">${escapeHtml(it.product_code)}</span>
            </div>
            <div style="color: #334155;">
              ${it.quantity} un. &times; $${Number(it.unit_price).toFixed(2)} = <strong>$${Number(it.subtotal).toFixed(2)}</strong>
            </div>
          </div>
        `).join('');

        const formattedDate = new Date(o.created_at).toLocaleString('es-EC', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });

        return `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 16px; vertical-align: top; font-weight: 600; color: #0f172a;">
              #${orders.length - idx}
              <div style="font-size: 11px; color: #64748b; font-family: monospace; font-weight: normal; margin-top: 4px;" title="${escapeHtml(o.id)}">
                ID: ${escapeHtml(o.client_order_id ? o.client_order_id.substring(0, 8) + '...' : o.id.substring(0, 8) + '...')}
              </div>
            </td>
            <td style="padding: 16px; vertical-align: top;">
              <div style="font-weight: 600; color: #1e293b;">${escapeHtml(o.client_name)}</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">RUC: ${escapeHtml(o.client_identification)} (ID: ${escapeHtml(o.client_id)})</div>
              ${o.notes ? `<div style="font-size: 12px; color: #0284c7; background: #f0f9ff; padding: 4px 8px; border-radius: 4px; margin-top: 6px; display: inline-block;">Nota: ${escapeHtml(o.notes)}</div>` : ''}
            </td>
            <td style="padding: 16px; vertical-align: top; font-size: 13px; color: #475569; white-space: nowrap;">
              ${formattedDate}
            </td>
            <td style="padding: 16px; vertical-align: top;">
              <span style="background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700; display: inline-block;">
                ${escapeHtml(o.status)}
              </span>
            </td>
            <td style="padding: 16px; vertical-align: top; min-width: 300px;">
              <div style="background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; padding: 10px;">
                <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">Ítems (${o.items.length})</div>
                ${itemsHtml}
              </div>
            </td>
            <td style="padding: 16px; vertical-align: top; text-align: right;">
              <div style="font-size: 18px; font-weight: 800; color: #0f172a;">
                $${Number(o.total_amount).toFixed(2)}
              </div>
            </td>
          </tr>
        `;
      }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HiperStock - Pedidos Recibidos</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      color: #1e293b;
      padding: 24px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }
    .title-group h1 {
      font-size: 26px;
      font-weight: 800;
      color: #0f172a;
    }
    .title-group p {
      color: #64748b;
      font-size: 14px;
      margin-top: 4px;
    }
    .actions {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }
    .btn-primary {
      background: #0284c7;
      color: white;
    }
    .btn-primary:hover {
      background: #0369a1;
    }
    .btn-secondary {
      background: #e2e8f0;
      color: #334155;
    }
    .btn-secondary:hover {
      background: #cbd5e1;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .stat-label {
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .stat-value {
      font-size: 28px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 8px;
    }
    .table-container {
      background: white;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      overflow-x: auto;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    th {
      background: #f1f5f9;
      padding: 14px 16px;
      font-size: 12px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #e2e8f0;
    }
    .badge-live {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #16a34a;
      font-weight: 600;
    }
    .badge-live::before {
      content: '';
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #16a34a;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(1.2); }
      100% { opacity: 1; transform: scale(1); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="title-group">
        <h1>HiperStock — Monitor de Pedidos</h1>
        <p>Visor en tiempo real de órdenes sincronizadas desde el canal móvil offline-first</p>
      </div>
      <div class="actions">
        <span class="badge-live">Servidor Online</span>
        <button class="btn btn-secondary" onclick="window.location.reload()">↻ Actualizar</button>
        <a class="btn btn-primary" href="/api/v1/orders" target="_blank">{ } API JSON</a>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Pedidos</div>
        <div class="stat-value">${orders.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Monto Total Facturado</div>
        <div class="stat-value" style="color: #0284c7;">$${totalAmount.toFixed(2)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Ítems Vendidos</div>
        <div class="stat-value" style="color: #16a34a;">${totalItems}</div>
      </div>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th># / ID</th>
            <th>Cliente</th>
            <th>Fecha Registro</th>
            <th>Estado</th>
            <th>Detalle de Productos</th>
            <th style="text-align: right;">Total ($)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
