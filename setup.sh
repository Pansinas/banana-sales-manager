#!/bin/bash

# Banana Sales Tracker - PostgreSQL Setup Script
# This script sets up the PostgreSQL database and backend dependencies

set -e  # Exit on any error

echo "🍌 Banana Sales Tracker - PostgreSQL Setup"
echo "==========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if PostgreSQL is installed
check_postgresql() {
    print_status "Checking PostgreSQL installation..."
    
    if command -v psql >/dev/null 2>&1; then
        print_success "PostgreSQL is installed"
        psql --version
    else
        print_error "PostgreSQL is not installed"
        echo "Please install PostgreSQL first:"
        echo "  macOS: brew install postgresql"
        echo "  Ubuntu: sudo apt-get install postgresql postgresql-contrib"
        echo "  CentOS: sudo yum install postgresql postgresql-server"
        exit 1
    fi
}

# Check if Node.js is installed
check_nodejs() {
    print_status "Checking Node.js installation..."
    
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION=$(node --version)
        print_success "Node.js is installed: $NODE_VERSION"
        
        # Check if version is >= 16
        NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        if [ "$NODE_MAJOR" -lt 16 ]; then
            print_warning "Node.js version should be >= 16.0.0 for best compatibility"
        fi
    else
        print_error "Node.js is not installed"
        echo "Please install Node.js first: https://nodejs.org/"
        exit 1
    fi
}

# Start PostgreSQL service
start_postgresql() {
    print_status "Starting PostgreSQL service..."
    
    # Try different methods based on the system
    if command -v brew >/dev/null 2>&1; then
        # macOS with Homebrew
        brew services start postgresql || print_warning "PostgreSQL may already be running"
    elif command -v systemctl >/dev/null 2>&1; then
        # Linux with systemd
        sudo systemctl start postgresql || print_warning "PostgreSQL may already be running"
    elif command -v service >/dev/null 2>&1; then
        # Linux with service
        sudo service postgresql start || print_warning "PostgreSQL may already be running"
    else
        print_warning "Could not start PostgreSQL automatically. Please start it manually."
    fi
    
    # Wait a moment for PostgreSQL to start
    sleep 2
}

# Create database and user
setup_database() {
    print_status "Setting up PostgreSQL database..."
    
    # Database configuration
    DB_NAME="banana_sales"
    DB_USER="banana_sales_user"
    DB_PASSWORD="banana_sales_password"
    
    # Try to connect as postgres user
    if psql -U postgres -c "\l" >/dev/null 2>&1; then
        POSTGRES_USER="postgres"
    elif psql -U $(whoami) -c "\l" >/dev/null 2>&1; then
        POSTGRES_USER=$(whoami)
    else
        print_error "Cannot connect to PostgreSQL. Please ensure it's running and accessible."
        exit 1
    fi
    
    print_status "Connected to PostgreSQL as user: $POSTGRES_USER"
    
    # Create database
    print_status "Creating database: $DB_NAME"
    psql -U $POSTGRES_USER -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || print_warning "Database may already exist"
    
    # Create user
    print_status "Creating user: $DB_USER"
    psql -U $POSTGRES_USER -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || print_warning "User may already exist"
    
    # Grant privileges
    print_status "Granting privileges..."
    psql -U $POSTGRES_USER -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    psql -U $POSTGRES_USER -d $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;"
    psql -U $POSTGRES_USER -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;"
    psql -U $POSTGRES_USER -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;"
    
    # Set default privileges for future tables
    psql -U $POSTGRES_USER -d $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;"
    psql -U $POSTGRES_USER -d $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;"
    
    print_success "Database setup completed"
    
    # Create .env file
    print_status "Creating backend/.env file..."
    cat > backend/.env << EOF
# PostgreSQL Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# Server Configuration
PORT=3000
NODE_ENV=development

# Security
JWT_SECRET=banana-sales-secret-key-$(date +%s)
API_RATE_LIMIT=100

# CORS Configuration
CORS_ORIGIN=http://localhost:8000

# WebSocket Configuration
WS_HEARTBEAT_INTERVAL=30000

# Logging
LOG_LEVEL=info

# Connection Pool Settings
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=30000
DB_POOL_CONNECTION_TIMEOUT=2000

# Sync Settings
SYNC_BATCH_SIZE=100
CONFLICT_RESOLUTION_STRATEGY=last_write_wins

# Development Settings
DEBUG_SQL=false
DEBUG_WEBSOCKET=false
EOF
    
    print_success "Environment file created: backend/.env"
}

# Run database schema
setup_schema() {
    print_status "Setting up database schema..."
    
    if [ -f "database/schema.sql" ]; then
        # Try with the created user first
        if psql -h localhost -U banana_sales_user -d banana_sales -f database/schema.sql >/dev/null 2>&1; then
            print_success "Schema setup completed with banana_sales_user"
        else
            # Fallback to postgres user
            print_status "Trying with postgres user..."
            psql -U postgres -d banana_sales -f database/schema.sql
            print_success "Schema setup completed with postgres user"
        fi
    else
        print_error "Schema file not found: database/schema.sql"
        exit 1
    fi
}

# Install backend dependencies
install_backend_deps() {
    print_status "Installing backend dependencies..."
    
    if [ -d "backend" ]; then
        cd backend
        
        if [ -f "package.json" ]; then
            npm install
            print_success "Backend dependencies installed"
        else
            print_error "package.json not found in backend directory"
            exit 1
        fi
        
        cd ..
    else
        print_error "Backend directory not found"
        exit 1
    fi
}

# Test database connection
test_connection() {
    print_status "Testing database connection..."
    
    if psql -h localhost -U banana_sales_user -d banana_sales -c "SELECT 'Connection successful!' as status;" >/dev/null 2>&1; then
        print_success "Database connection test passed"
    else
        print_warning "Database connection test failed. You may need to adjust connection settings."
    fi
}

# Main setup process
main() {
    echo
    print_status "Starting setup process..."
    echo
    
    # Check prerequisites
    check_postgresql
    check_nodejs
    
    # Setup PostgreSQL
    start_postgresql
    setup_database
    setup_schema
    
    # Setup backend
    install_backend_deps
    
    # Test everything
    test_connection
    
    echo
    print_success "🎉 Setup completed successfully!"
    echo
    echo "Next steps:"
    echo "1. Start the backend server:"
    echo "   cd backend && npm start"
    echo
    echo "2. Open the application:"
    echo "   Open http://localhost:8000/app.html in your browser"
    echo
    echo "3. The backend API will be available at:"
    echo "   http://localhost:3000/api"
    echo
    echo "Database connection details:"
    echo "  Host: localhost"
    echo "  Port: 5432"
    echo "  Database: banana_sales"
    echo "  User: banana_sales_user"
    echo "  Password: banana_sales_password"
    echo
}

# Run main function
main "$@"