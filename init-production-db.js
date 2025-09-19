#!/usr/bin/env node

/**
 * Production Database Initialization Script
 * This script initializes the production database with proper schema and credentials
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration from environment variables
const dbConfig = {
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Fallback to individual parameters if connection string not available
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
};

console.log('🚀 Initializing Production Database...\n');

async function initializeDatabase() {
  let pool;
  
  try {
    // Create connection pool
    pool = new Pool(dbConfig);
    
    console.log('📡 Connecting to database...');
    const client = await pool.connect();
    
    // Test connection
    const testResult = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Database connection successful!');
    console.log(`   Time: ${testResult.rows[0].current_time}`);
    console.log(`   PostgreSQL: ${testResult.rows[0].pg_version.split(' ')[1]}\n`);
    
    // Read schema file
    const schemaPath = path.join(__dirname, 'database', 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error('Schema file not found at: ' + schemaPath);
    }
    
    const schema = fs.readFileSync(schemaPath, 'utf8');
    console.log('📄 Schema file loaded successfully');
    
    // Execute schema
    console.log('🔧 Creating database schema...');
    await client.query(schema);
    console.log('✅ Database schema created successfully!');
    
    // Verify tables were created
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('\n📊 Created tables:');
    tablesResult.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    
    // Insert sample data (optional)
    if (process.argv.includes('--sample-data')) {
      console.log('\n🌱 Inserting sample data...');
      await insertSampleData(client);
    }
    
    // Create database user if needed (for some platforms)
    if (process.argv.includes('--create-user')) {
      await createDatabaseUser(client);
    }
    
    client.release();
    console.log('\n🎉 Database initialization completed successfully!');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    
    if (error.code) {
      console.error(`   Error Code: ${error.code}`);
    }
    
    if (error.detail) {
      console.error(`   Details: ${error.detail}`);
    }
    
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

async function insertSampleData(client) {
  try {
    // Insert sample sales data
    await client.query(`
      INSERT INTO sales (product_name, quantity, price, sale_date, device_id) VALUES
      ('Banana Premium', 50, 2.99, NOW() - INTERVAL '1 day', 'sample_device_1'),
      ('Banana Organic', 30, 3.49, NOW() - INTERVAL '2 days', 'sample_device_1'),
      ('Banana Regular', 75, 1.99, NOW() - INTERVAL '3 days', 'sample_device_2')
      ON CONFLICT DO NOTHING;
    `);
    
    console.log('   ✓ Sample sales data inserted');
    
    // Insert sample devices
    await client.query(`
      INSERT INTO devices (device_id, device_name, last_sync) VALUES
      ('sample_device_1', 'Store Terminal 1', NOW()),
      ('sample_device_2', 'Store Terminal 2', NOW())
      ON CONFLICT (device_id) DO NOTHING;
    `);
    
    console.log('   ✓ Sample device data inserted');
    
  } catch (error) {
    console.error('   ⚠️ Sample data insertion failed:', error.message);
  }
}

async function createDatabaseUser(client) {
  try {
    const username = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    
    if (!username || !password) {
      console.log('   ⚠️ DB_USER or DB_PASSWORD not set, skipping user creation');
      return;
    }
    
    // Create user if not exists
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${username}') THEN
          CREATE ROLE ${username} LOGIN PASSWORD '${password}';
        END IF;
      END
      $$;
    `);
    
    // Grant permissions
    await client.query(`
      GRANT ALL PRIVILEGES ON DATABASE ${process.env.DB_NAME} TO ${username};
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${username};
      GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${username};
    `);
    
    console.log(`   ✓ Database user '${username}' created/updated with permissions`);
    
  } catch (error) {
    console.error('   ⚠️ User creation failed:', error.message);
  }
}

function displayUsage() {
  console.log('📖 Usage:');
  console.log('   node init-production-db.js [options]');
  console.log('');
  console.log('🔧 Options:');
  console.log('   --sample-data    Insert sample data for testing');
  console.log('   --create-user    Create database user with permissions');
  console.log('   --help          Show this help message');
  console.log('');
  console.log('🌍 Environment Variables Required:');
  console.log('   POSTGRES_URL or DATABASE_URL (connection string)');
  console.log('   OR individual variables:');
  console.log('   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD');
  console.log('');
  console.log('📝 Examples:');
  console.log('   node init-production-db.js');
  console.log('   node init-production-db.js --sample-data');
  console.log('   node init-production-db.js --create-user --sample-data');
}

function validateEnvironment() {
  const hasConnectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  const hasIndividualVars = process.env.DB_HOST && process.env.DB_NAME && 
                           process.env.DB_USER && process.env.DB_PASSWORD;
  
  if (!hasConnectionString && !hasIndividualVars) {
    console.error('❌ Missing database configuration!');
    console.error('   Set either POSTGRES_URL/DATABASE_URL or individual DB_* variables');
    console.error('   Run with --help for more information');
    process.exit(1);
  }
  
  console.log('✅ Environment variables validated');
}

// Main execution
if (process.argv.includes('--help')) {
  displayUsage();
  process.exit(0);
}

console.log('🔍 Validating environment...');
validateEnvironment();

// Run initialization
initializeDatabase();