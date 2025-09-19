const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Enhanced WebSocket server with performance optimizations
const wss = new WebSocket.Server({ 
  server,
  perMessageDeflate: {
    zlibDeflateOptions: {
      level: 3, // Balanced compression
      chunkSize: 1024,
    },
    threshold: 1024, // Only compress messages > 1KB
    concurrencyLimit: 10,
    clientMaxWindowBits: 13, // Value must be between 8 and 15
    serverMaxWindowBits: 13,
    serverMaxNoContextTakeover: false,
    clientMaxNoContextTakeover: false,
  },
  maxPayload: 16 * 1024 * 1024, // 16MB max payload
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));

// Performance monitoring middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  const clientIP = req.ip || req.connection.remoteAddress;
  
  // Rate limiting for API endpoints
  const rateLimitResult = rateLimiter.isAllowed(clientIP, req.path);
  
  if (!rateLimitResult.allowed) {
    console.warn(`⚠️ API rate limit exceeded for ${clientIP} on ${req.path}`);
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests, please slow down',
      resetTime: rateLimitResult.resetTime,
      violations: rateLimitResult.violations
    });
  }
  
  // Add rate limit headers
  res.set({
    'X-RateLimit-Remaining': rateLimitResult.remaining,
    'X-RateLimit-Violations': rateLimitResult.violations
  });
  
  // Override res.json to capture response time
  const originalJson = res.json;
  res.json = function(data) {
    const responseTime = Date.now() - startTime;
    performanceMonitor.recordRequest(res.statusCode < 400, responseTime);
    
    // Add performance headers
    res.set({
      'X-Response-Time': `${responseTime}ms`,
      'X-Server-ID': process.env.SERVER_ID || 'default'
    });
    
    return originalJson.call(this, data);
  };
  
  next();
});

// PostgreSQL connection pool with enhanced error handling
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

// Enhanced database error handling
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

pool.on('connect', (client) => {
  console.log('New client connected to database');
});

pool.on('acquire', (client) => {
  console.log('Client acquired from pool');
});

pool.on('remove', (client) => {
  console.log('Client removed from pool');
});

// Rate Limiting Class for high traffic management
class RateLimiter {
  constructor() {
    this.clients = new Map(); // clientId -> { requests: [], lastReset: timestamp }
    this.maxRequestsPerMinute = 60;
    this.maxRequestsPerSecond = 10;
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Cleanup every minute
  }

  isAllowed(clientId, endpoint = 'default') {
    const now = Date.now();
    const clientKey = `${clientId}_${endpoint}`;
    
    if (!this.clients.has(clientKey)) {
      this.clients.set(clientKey, { 
        requests: [now], 
        lastReset: now,
        violations: 0
      });
      return { allowed: true, remaining: this.maxRequestsPerMinute - 1 };
    }

    const client = this.clients.get(clientKey);
    
    // Remove requests older than 1 minute
    const oneMinuteAgo = now - 60000;
    client.requests = client.requests.filter(time => time > oneMinuteAgo);
    
    // Remove requests older than 1 second for burst protection
    const oneSecondAgo = now - 1000;
    const recentRequests = client.requests.filter(time => time > oneSecondAgo);
    
    // Check rate limits
    if (client.requests.length >= this.maxRequestsPerMinute) {
      client.violations++;
      console.warn(`⚠️ Rate limit exceeded for ${clientKey}: ${client.requests.length} requests/minute`);
      return { 
        allowed: false, 
        remaining: 0, 
        resetTime: oneMinuteAgo + 60000,
        violations: client.violations
      };
    }
    
    if (recentRequests.length >= this.maxRequestsPerSecond) {
      client.violations++;
      console.warn(`⚠️ Burst limit exceeded for ${clientKey}: ${recentRequests.length} requests/second`);
      return { 
        allowed: false, 
        remaining: this.maxRequestsPerMinute - client.requests.length,
        resetTime: oneSecondAgo + 1000,
        violations: client.violations
      };
    }

    // Allow request
    client.requests.push(now);
    return { 
      allowed: true, 
      remaining: this.maxRequestsPerMinute - client.requests.length,
      violations: client.violations
    };
  }

