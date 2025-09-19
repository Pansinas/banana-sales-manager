# 🔧 Production Environment Variables Setup Guide

This guide provides the complete set of environment variables required for production deployment across different platforms.

## 📋 **Core Environment Variables**

### **Required Variables (All Platforms)**

```env
# Application Configuration
NODE_ENV=production
PORT=10000

# Database Connection
POSTGRES_URL=postgresql://username:password@host:port/database
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=banana_sales
DB_USER=your-db-user
DB_PASSWORD=your-db-password
```

## 🚀 **Platform-Specific Setup**

### **1. Render.com**

**Step 1: Create PostgreSQL Database**
- Go to Render Dashboard → New → PostgreSQL
- Database Name: `banana-sales-db`
- User: `banana_sales_user`
- Copy the connection details

**Step 2: Set Environment Variables in Web Service**
```env
NODE_ENV=production
PORT=10000
DATABASE_URL=postgresql://banana_sales_user:password@dpg-xxxxx.oregon-postgres.render.com:5432/banana_sales_db
DB_HOST=dpg-xxxxx.oregon-postgres.render.com
DB_PORT=5432
DB_NAME=banana_sales_db
DB_USER=banana_sales_user
DB_PASSWORD=your_generated_password
```

**Step 3: Get Real Credentials**
- In Render PostgreSQL dashboard, find "Connections"
- Copy the exact values for:
  - External Database URL
  - Host
  - Database
  - Username
  - Password

### **2. Vercel**

**Step 1: Create Vercel Postgres Database**
- Go to Vercel Dashboard → Storage → Create Database → Postgres
- Database Name: `banana-sales-db`

**Step 2: Set Environment Variables**
```env
NODE_ENV=production
POSTGRES_URL=postgresql://default:password@ep-xxxxx.us-east-1.postgres.vercel-storage.com:5432/verceldb
POSTGRES_PRISMA_URL=postgresql://default:password@ep-xxxxx.us-east-1.postgres.vercel-storage.com:5432/verceldb?pgbouncer=true&connect_timeout=15
POSTGRES_URL_NON_POOLING=postgresql://default:password@ep-xxxxx.us-east-1.postgres.vercel-storage.com:5432/verceldb
DB_HOST=ep-xxxxx.us-east-1.postgres.vercel-storage.com
DB_PORT=5432
DB_NAME=verceldb
DB_USER=default
DB_PASSWORD=your_generated_password
```

**Step 3: Copy from Vercel Dashboard**
- Go to Storage → Your Database → .env.local tab
- Copy all the provided environment variables

### **3. Railway**

**Step 1: Create PostgreSQL Service**
- Railway Dashboard → New Project → Add Service → PostgreSQL
- Service Name: `banana-sales-db`

**Step 2: Set Environment Variables**
```env
NODE_ENV=production
PORT=10000
DATABASE_URL=postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway
PGHOST=containers-us-west-xxx.railway.app
PGPORT=5432
PGDATABASE=railway
PGUSER=postgres
PGPASSWORD=your_generated_password
DB_HOST=containers-us-west-xxx.railway.app
DB_PORT=5432
DB_NAME=railway
DB_USER=postgres
DB_PASSWORD=your_generated_password
```

**Step 3: Get Railway Credentials**
- Go to PostgreSQL service → Variables tab
- Copy the auto-generated database credentials

### **4. Heroku**

**Step 1: Add PostgreSQL Add-on**
```bash
heroku addons:create heroku-postgresql:hobby-dev
```

**Step 2: Environment Variables (Auto-configured)**
```env
NODE_ENV=production
PORT=$PORT
DATABASE_URL=postgresql://user:password@host:5432/database
```

**Step 3: Get Heroku Credentials**
```bash
heroku config:get DATABASE_URL
```

### **5. External Database Providers**

#### **Supabase**
```env
NODE_ENV=production
PORT=10000
POSTGRES_URL=postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres
DB_HOST=db.xxxxx.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your_supabase_password
```

#### **PlanetScale (MySQL Alternative)**
```env
NODE_ENV=production
PORT=10000
DATABASE_URL=mysql://username:password@host:3306/database?ssl={"rejectUnauthorized":true}
```

#### **AWS RDS PostgreSQL**
```env
NODE_ENV=production
PORT=10000
POSTGRES_URL=postgresql://username:password@your-db.xxxxx.us-east-1.rds.amazonaws.com:5432/banana_sales
DB_HOST=your-db.xxxxx.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=banana_sales
DB_USER=banana_sales_user
DB_PASSWORD=your_aws_password
```

## 🔐 **Security Best Practices**

### **Password Requirements**
- Minimum 16 characters
- Include uppercase, lowercase, numbers, and symbols
- Use unique passwords for each environment
- Never use default passwords

### **Example Strong Passwords**
```
Production: K9$mP2#vL8@nQ5!wR7*xT3&uY6^zA1
Staging: H4$jN9#sM2@kL7!pQ3*vX8&rT5^yB6
Development: F2$gK5#nP8@mJ4!sL9*wV3&qR7^xA1
```

### **Database Security Checklist**
- ✅ Enable SSL/TLS connections
- ✅ Restrict IP access to application servers only
- ✅ Use connection pooling
- ✅ Enable database backups
- ✅ Monitor database performance
- ✅ Rotate passwords regularly

## 🛠️ **Environment Variable Setup Commands**

### **Render**
```bash
# Set via Render Dashboard → Environment Variables
# Or use Render CLI
render env set NODE_ENV=production
render env set DATABASE_URL=postgresql://...
```

### **Vercel**
```bash
# Set via Vercel Dashboard → Settings → Environment Variables
# Or use Vercel CLI
vercel env add NODE_ENV
vercel env add POSTGRES_URL
```

### **Railway**
```bash
# Set via Railway Dashboard → Variables
# Or use Railway CLI
railway variables set NODE_ENV=production
railway variables set DATABASE_URL=postgresql://...
```

### **Heroku**
```bash
# Set via Heroku CLI
heroku config:set NODE_ENV=production
heroku config:set DATABASE_URL=postgresql://...
```

## 📊 **Database Connection Testing**

### **Test Connection Script**
Create `test-db-connection.js`:
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database connection successful:', result.rows[0]);
    client.release();
  } catch (err) {
    console.error('❌ Database connection failed:', err);
  } finally {
    await pool.end();
  }
}

testConnection();
```

### **Run Test**
```bash
node test-db-connection.js
```

## 🔄 **Environment Variable Validation**

Add this to your `server.js`:
```javascript
// Environment validation
const requiredEnvVars = [
  'NODE_ENV',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

console.log('✅ All required environment variables are set');
```

## 📝 **Quick Setup Checklist**

- [ ] Choose deployment platform
- [ ] Create PostgreSQL database
- [ ] Copy database credentials
- [ ] Set all environment variables
- [ ] Test database connection
- [ ] Deploy application
- [ ] Run database schema
- [ ] Verify application functionality
- [ ] Monitor logs for errors

Your production environment is now properly configured with secure database credentials! 🚀