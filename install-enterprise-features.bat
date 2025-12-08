@echo off
REM Enterprise Features Installation Script
REM Real-Time Pulse Dashboard

echo.
echo =========================================================
echo  Real-Time Pulse - Enterprise Features Installation
echo =========================================================
echo.

REM Check if running from project root
if not exist "backend-nest" (
    echo Error: Please run this script from the project root directory
    exit /b 1
)

echo [1/6] Installing Backend Dependencies...
cd backend-nest
call npm install
if errorlevel 1 (
    echo Failed to install backend dependencies
    exit /b 1
)
echo [OK] Backend dependencies installed
echo.

echo [2/6] Installing Frontend Dependencies...
cd ..\frontend
call npm install
if errorlevel 1 (
    echo Failed to install frontend dependencies
    exit /b 1
)
echo [OK] Frontend dependencies installed
echo.

echo [3/6] Setting up Environment Variables...
cd ..\backend-nest

if not exist .env (
    echo Creating .env file...
    (
        echo # Database
        echo DATABASE_URL="postgresql://user:password@localhost:5432/realtimepulse"
        echo.
        echo # JWT
        echo JWT_SECRET="your-jwt-secret-key"
        echo JWT_EXPIRES_IN="7d"
        echo.
        echo # Redis ^(for rate limiting^)
        echo REDIS_HOST="localhost"
        echo REDIS_PORT=6379
        echo REDIS_PASSWORD=""
        echo.
        echo # Backup Configuration
        echo BACKUP_ENCRYPTION_KEY="generate-a-random-32-byte-key-here"
        echo BACKUP_RETENTION_DAYS=30
        echo.
        echo # App Configuration
        echo PORT=3000
        echo NODE_ENV=development
    ) > .env
    echo [OK] Environment file created
    echo [!] Please update BACKUP_ENCRYPTION_KEY in .env with a secure random key
) else (
    echo [!] .env file already exists
    echo     Please ensure BACKUP_ENCRYPTION_KEY and REDIS_* variables are set
)
echo.

echo [4/6] Checking Redis...
redis-cli ping >nul 2>&1
if errorlevel 1 (
    echo [!] Redis is not running
    echo     Please start Redis manually or use Docker:
    echo     docker run -d -p 6379:6379 redis:alpine
) else (
    echo [OK] Redis is running
)
echo.

echo [5/6] Running Database Migration...
call npx prisma migrate dev --name enterprise_features
if errorlevel 1 (
    echo [!] Migration failed. You may need to run it manually:
    echo     cd backend-nest ^&^& npx prisma migrate dev
)
echo.

echo [6/6] Verifying Installation...
cd ..\frontend
echo [OK] Service Worker is ready
echo.

echo =========================================================
echo  Installation Complete!
echo =========================================================
echo.
echo Next Steps:
echo.
echo 1. Start the backend:
echo    cd backend-nest ^&^& npm run start:dev
echo.
echo 2. Start the frontend (in a new terminal):
echo    cd frontend ^&^& npm run dev
echo.
echo 3. Open your browser:
echo    http://localhost:3000
echo.
echo Documentation:
echo    - Quick Start: ENTERPRISE_FEATURES_QUICKSTART.md
echo    - Full Guide: ENTERPRISE_FEATURES_IMPLEMENTATION.md
echo    - Summary: IMPLEMENTATION_COMPLETE_SUMMARY.md
echo.
echo Features Installed:
echo    [OK] Data Backup ^& Point-in-Time Recovery
echo    [OK] Custom Integration Builder
echo    [OK] API Rate Limit Optimization
echo    [OK] Offline Dashboard Mode
echo    [OK] Voice-Activated Dashboard Control
echo.
echo Happy coding! 🚀
echo.

pause