  cleanup() {
    const now = Date.now();
    const oneHourAgo = now - 3600000; // 1 hour
    
    for (const [clientKey, client] of this.clients.entries()) {
      // Remove old requests
      client.requests = client.requests.filter(time => time > oneHourAgo);
      
      // Remove inactive clients
      if (client.requests.length === 0 && client.lastReset < oneHourAgo) {
        this.clients.delete(clientKey);
      }
    }
    
    console.log(`🧹 Rate limiter cleanup: ${this.clients.size} active clients`);
  }

  getStats() {
    const stats = {
      totalClients: this.clients.size,
      activeClients: 0,
      totalRequests: 0,
      totalViolations: 0
    };

    for (const client of this.clients.values()) {
      if (client.requests.length > 0) stats.activeClients++;
      stats.totalRequests += client.requests.length;
      stats.totalViolations += client.violations;
    }

    return stats;
  }
}

// Performance Monitor Class
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: { total: 0, success: 0, errors: 0 },
      websocket: { connections: 0, messages: 0, broadcasts: 0 },
      database: { queries: 0, transactions: 0, errors: 0 },
      response_times: [],
      memory_usage: [],
      cpu_usage: []
    };
    
    this.startTime = Date.now();
    this.monitoringInterval = setInterval(() => this.collectSystemMetrics(), 30000); // Every 30 seconds
  }

  recordRequest(success = true, responseTime = 0) {
    this.metrics.requests.total++;
    if (success) {
      this.metrics.requests.success++;
    } else {
      this.metrics.requests.errors++;
    }
    
    if (responseTime > 0) {
      this.metrics.response_times.push(responseTime);
      // Keep only last 1000 response times
      if (this.metrics.response_times.length > 1000) {
        this.metrics.response_times.shift();
      }
    }
  }

  recordWebSocketActivity(type) {
    switch (type) {
      case 'connection':
        this.metrics.websocket.connections++;
        break;
      case 'message':
        this.metrics.websocket.messages++;
        break;
      case 'broadcast':
        this.metrics.websocket.broadcasts++;
        break;
    }
  }

  recordDatabaseActivity(type, success = true) {
    switch (type) {
      case 'query':
        this.metrics.database.queries++;
        break;
      case 'transaction':
        this.metrics.database.transactions++;
        break;
    }
    
    if (!success) {
      this.metrics.database.errors++;
    }
  }

  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    this.metrics.memory_usage.push({
      timestamp: Date.now(),
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external
    });

    // Keep only last 100 memory readings
    if (this.metrics.memory_usage.length > 100) {
      this.metrics.memory_usage.shift();
    }
  }

  getStats() {
    const uptime = Date.now() - this.startTime;
    const avgResponseTime = this.metrics.response_times.length > 0 
      ? this.metrics.response_times.reduce((a, b) => a + b, 0) / this.metrics.response_times.length 
      : 0;

    return {
      uptime: uptime,
      requests: this.metrics.requests,
      websocket: this.metrics.websocket,
      database: this.metrics.database,
      performance: {
        avgResponseTime: Math.round(avgResponseTime),
        requestsPerSecond: Math.round(this.metrics.requests.total / (uptime / 1000)),
        errorRate: this.metrics.requests.total > 0 
          ? Math.round((this.metrics.requests.errors / this.metrics.requests.total) * 100) 
          : 0
      },
      memory: this.metrics.memory_usage.length > 0 
        ? this.metrics.memory_usage[this.metrics.memory_usage.length - 1] 
        : null
    };
  }
}

// Initialize performance monitoring
const rateLimiter = new RateLimiter();
const performanceMonitor = new PerformanceMonitor();

