# Production Deployment Credentials

This document provides the complete set of database credentials and environment variables required for production deployment across different platforms.

## 🔐 Core Environment Variables

### Required for All Platforms:

```env
# Application Environment
NODE_ENV=production

# Primary Database Connection (Choose one format)
POSTGRES_URL=postgresql://username:password@host:port/database
# OR
DATABASE_URL=postgresql://username:password@host:port/database

# Individual Database Parameters
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=banana_sales
DB_USER=your-db-user
DB_PASSWORD=your-db-password
```

## 🚀 Platform-Specific Configurations

### 1. Render Deployment

```env
# Core Variables
NODE_ENV=production
POSTGRES_URL=postgresql://username:password@host:port/database

# Render-specific (auto-generated)
DATABASE_URL=postgresql://username:password@host:port/database
RENDER=true
```

**Setup Steps:**
1. Create PostgreSQL database in Render
2. Copy connection string to `POSTGRES_URL`
3. Deploy using Blueprint (render.yaml) or manual setup

### 2. Vercel Deployment

```env
# Core Variables
NODE_ENV=production

# Vercel Postgres (recommended)
POSTGRES_URL=postgresql://default:password@ep-xxxxx.us-east-1.postgres.vercel-storage.com:5432/verceldb
POSTGRES_PRISMA_URL=postgresql://default:password@ep-xxxxx.us-east-1.postgres.vercel-storage.com:5432/verceldb?pgbouncer=true&connect_timeout=15
POSTGRES_URL_NON_POOLING=postgresql://default:password@ep-xxxxx.us-east-1.postgres.vercel-storage.com:5432/verceldb

# Individual Parameters
DB_HOST=ep-xxxxx.us-east-1.postgres.vercel-storage.com
DB_PORT=5432
DB_NAME=verceldb
DB_USER=default
DB_PASSWORD=your_generated_password

# Vercel-specific
VERCEL=1
VERCEL_URL=your-app.vercel.app
```

**Setup Steps:**
1. Create Vercel Postgres in Storage tab
2. Copy all connection strings
3. Set environment variables in Vercel dashboard

### 3. Railway Deployment

```env
# Core Variables
NODE_ENV=production

# Railway PostgreSQL (auto-injected)
DATABASE_URL=${{Postgres.DATABASE_URL}}
POSTGRES_URL=${{Postgres.DATABASE_URL}}

# Individual Parameters (if needed)
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_NAME=${{Postgres.PGDATABASE}}
DB_USER=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}

# Railway-specific
RAILWAY_ENVIRONMENT=production
```

### 4. Heroku Deployment

```env
# Core Variables
NODE_ENV=production

# Heroku PostgreSQL (auto-injected)
DATABASE_URL=postgresql://username:password@host:port/database
POSTGRES_URL=postgresql://username:password@host:port/database

# Individual Parameters
DB_HOST=your-heroku-db-host
DB_PORT=5432
DB_NAME=your-heroku-db-name
DB_USER=your-heroku-db-user
DB_PASSWORD=your-heroku-db-password

# Heroku-specific
HEROKU=true
```

## 🛠️ Database Initialization

### Using the Initialization Script:

```bash
# Basic initialization
node init-production-db.js

# With sample data
node init-production-db.js --sample-data

# Create user and sample data
node init-production-db.js --create-user --sample-data
```

### Manual Database Setup:

```sql
-- Create database
CREATE DATABASE banana_sales;

-- Create user
CREATE USER your_db_user WITH PASSWORD 'your_db_password';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE banana_sales TO your_db_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_db_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_db_user;
```

## 🔒 Security Best Practices

### 1. Environment Variable Management:
- ✅ Never commit `.env` files to version control
- ✅ Use platform-specific secret management
- ✅ Rotate passwords regularly
- ✅ Use strong, unique passwords

### 2. Database Security:
- ✅ Enable SSL connections (`?sslmode=require`)
- ✅ Use connection pooling
- ✅ Limit database user permissions
- ✅ Enable database backups

### 3. Application Security:
- ✅ Set `NODE_ENV=production`
- ✅ Use HTTPS in production
- ✅ Configure CORS properly
- ✅ Enable rate limiting

## 📋 Deployment Checklist

### Pre-deployment:
- [ ] Database credentials configured
- [ ] Environment variables set
- [ ] SSL certificates ready
- [ ] Domain configured (if custom)
- [ ] CORS settings updated

### Post-deployment:
- [ ] Database schema initialized
- [ ] Sample data inserted (if needed)
- [ ] Health checks passing
- [ ] Logs monitoring setup
- [ ] Backup strategy implemented

## 🔧 Testing Database Connection

Use this script to test your database connection:

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database connected:', result.rows[0]);
    client.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  } finally {
    await pool.end();
  }
}

testConnection();
```

## 📞 Support

If you encounter issues:

1. **Check environment variables** are correctly set
2. **Verify database connectivity** using the test script
3. **Review platform-specific logs**
4. **Ensure firewall/security groups** allow connections
5. **Check SSL requirements** for your database provider

## 🔗 Quick Links

- [Render Documentation](https://render.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [Heroku Documentation](https://devcenter.heroku.com)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)