@echo off
echo ========================================
echo Real-Time Pulse - Quick Setup
echo ========================================
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo Error: package.json not found!
    echo Please run this script from the backend-nest directory.
    pause
    exit /b 1
)

echo [1/4] Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [2/4] Generating Prisma Client...
call npx prisma generate
if %ERRORLEVEL% NEQ 0 (
    echo Failed to generate Prisma client
    pause
    exit /b 1
)

echo.
echo [3/4] Running database migrations...
call npx prisma migrate dev --name add_enterprise_features
if %ERRORLEVEL% NEQ 0 (
    echo Failed to run migrations
    echo You can run migrations manually later: npx prisma migrate dev
    pause
)

echo.
echo [4/4] Setup complete!
echo.
echo ========================================
echo Next Steps:
echo ========================================
echo 1. Review your .env file
echo 2. Start the server: npm run start:dev
echo 3. Visit: http://localhost:3000/api/docs
echo 4. Check FEATURES_GUIDE.md for usage examples
echo ========================================
echo.
pause