// Database operation wrapper with comprehensive error handling
class DatabaseManager {
  static async executeQuery(query, values = [], operation = 'query') {
    const client = await pool.connect();
    try {
      const start = Date.now();
      const result = await client.query(query, values);
      const duration = Date.now() - start;
      
      console.log(`${operation} executed in ${duration}ms`);
      return result;
    } catch (error) {
      console.error(`Database ${operation} error:`, {
        error: error.message,
        query: query.substring(0, 100) + '...',
        values: values,
        stack: error.stack
      });
      throw this.handleDatabaseError(error);
    } finally {
      client.release();
    }
  }

  static async executeTransaction(operations) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const results = [];
      
      for (const operation of operations) {
        const result = await client.query(operation.query, operation.values);
        results.push(result);
      }
      
      await client.query('COMMIT');
      console.log(`Transaction completed successfully with ${operations.length} operations`);
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Transaction rolled back due to error:', error.message);
      throw this.handleDatabaseError(error);
    } finally {
      client.release();
    }
  }

  static handleDatabaseError(error) {
    const errorMap = {
      '23505': { code: 'DUPLICATE_KEY', message: 'Record already exists', status: 409 },
      '23503': { code: 'FOREIGN_KEY_VIOLATION', message: 'Referenced record does not exist', status: 400 },
      '23502': { code: 'NOT_NULL_VIOLATION', message: 'Required field is missing', status: 400 },
      '23514': { code: 'CHECK_VIOLATION', message: 'Data validation failed', status: 400 },
      '42P01': { code: 'TABLE_NOT_FOUND', message: 'Database table not found', status: 500 },
      '42703': { code: 'COLUMN_NOT_FOUND', message: 'Database column not found', status: 500 },
      '08006': { code: 'CONNECTION_FAILURE', message: 'Database connection failed', status: 503 },
      '08003': { code: 'CONNECTION_NOT_EXIST', message: 'Database connection does not exist', status: 503 },
      '57P01': { code: 'ADMIN_SHUTDOWN', message: 'Database is shutting down', status: 503 },
      '53300': { code: 'TOO_MANY_CONNECTIONS', message: 'Too many database connections', status: 503 }
    };

    const mappedError = errorMap[error.code] || {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected database error occurred',
      status: 500
    };

    return {
      ...mappedError,
      originalError: error.message,
      timestamp: new Date().toISOString()
    };
  }

  static async healthCheck() {
    try {
      const result = await this.executeQuery('SELECT NOW(), version()', [], 'health_check');
      return {
        status: 'healthy',
        database: 'connected',
        timestamp: result.rows[0].now,
        version: result.rows[0].version,
        connections: {
          total: pool.totalCount,
          idle: pool.idleCount,
          waiting: pool.waitingCount
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        database: 'disconnected',
        error: error.message || error,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// WebSocket connections for real-time sync with enhanced management
const clients = new Map(); // Changed to Map for better client management

// WebSocket connection manager
class WebSocketManager {
  static addClient(ws, deviceId = null) {
    const clientInfo = {
      ws,
      deviceId,
      connectedAt: new Date(),
      lastPing: new Date(),
      isAlive: true
    };
    clients.set(ws, clientInfo);
    console.log(`WebSocket client added. Total clients: ${clients.size}`);
  }

  static removeClient(ws) {
    const clientInfo = clients.get(ws);
    if (clientInfo) {
      console.log(`WebSocket client removed (Device: ${clientInfo.deviceId}). Total clients: ${clients.size - 1}`);
      clients.delete(ws);
    }
  }

  static updateClientDevice(ws, deviceId) {
    const clientInfo = clients.get(ws);
    if (clientInfo) {
      clientInfo.deviceId = deviceId;
      console.log(`Client device updated: ${deviceId}`);
    }
  }

  static markClientAlive(ws) {
    const clientInfo = clients.get(ws);
    if (clientInfo) {
      clientInfo.isAlive = true;
      clientInfo.lastPing = new Date();
    }
  }

  static getClientStats() {
    const stats = {
      total: clients.size,
      withDeviceId: 0,
      byDevice: {}
    };

    clients.forEach((clientInfo) => {
      if (clientInfo.deviceId) {
        stats.withDeviceId++;
        stats.byDevice[clientInfo.deviceId] = (stats.byDevice[clientInfo.deviceId] || 0) + 1;
      }
    });

    return stats;
  }

  static cleanupDeadConnections() {
    const now = new Date();
    const deadConnections = [];

    clients.forEach((clientInfo, ws) => {
      const timeSinceLastPing = now - clientInfo.lastPing;
      if (timeSinceLastPing > 60000 || !clientInfo.isAlive) { // 60 seconds timeout
        deadConnections.push(ws);
      }
    });

    deadConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.terminate();
      }
      this.removeClient(ws);
    });

    if (deadConnections.length > 0) {
      console.log(`Cleaned up ${deadConnections.length} dead connections`);
    }
  }
}

// WebSocket connection handler with enhanced error handling
wss.on('connection', (ws, req) => {
  const clientIP = req.socket.remoteAddress;
  const clientId = `${clientIP}_${Date.now()}`;
  
  console.log(`New WebSocket connection established from ${clientIP}`);
  
  // Check rate limiting for new connections
  const rateLimitResult = rateLimiter.isAllowed(clientIP, 'websocket_connection');
  if (!rateLimitResult.allowed) {
    console.warn(`⚠️ WebSocket connection rate limited for ${clientIP}`);
    ws.close(1008, 'Rate limit exceeded');
    return;
  }
  
  // Record performance metrics
  performanceMonitor.recordWebSocketActivity('connection');
  
  WebSocketManager.addClient(ws, null, clientId);
  
  // Send connection acknowledgment with rate limit info
  ws.send(JSON.stringify({ 
    type: 'connection_established', 
    timestamp: new Date().toISOString(),
    serverId: process.env.SERVER_ID || 'default',
    rateLimitRemaining: rateLimitResult.remaining
  }));
  
  ws.on('message', async (message) => {
    const startTime = Date.now();
    
    try {
      WebSocketManager.markClientAlive(ws);
      
      // Rate limiting for WebSocket messages
      const deviceId = ws.deviceId || clientId;
      const rateLimitResult = rateLimiter.isAllowed(deviceId, 'websocket_message');
      
      if (!rateLimitResult.allowed) {
        console.warn(`⚠️ WebSocket message rate limited for device: ${deviceId}`);
        ws.send(JSON.stringify({
          type: 'rate_limit_exceeded',
          message: 'Too many messages, please slow down',
          resetTime: rateLimitResult.resetTime,
          violations: rateLimitResult.violations
        }));
        return;
      }
      
      // Record performance metrics
      performanceMonitor.recordWebSocketActivity('message');
      
      let data;
      try {
        data = JSON.parse(message);
      } catch (parseError) {
        throw new Error(`Invalid JSON message: ${parseError.message}`);
      }

      console.log(`Received WebSocket message: ${data.type} from device: ${data.deviceId || 'unknown'}`);
      
      switch (data.type) {
        case 'register_device':
          if (!data.deviceId) {
            throw new Error('Device ID is required for registration');
          }
          
          try {
            await registerDevice(data.deviceId, data.deviceName, data.deviceType);
            WebSocketManager.updateClientDevice(ws, data.deviceId);
            
            ws.send(JSON.stringify({ 
              type: 'device_registered', 
              deviceId: data.deviceId,
              timestamp: new Date().toISOString()
            }));
            
            // Broadcast device connection to other clients
            broadcast({
              type: 'device_connected',
              deviceId: data.deviceId,
              deviceName: data.deviceName,
              timestamp: new Date().toISOString()
            }, data.deviceId);
            
          } catch (dbError) {
            throw new Error(`Device registration failed: ${dbError.message || dbError}`);
          }
          break;
          
        case 'ping':
          ws.send(JSON.stringify({ 
            type: 'pong', 
            timestamp: new Date().toISOString()
          }));
          break;
          
        case 'get_stats':
          ws.send(JSON.stringify({
            type: 'stats_response',
            stats: WebSocketManager.getClientStats(),
            timestamp: new Date().toISOString()
          }));
          break;
          
        default:
          console.warn(`Unknown message type: ${data.type}`);
          ws.send(JSON.stringify({
            type: 'error',
            code: 'UNKNOWN_MESSAGE_TYPE',
            message: `Unknown message type: ${data.type}`,
            timestamp: new Date().toISOString()
          }));
      }
      
    } catch (error) {
      console.error('WebSocket message processing error:', {
        error: error.message,
        stack: error.stack,
        message: message.toString().substring(0, 200)
      });
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          code: 'MESSAGE_PROCESSING_ERROR',
          message: error.message,
          timestamp: new Date().toISOString()
        }));
      }
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log(`WebSocket connection closed. Code: ${code}, Reason: ${reason}`);
    const clientInfo = clients.get(ws);
    if (clientInfo && clientInfo.deviceId) {
      // Broadcast device disconnection
      broadcast({
        type: 'device_disconnected',
        deviceId: clientInfo.deviceId,
        timestamp: new Date().toISOString()
      }, clientInfo.deviceId);
    }
    WebSocketManager.removeClient(ws);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket connection error:', {
      error: error.message,
      code: error.code,
      stack: error.stack
    });
    WebSocketManager.removeClient(ws);
  });

  ws.on('pong', () => {
    WebSocketManager.markClientAlive(ws);
  });
});

