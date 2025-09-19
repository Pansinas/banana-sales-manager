const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));

// PostgreSQL connection pool
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'banana_sales',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});

// WebSocket connections for real-time sync
const clients = new Set();

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');
  clients.add(ws);
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'register_device') {
        ws.deviceId = data.deviceId;
        await registerDevice(data.deviceId, data.deviceName, data.deviceType);
        ws.send(JSON.stringify({ type: 'device_registered', deviceId: data.deviceId }));
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket connection closed');
    clients.delete(ws);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Broadcast function for real-time updates
function broadcast(data, excludeDeviceId = null) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client.deviceId !== excludeDeviceId) {
      client.send(message);
    }
  });
}

// Database helper functions
async function registerDevice(deviceId, deviceName = null, deviceType = 'unknown') {
  const query = 'SELECT register_device($1, $2, $3, $4)';
  const values = [deviceId, deviceName, deviceType, null];
  
  try {
    await pool.query(query, values);
    console.log(`Device registered: ${deviceId}`);
  } catch (error) {
    console.error('Error registering device:', error);
    throw error;
  }
}

async function logSyncOperation(deviceId, operationType, tableName, recordId, oldData = null, newData = null) {
  const query = `
    INSERT INTO sync_log (device_id, operation_type, table_name, record_id, old_data, new_data)
    VALUES ($1, $2, $3, $4, $5, $6)
  `;
  const values = [deviceId, operationType, tableName, recordId, oldData, newData];
  
  try {
    await pool.query(query, values);
  } catch (error) {
    console.error('Error logging sync operation:', error);
  }
}

// API Routes

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      timestamp: result.rows[0].now,
      connections: pool.totalCount
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      database: 'disconnected',
      error: error.message 
    });
  }
});

