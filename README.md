# 🍌 Banana Sales Tracker (PostgreSQL)

A modern, real-time sales tracking application built with PostgreSQL, Node.js, and vanilla JavaScript. This application provides seamless multi-device synchronization, conflict resolution, and offline support for tracking banana sales across different locations and devices.

## ✨ Features

### Core Functionality
- **Real-time Sales Tracking**: Add, edit, and delete sales records with instant synchronization
- **Multi-device Sync**: Seamless data synchronization across all connected devices
- **Conflict Resolution**: Automatic handling of concurrent edits with timestamp-based resolution
- **Offline Support**: Continue working offline with automatic sync when connection is restored
- **Search & Filter**: Advanced filtering by date, location, customer, and amount
- **Dark/Light Theme**: Beautiful UI with system theme detection

### Technical Features
- **PostgreSQL Backend**: Robust database with ACID compliance and advanced indexing
- **WebSocket Real-time Updates**: Instant data synchronization across devices
- **Connection Pooling**: Efficient database connection management
- **Transaction Management**: Ensures data consistency and integrity
- **RESTful API**: Clean, well-documented API endpoints
- **Error Handling**: Comprehensive error handling and recovery
- **Security**: Input validation, SQL injection prevention, and secure connections

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v16 or higher)
- **PostgreSQL** (v12 or higher)
- **npm** or **yarn**

### Installation

1. **Clone or download the project**
   ```bash
   cd Salero
   ```

2. **Run the automated setup script**
   ```bash
   ./setup.sh
   ```
   
   This script will:
   - Check prerequisites (Node.js, PostgreSQL)
   - Start PostgreSQL service
   - Create database and user
   - Set up database schema
   - Install backend dependencies
   - Create environment configuration
   - Test database connection

3. **Start the backend server**
   ```bash
   cd backend
   npm start
   ```

4. **Start the frontend server** (in a new terminal)
   ```bash
   python3 -m http.server 8000
   ```

5. **Open the application**
   - Navigate to `http://localhost:8000/app.html`
   - The backend API runs on `http://localhost:3000`

## 📁 Project Structure

```
Salero/
├── app.html                 # Main application frontend
├── setup.sh                 # Automated setup script
├── README.md                # This file
├── backend/
│   ├── server.js            # Express server with PostgreSQL integration
│   ├── package.json         # Backend dependencies
│   ├── .env.example         # Environment configuration template
│   └── .env                 # Environment configuration (created by setup)
└── database/
    └── schema.sql           # PostgreSQL database schema
```

## 🗄️ Database Schema

The PostgreSQL database includes:

### Tables
- **sales**: Main sales records with timestamps and device tracking
- **devices**: Device registration and management
- **sync_log**: Synchronization operation logging
- **conflicts**: Conflict detection and resolution tracking

### Features
- **Indexes**: Optimized for fast queries and real-time sync
- **Triggers**: Automatic timestamp updates and conflict detection
- **Views**: Simplified data access patterns
- **Functions**: Device registration, conflict resolution, soft deletion

## 🔄 Real-time Synchronization

### How it Works
1. **WebSocket Connection**: Each client maintains a persistent WebSocket connection
2. **Change Detection**: Database triggers detect data changes
3. **Broadcast Updates**: Server broadcasts changes to all connected clients
4. **Conflict Resolution**: Timestamp-based resolution with merge strategies
5. **Offline Queue**: Changes are queued when offline and synced when reconnected

### Conflict Resolution
- **Last Write Wins**: Default strategy based on timestamps
- **Merge Strategy**: Intelligent merging for non-conflicting fields
- **Manual Resolution**: UI for resolving complex conflicts
- **Audit Trail**: Complete history of all changes and resolutions

## 🛠️ API Endpoints

### Sales Management
- `GET /api/sales` - Get all sales with filtering
- `POST /api/sales` - Create new sale
- `PUT /api/sales/:id` - Update existing sale
- `DELETE /api/sales/:id` - Delete sale (soft delete)

### Synchronization
- `GET /api/sync/:deviceId/:lastSync` - Get changes since last sync
- `POST /api/sync` - Submit changes for synchronization
- `GET /api/conflicts/:deviceId` - Get unresolved conflicts
- `POST /api/conflicts/:id/resolve` - Resolve conflict

### Device Management
- `POST /api/devices/register` - Register new device
- `GET /api/devices/:deviceId` - Get device information
- `PUT /api/devices/:deviceId` - Update device information