// Periodic cleanup of dead connections
setInterval(() => {
  WebSocketManager.cleanupDeadConnections();
}, 30000); // Every 30 seconds

// Periodic ping to all clients
setInterval(() => {
  clients.forEach((clientInfo, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      clientInfo.isAlive = false;
      ws.ping();
    }
  });
}, 30000); // Every 30 seconds

// Enhanced broadcast function for real-time updates
function broadcast(data, excludeDeviceId = null) {
  const startTime = Date.now();
  const message = JSON.stringify(data);
  let successCount = 0;
  let failureCount = 0;
  
  // Performance optimization: batch sends for large client counts
  const clientArray = Array.from(clients.entries());
  const batchSize = 50; // Send in batches of 50 for better performance
  
  const sendBatch = (batch) => {
    return Promise.all(batch.map(([ws, clientInfo]) => {
      return new Promise((resolve) => {
        if (ws.readyState === WebSocket.OPEN && clientInfo.deviceId !== excludeDeviceId) {
          try {
            ws.send(message);
            successCount++;
            resolve(true);
          } catch (error) {
            console.error(`Failed to send message to client ${clientInfo.deviceId}:`, error.message);
            failureCount++;
            // Remove failed client
            WebSocketManager.removeClient(ws);
            resolve(false);
          }
        } else {
          resolve(false);
        }
      });
    }));
  };
  
  // Process clients in batches for better performance
  const processBatches = async () => {
    for (let i = 0; i < clientArray.length; i += batchSize) {
      const batch = clientArray.slice(i, i + batchSize);
      await sendBatch(batch);
      
      // Small delay between batches to prevent overwhelming
      if (i + batchSize < clientArray.length) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }
    
    const duration = Date.now() - startTime;
    performanceMonitor.recordWebSocketActivity('broadcast');
    
    console.log(`📡 Broadcast sent to ${successCount} clients (${failureCount} errors) in ${duration}ms`);
  };
  
  // Execute batched sending
  processBatches().catch(error => {
    console.error('Broadcast error:', error);
  });
  
  console.log(`Broadcast completed: ${successCount} successful, ${failureCount} failed`);
  return { successCount, failureCount };
}