// Get all sales
app.get('/api/sales', async (req, res) => {
  try {
    const { limit = 100, offset = 0, device_id } = req.query;
    
    let query = `
      SELECT s.*, d.device_name, d.device_type
      FROM active_sales s
      LEFT JOIN devices d ON s.device_id = d.device_id
      ORDER BY s.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const values = [parseInt(limit), parseInt(offset)];
    
    if (device_id) {
      query = `
        SELECT s.*, d.device_name, d.device_type
        FROM active_sales s
        LEFT JOIN devices d ON s.device_id = d.device_id
        WHERE s.device_id = $3
        ORDER BY s.created_at DESC
        LIMIT $1 OFFSET $2
      `;
      values.push(device_id);
    }
    
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get sales summary
app.get('/api/sales/summary', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sales_summary');
    res.json(result.rows[0] || {});
  } catch (error) {
    console.error('Error fetching sales summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new sale
app.post('/api/sales', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const {
      product = 'Bananas',
      quantity,
      price,
      total,
      customer,
      notes = '',
      payment_status = 'pending',
      payment_method = '',
      amount_received = 0,
      device_id
    } = req.body;
    
    // Validate required fields
    if (!quantity || !price || !total || !customer || !device_id) {
      return res.status(400).json({ 
        error: 'Missing required fields: quantity, price, total, customer, device_id' 
      });
    }
    
    // Register device if not exists
    await registerDevice(device_id);
    
    const query = `
      INSERT INTO sales (
        product, quantity, price, total, customer, notes,
        payment_status, payment_method, amount_received, device_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    
    const values = [
      product, quantity, price, total, customer, notes,
      payment_status, payment_method, amount_received, device_id
    ];
    
    const result = await client.query(query, values);
    const newSale = result.rows[0];
    
    // Log the operation
    await logSyncOperation(device_id, 'create', 'sales', newSale.id, null, newSale);
    
    await client.query('COMMIT');
    
    // Broadcast to other devices
    broadcast({
      type: 'sale_created',
      data: newSale
    }, device_id);
    
    res.status(201).json(newSale);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating sale:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Update sale
app.put('/api/sales/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const {
      product,
      quantity,
      price,
      total,
      customer,
      notes,
      payment_status,
      payment_method,
      amount_received,
      device_id,
      version
    } = req.body;
    
    if (!device_id) {
      return res.status(400).json({ error: 'device_id is required' });
    }
    
    // Get current record for optimistic locking
    const currentResult = await client.query(
      'SELECT * FROM sales WHERE id = $1 AND is_deleted = FALSE',
      [id]
    );
    
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    
    const currentSale = currentResult.rows[0];
    
    // Check version for optimistic locking
    if (version && currentSale.version !== version) {
      return res.status(409).json({ 
        error: 'Conflict detected',
        current_version: currentSale.version,
        provided_version: version
      });
    }
    
    const query = `
      UPDATE sales
      SET 
        product = COALESCE($2, product),
        quantity = COALESCE($3, quantity),
        price = COALESCE($4, price),
        total = COALESCE($5, total),
        customer = COALESCE($6, customer),
        notes = COALESCE($7, notes),
        payment_status = COALESCE($8, payment_status),
        payment_method = COALESCE($9, payment_method),
        amount_received = COALESCE($10, amount_received),
        device_id = $11,
        sync_status = 'pending'
      WHERE id = $1 AND is_deleted = FALSE
      RETURNING *
    `;
    
    const values = [
      id, product, quantity, price, total, customer, notes,
      payment_status, payment_method, amount_received, device_id
    ];
    
    const result = await client.query(query, values);
    const updatedSale = result.rows[0];
    
    // Log the operation
    await logSyncOperation(device_id, 'update', 'sales', id, currentSale, updatedSale);
    
    await client.query('COMMIT');
    
    // Broadcast to other devices
    broadcast({
      type: 'sale_updated',
      data: updatedSale
    }, device_id);
    
    res.json(updatedSale);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating sale:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Delete sale (soft delete)
app.delete('/api/sales/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { device_id } = req.body;
    
    if (!device_id) {
      return res.status(400).json({ error: 'device_id is required' });
    }
    
    const result = await client.query(
      'SELECT soft_delete_sale($1, $2)',
      [id, device_id]
    );
    
    if (!result.rows[0].soft_delete_sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    
    // Log the operation
    await logSyncOperation(device_id, 'delete', 'sales', id);
    
    await client.query('COMMIT');
    
    // Broadcast to other devices
    broadcast({
      type: 'sale_deleted',
      data: { id, device_id }
    }, device_id);
    
    res.json({ success: true, message: 'Sale deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting sale:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Get pending sync items
app.get('/api/sync/pending', async (req, res) => {
  try {
    const { device_id } = req.query;
    
    let query = 'SELECT * FROM pending_sync';
    const values = [];
    
    if (device_id) {
      query += ' WHERE device_id != $1';
      values.push(device_id);
    }
    
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching pending sync:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark items as synced
app.post('/api/sync/mark-synced', async (req, res) => {
  try {
    const { sale_ids } = req.body;
    
    if (!Array.isArray(sale_ids) || sale_ids.length === 0) {
      return res.status(400).json({ error: 'sale_ids array is required' });
    }
    
    const query = `
      UPDATE sales
      SET sync_status = 'synced', last_sync_at = CURRENT_TIMESTAMP
      WHERE id = ANY($1::uuid[])
      RETURNING id
    `;
    
    const result = await pool.query(query, [sale_ids]);
    res.json({ synced_count: result.rows.length });
  } catch (error) {
    console.error('Error marking as synced:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get conflicts
app.get('/api/conflicts', async (req, res) => {
  try {
    const query = `
      SELECT * FROM conflicts
      WHERE is_resolved = FALSE
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching conflicts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Resolve conflict
app.post('/api/conflicts/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { strategy = 'last_write_wins' } = req.body;
    
    if (strategy === 'last_write_wins') {
      const result = await pool.query(
        'SELECT resolve_conflict_last_write_wins($1)',
        [id]
      );
      
      if (result.rows[0].resolve_conflict_last_write_wins) {
        res.json({ success: true, message: 'Conflict resolved successfully' });
      } else {
        res.status(404).json({ error: 'Conflict not found' });
      }
    } else {
      res.status(400).json({ error: 'Unsupported resolution strategy' });
    }
  } catch (error) {
    console.error('Error resolving conflict:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get devices
app.get('/api/devices', async (req, res) => {
  try {
    const query = `
      SELECT device_id, device_name, device_type, last_seen_at, is_active
      FROM devices
      ORDER BY last_seen_at DESC
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync endpoint for bulk operations
app.post('/api/sync', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { device_id, operations } = req.body;
    
    if (!device_id || !Array.isArray(operations)) {
      return res.status(400).json({ error: 'device_id and operations array are required' });
    }
    
    const results = [];
    
    for (const operation of operations) {
      const { type, data } = operation;
      
      switch (type) {
        case 'create':
          const createQuery = `
            INSERT INTO sales (
              product, quantity, price, total, customer, notes,
              payment_status, payment_method, amount_received, device_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
          `;
          
          const createValues = [
            data.product || 'Bananas', data.quantity, data.price, data.total,
            data.customer, data.notes || '', data.payment_status || 'pending',
            data.payment_method || '', data.amount_received || 0, device_id
          ];
          
          const createResult = await client.query(createQuery, createValues);
          results.push({ type: 'create', success: true, data: createResult.rows[0] });
          break;
          
        case 'update':
          // Similar implementation for update
          break;
          
        case 'delete':
          const deleteResult = await client.query(
            'SELECT soft_delete_sale($1, $2)',
            [data.id, device_id]
          );
          results.push({ type: 'delete', success: deleteResult.rows[0].soft_delete_sale });
          break;
      }
    }
    
    await client.query('COMMIT');
    res.json({ results });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in bulk sync:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  
  // Close WebSocket server
  wss.close(() => {
    console.log('WebSocket server closed');
  });
  
  // Close database pool
  await pool.end();
  console.log('Database pool closed');
  
  // Close HTTP server
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready for real-time sync`);
});

module.exports = { app, server, pool };