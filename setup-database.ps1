Write-Host "Setting up PostgreSQL database for Salero application..." -ForegroundColor Green
Write-Host ""

# Check if PostgreSQL is installed
try {
    $null = Get-Command psql -ErrorAction Stop
    Write-Host "PostgreSQL found! Setting up database..." -ForegroundColor Green
} catch {
    Write-Host "ERROR: PostgreSQL is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install PostgreSQL from: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    Write-Host "After installation, make sure to add PostgreSQL bin directory to your PATH" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Get PostgreSQL password
$postgresPassword = Read-Host "Enter the password for PostgreSQL 'postgres' user" -AsSecureString
$postgresPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($postgresPassword))

# Set environment variable for password
$env:PGPASSWORD = $postgresPasswordPlain

try {
    # Create database and user
    Write-Host "Creating database and user..." -ForegroundColor Yellow
    
    psql -U postgres -c "CREATE DATABASE banana_sales;"
    if ($LASTEXITCODE -ne 0) { throw "Failed to create database" }
    
    psql -U postgres -c "CREATE USER banana_sales_user WITH PASSWORD 'banana_sales_password';"
    if ($LASTEXITCODE -ne 0) { throw "Failed to create user" }
    
    psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE banana_sales TO banana_sales_user;"
    if ($LASTEXITCODE -ne 0) { throw "Failed to grant privileges" }
    
    psql -U postgres -c "ALTER USER banana_sales_user CREATEDB;"
    if ($LASTEXITCODE -ne 0) { throw "Failed to alter user" }

    # Run schema setup
    Write-Host "Setting up database schema..." -ForegroundColor Yellow
    $env:PGPASSWORD = "banana_sales_password"
    psql -U banana_sales_user -d banana_sales -f "database\schema.sql"
    if ($LASTEXITCODE -ne 0) { throw "Failed to setup schema" }

    Write-Host ""
    Write-Host "Database setup complete!" -ForegroundColor Green
    Write-Host "You can now restart the backend server and the application should work." -ForegroundColor Green
    
} catch {
    Write-Host "Error during setup: $_" -ForegroundColor Red
} finally {
    # Clear password from environment
    $env:PGPASSWORD = $null
}

Write-Host ""
Read-Host "Press Enter to exit"