// Targeted broadcast to specific device
function broadcastToDevice(deviceId, data) {
  const message = JSON.stringify(data);
  let sent = false;
  
  clients.forEach((clientInfo, ws) => {
    if (ws.readyState === WebSocket.OPEN && clientInfo.deviceId === deviceId) {
      try {
        ws.send(message);
        sent = true;
        console.log(`Message sent to device: ${deviceId}`);
      } catch (error) {
        console.error(`Failed to send message to device ${deviceId}:`, error.message);
        WebSocketManager.removeClient(ws);
      }
    }
  });
  
  if (!sent) {
    console.warn(`Device ${deviceId} not found or not connected`);
  }
  
  return sent;
}

// Enhanced database helper functions
async function registerDevice(deviceId, deviceName = null, deviceType = 'unknown') {
  const query = 'SELECT register_device($1, $2, $3, $4)';
  const values = [deviceId, deviceName, deviceType, null];
  
  try {
    await DatabaseManager.executeQuery(query, values, 'register_device');
    console.log(`Device registered successfully: ${deviceId}`);
    return { success: true, deviceId };
  } catch (error) {
    console.error('Error registering device:', error);
    throw error;
  }
}

async function logSyncOperation(deviceId, operationType, tableName, recordId, oldData = null, newData = null) {
  const query = `
    INSERT INTO sync_log (device_id, operation_type, table_name, record_id, old_data, new_data)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, created_at
  `;
  const values = [deviceId, operationType, tableName, recordId, oldData, newData];
  
  try {
    const result = await DatabaseManager.executeQuery(query, values, 'log_sync_operation');
    console.log(`Sync operation logged: ${operationType} on ${tableName} by ${deviceId}`);
    return result.rows[0];
  } catch (error) {
    console.error('Error logging sync operation:', error);
    // Don't throw here as sync logging shouldn't break the main operation
    return null;
  }
}

