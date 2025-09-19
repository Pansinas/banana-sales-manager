@echo off
echo Setting up PostgreSQL database for Salero application...
echo.

REM Check if PostgreSQL is installed
where psql >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: PostgreSQL is not installed or not in PATH
    echo Please install PostgreSQL from: https://www.postgresql.org/download/windows/
    echo After installation, make sure to add PostgreSQL bin directory to your PATH
    pause
    exit /b 1
)

echo PostgreSQL found! Setting up database...
echo.

REM Create database and user
echo Creating database and user...
psql -U postgres -c "CREATE DATABASE banana_sales;"
psql -U postgres -c "CREATE USER banana_sales_user WITH PASSWORD 'banana_sales_password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE banana_sales TO banana_sales_user;"
psql -U postgres -c "ALTER USER banana_sales_user CREATEDB;"

REM Run schema setup
echo Setting up database schema...
psql -U banana_sales_user -d banana_sales -f database\schema.sql

echo.
echo Database setup complete!
echo You can now restart the backend server and the application should work.
echo.
pause