### System
- `GET /api/health` - Health check endpoint
- `GET /api/stats` - System statistics

## ⚙️ Configuration

### Environment Variables

The setup script creates a `.env` file in the `backend/` directory with:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=banana_sales
DB_USER=banana_sales_user
DB_PASSWORD=banana_sales_password

# Server
PORT=3000
NODE_ENV=development

# Security
JWT_SECRET=auto-generated-secret
API_RATE_LIMIT=100

# CORS
CORS_ORIGIN=http://localhost:8000

# WebSocket
WS_HEARTBEAT_INTERVAL=30000

# Connection Pool
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=30000
DB_POOL_CONNECTION_TIMEOUT=2000
```

### Customization

You can modify these settings in the `.env` file:
- **Database connection**: Change host, port, credentials
- **Server port**: Change the backend server port
- **CORS origin**: Update for different frontend URLs
- **Pool settings**: Adjust for your server capacity
- **Sync settings**: Modify batch sizes and conflict resolution

## 🧪 Testing

### Manual Testing
1. Open the application in multiple browser tabs/windows
2. Add, edit, or delete sales records in one tab
3. Observe real-time updates in other tabs
4. Test offline functionality by disconnecting network
5. Verify conflict resolution by editing the same record simultaneously

### Database Testing
```bash
# Connect to database
psql -h localhost -U banana_sales_user -d banana_sales

# Check tables
\dt

# View sales data
SELECT * FROM sales ORDER BY created_at DESC LIMIT 10;

# Check sync logs
SELECT * FROM sync_log ORDER BY timestamp DESC LIMIT 10;
```

## 🔧 Troubleshooting

### Common Issues

**PostgreSQL Connection Failed**
- Ensure PostgreSQL is running: `brew services start postgresql` (macOS)
- Check connection settings in `.env` file
- Verify user permissions: `psql -U banana_sales_user -d banana_sales`

**Backend Server Won't Start**
- Check if port 3000 is available: `lsof -i :3000`
- Verify all dependencies are installed: `cd backend && npm install`
- Check environment file exists: `ls backend/.env`

**Frontend Not Loading**
- Ensure frontend server is running on port 8000
- Check browser console for errors
- Verify CORS settings in backend `.env`

**Real-time Sync Not Working**
- Check WebSocket connection in browser developer tools
- Verify backend WebSocket server is running
- Check firewall settings for port 3000

### Database Reset

If you need to reset the database:

```bash
# Drop and recreate database
psql -U postgres -c "DROP DATABASE IF EXISTS banana_sales;"
psql -U postgres -c "CREATE DATABASE banana_sales;"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE banana_sales TO banana_sales_user;"

# Rerun schema
psql -U banana_sales_user -d banana_sales -f database/schema.sql
```

## 🔄 Migration from MongoDB

This application was migrated from MongoDB to PostgreSQL with the following improvements:

### Benefits of PostgreSQL
- **ACID Compliance**: Guaranteed data consistency
- **Advanced Indexing**: Better query performance
- **Mature Ecosystem**: Extensive tooling and community support
- **SQL Standards**: Familiar query language
- **Concurrent Access**: Better handling of simultaneous connections
- **Data Integrity**: Foreign keys and constraints

### Migration Features
- **Schema Design**: Optimized table structure with proper relationships
- **Real-time Sync**: WebSocket-based instead of polling
- **Conflict Resolution**: Database-level conflict detection
- **Connection Pooling**: Efficient resource management
- **Transaction Support**: Atomic operations for data consistency

## 📈 Performance

### Optimizations
- **Database Indexes**: Optimized for common query patterns
- **Connection Pooling**: Reuse database connections
- **WebSocket Efficiency**: Minimal overhead for real-time updates
- **Batch Operations**: Efficient bulk data operations
- **Caching**: Strategic caching for frequently accessed data

### Monitoring
- **Health Endpoint**: `/api/health` for system status
- **Statistics**: `/api/stats` for performance metrics
- **Logging**: Comprehensive logging for debugging
- **Error Tracking**: Detailed error reporting and recovery

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the MIT License.

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section above
2. Review the database logs: `tail -f backend/logs/app.log`
3. Check PostgreSQL logs: `tail -f /usr/local/var/log/postgresql.log`
4. Open an issue with detailed error information

---

**Happy tracking! 🍌**