// New helper function for bulk operations
async function executeBulkOperation(operations, deviceId) {
  try {
    const results = await DatabaseManager.executeTransaction(operations);
    
    // Log the bulk operation
    await logSyncOperation(deviceId, 'BULK_OPERATION', 'multiple', null, null, {
      operationCount: operations.length,
      timestamp: new Date().toISOString()
    });
    
    return {
      success: true,
      results,
      operationCount: operations.length
    };
  } catch (error) {
    console.error('Bulk operation failed:', error);
    throw error;
  }
}

// API Routes

// Enhanced health check with performance metrics
app.get('/api/health', async (req, res) => {
  try {
    const dbHealth = await DatabaseManager.healthCheck();
    const wsStats = WebSocketManager.getClientStats();
    const performanceStats = performanceMonitor.getStats();
    const rateLimitStats = rateLimiter.getStats();
    
    const healthData = {
      ...dbHealth,
      websocket: {
        status: 'healthy',
        clients: wsStats
      },
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid
      },
      performance: performanceStats,
      rateLimiting: rateLimitStats,
      timestamp: new Date().toISOString()
    };
    
    const statusCode = dbHealth.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthData);
    
  } catch (error) {
    performanceMonitor.recordRequest(false);
    res.status(500).json({ 
      status: 'unhealthy', 
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
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

// Create new sale with enhanced real-time sync
app.post('/api/sales', async (req, res) => {
  try {
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
        error: 'Missing required fields: quantity, price, total, customer, device_id',
        code: 'VALIDATION_ERROR'
      });
    }

    // Validate data types and ranges
    if (isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ 
        error: 'Quantity must be a positive number',
        code: 'INVALID_QUANTITY'
      });
    }

    if (isNaN(price) || price <= 0) {
      return res.status(400).json({ 
        error: 'Price must be a positive number',
        code: 'INVALID_PRICE'
      });
    }

    if (isNaN(total) || total <= 0) {
      return res.status(400).json({ 
        error: 'Total must be a positive number',
        code: 'INVALID_TOTAL'
      });
    }
    
    // Register device if not exists
    await registerDevice(device_id);
    
    const operations = [
      {
        query: `
          INSERT INTO sales (
            product, quantity, price, total, customer, notes,
            payment_status, payment_method, amount_received, device_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *
        `,
        values: [
          product, quantity, price, total, customer, notes,
          payment_status, payment_method, amount_received, device_id
        ]
      }
    ];
    
    const results = await DatabaseManager.executeTransaction(operations);
    const newSale = results[0].rows[0];
    
    // Log the operation
    const syncLog = await logSyncOperation(device_id, 'CREATE', 'sales', newSale.id, null, newSale);
    
    // Enhanced real-time broadcast with metadata
    const broadcastResult = broadcast({
      type: 'data_sync',
      operation: 'CREATE',
      table: 'sales',
      data: newSale,
      metadata: {
        deviceId: device_id,
        timestamp: new Date().toISOString(),
        syncLogId: syncLog?.id,
        version: newSale.updated_at
      }
    }, device_id);
    
    console.log(`Sale created and broadcasted to ${broadcastResult.successCount} clients`);
    
    res.status(201).json({
      success: true,
      data: newSale,
      sync: {
        broadcasted: broadcastResult.successCount > 0,
        clientsNotified: broadcastResult.successCount
      }
    });
    
  } catch (error) {
    console.error('Error creating sale:', error);
    
    const statusCode = error.status || 500;
    res.status(statusCode).json({ 
      error: error.message || 'Failed to create sale',
      code: error.code || 'CREATE_SALE_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

// Update sale with enhanced real-time sync
app.put('/api/sales/:id', async (req, res) => {
  try {
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
      return res.status(400).json({ 
        error: 'device_id is required',
        code: 'MISSING_DEVICE_ID'
      });
    }

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ 
        error: 'Valid sale ID is required',
        code: 'INVALID_SALE_ID'
      });
    }
    
    // Get current record for optimistic locking
    const currentResult = await DatabaseManager.executeQuery(
      'SELECT * FROM sales WHERE id = $1 AND is_deleted = FALSE',
      [id],
      'get_current_sale'
    );
    
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Sale not found or has been deleted',
        code: 'SALE_NOT_FOUND'
      });
    }
    
    const currentSale = currentResult.rows[0];
    
    // Check version for optimistic locking
    if (version && currentSale.version !== version) {
      return res.status(409).json({ 
        error: 'Conflict detected - record has been modified by another user',
        code: 'VERSION_CONFLICT',
        current_version: currentSale.version,
        provided_version: version,
        current_data: currentSale
      });
    }

    // Validate numeric fields if provided
    if (quantity !== undefined && (isNaN(quantity) || quantity <= 0)) {
      return res.status(400).json({ 
        error: 'Quantity must be a positive number',
        code: 'INVALID_QUANTITY'
      });
    }

    if (price !== undefined && (isNaN(price) || price <= 0)) {
      return res.status(400).json({ 
        error: 'Price must be a positive number',
        code: 'INVALID_PRICE'
      });
    }

    if (total !== undefined && (isNaN(total) || total <= 0)) {
      return res.status(400).json({ 
        error: 'Total must be a positive number',
        code: 'INVALID_TOTAL'
      });
    }
    
    const operations = [
      {
        query: `
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
            sync_status = 'pending',
            updated_at = NOW()
          WHERE id = $1 AND is_deleted = FALSE
          RETURNING *
        `,
        values: [
          id, product, quantity, price, total, customer, notes,
          payment_status, payment_method, amount_received, device_id
        ]
      }
    ];
    
    const results = await DatabaseManager.executeTransaction(operations);
    const updatedSale = results[0].rows[0];
    
    // Log the operation
    const syncLog = await logSyncOperation(device_id, 'UPDATE', 'sales', id, currentSale, updatedSale);
    
    // Enhanced real-time broadcast with metadata
    const broadcastResult = broadcast({
      type: 'data_sync',
      operation: 'UPDATE',
      table: 'sales',
      data: updatedSale,
      metadata: {
        deviceId: device_id,
        timestamp: new Date().toISOString(),
        syncLogId: syncLog?.id,
        version: updatedSale.updated_at,
        previousVersion: currentSale.updated_at
      }
    }, device_id);
    
    console.log(`Sale updated and broadcasted to ${broadcastResult.successCount} clients`);
    
    res.json({
      success: true,
      data: updatedSale,
      sync: {
        broadcasted: broadcastResult.successCount > 0,
        clientsNotified: broadcastResult.successCount
      }
    });
    
  } catch (error) {
    const errorInfo = DatabaseManager.handleDatabaseError(error);
    console.error('Error updating sale:', {
      error: error.message,
      stack: error.stack,
      operation: 'UPDATE_SALE',
      saleId: req.params.id,
      deviceId: req.body.device_id
    });
    
    res.status(errorInfo.statusCode).json({
      error: errorInfo.message,
      code: errorInfo.code,
      operation: 'UPDATE_SALE',
      timestamp: new Date().toISOString()
    });
  }
});

// Delete sale (soft delete) with enhanced real-time sync
app.delete('/api/sales/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { device_id } = req.body;
    
    if (!device_id) {
      return res.status(400).json({ 
        error: 'device_id is required',
        code: 'MISSING_DEVICE_ID'
      });
    }

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ 
        error: 'Valid sale ID is required',
        code: 'INVALID_SALE_ID'
      });
    }
    
    // Get the sale before deletion for logging
    const saleResult = await DatabaseManager.executeQuery(
      'SELECT * FROM sales WHERE id = $1 AND is_deleted = FALSE',
      [id],
      'get_sale_before_delete'
    );
    
    if (saleResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Sale not found or already deleted',
        code: 'SALE_NOT_FOUND'
      });
    }
    
    const saleToDelete = saleResult.rows[0];
    
    const operations = [
      {
        query: 'SELECT soft_delete_sale($1, $2) as deleted',
        values: [id, device_id]
      }
    ];
    
    const results = await DatabaseManager.executeTransaction(operations);
    const deleteResult = results[0].rows[0];
    
    if (!deleteResult.deleted) {
      return res.status(404).json({ 
        error: 'Sale could not be deleted - may not exist or already deleted',
        code: 'DELETE_FAILED'
      });
    }
    
    // Log the operation
    const syncLog = await logSyncOperation(device_id, 'DELETE', 'sales', id, saleToDelete, null);
    
    // Enhanced real-time broadcast with metadata
    const broadcastResult = broadcast({
      type: 'data_sync',
      operation: 'DELETE',
      table: 'sales',
      data: { 
        id: parseInt(id), 
        device_id,
        deleted_at: new Date().toISOString()
      },
      metadata: {
        deviceId: device_id,
        timestamp: new Date().toISOString(),
        syncLogId: syncLog?.id,
        originalData: saleToDelete
      }
    }, device_id);
    
    console.log(`Sale deleted and broadcasted to ${broadcastResult.successCount} clients`);
    
    res.json({ 
      success: true, 
      message: 'Sale deleted successfully',
      data: {
        id: parseInt(id),
        deleted_at: new Date().toISOString()
      },
      sync: {
        broadcasted: broadcastResult.successCount > 0,
        clientsNotified: broadcastResult.successCount
      }
    });
    
  } catch (error) {
    const errorInfo = DatabaseManager.handleDatabaseError(error);
    console.error('Error deleting sale:', {
      error: error.message,
      stack: error.stack,
      operation: 'DELETE_SALE',
      saleId: req.params.id,
      deviceId: req.body.device_id
    });
    
    res.status(errorInfo.statusCode).json({
      error: errorInfo.message,
      code: errorInfo.code,
      operation: 'DELETE_SALE',
      timestamp: new Date().toISOString()
    });
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