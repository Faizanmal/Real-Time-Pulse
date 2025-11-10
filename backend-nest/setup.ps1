# Portal Backend - Quick Start Script
# This script sets up the development environment on Windows

Write-Host "🚀 Portal Backend - Quick Start" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker..." -ForegroundColor Yellow
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
    $useDocker = Read-Host "Do you want to use Docker Compose? (Y/n)"
    if ($useDocker -eq "" -or $useDocker -eq "Y" -or $useDocker -eq "y") {
        Write-Host ""
        Write-Host "Starting services with Docker Compose..." -ForegroundColor Yellow
        docker-compose up -d
        
        Write-Host ""
        Write-Host "Waiting for services to be ready..." -ForegroundColor Yellow
        Start-Sleep -Seconds 10
        
        Write-Host ""
        Write-Host "Running database migrations..." -ForegroundColor Yellow
        npx prisma generate
        npx prisma migrate dev --name init
        
        Write-Host ""
        Write-Host "✅ Setup complete!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Services running:" -ForegroundColor Cyan
        Write-Host "  - API: http://localhost:3000/api" -ForegroundColor White
        Write-Host "  - Health: http://localhost:3000/api/health" -ForegroundColor White
        Write-Host "  - PostgreSQL: localhost:5432" -ForegroundColor White
        Write-Host "  - Redis: localhost:6379" -ForegroundColor White
        Write-Host ""
        Write-Host "Useful commands:" -ForegroundColor Cyan
        Write-Host "  - View logs: docker-compose logs -f backend" -ForegroundColor White
        Write-Host "  - Stop services: docker-compose down" -ForegroundColor White
        Write-Host "  - Prisma Studio: npx prisma studio" -ForegroundColor White
        exit
    }
} catch {
    Write-Host "⚠️  Docker is not running. Continuing with manual setup..." -ForegroundColor Yellow
}

# Manual setup
Write-Host ""
Write-Host "Manual Setup Mode" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (!(Test-Path ".env")) {
    Write-Host "Creating .env file..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✅ .env created. Please edit it with your database credentials." -ForegroundColor Green
    Write-Host ""
    $continue = Read-Host "Press Enter after editing .env to continue..."
}

# Install dependencies
if (!(Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✅ Dependencies already installed" -ForegroundColor Green
}

Write-Host ""
Write-Host "Generating Prisma Client..." -ForegroundColor Yellow
npx prisma generate
Write-Host "✅ Prisma Client generated" -ForegroundColor Green

Write-Host ""
Write-Host "Running database migrations..." -ForegroundColor Yellow
try {
    npx prisma migrate dev --name init
    Write-Host "✅ Database migrations completed" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Database migration failed. Make sure PostgreSQL is running." -ForegroundColor Red
    Write-Host "   Check your DATABASE_URL in .env" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Make sure PostgreSQL and Redis are running" -ForegroundColor White
Write-Host "  2. Start the development server: npm run start:dev" -ForegroundColor White
Write-Host "  3. Open Prisma Studio: npx prisma studio" -ForegroundColor White
Write-Host ""
Write-Host "Would you like to start the development server now? (Y/n)" -ForegroundColor Yellow
$startServer = Read-Host

if ($startServer -eq "" -or $startServer -eq "Y" -or $startServer -eq "y") {
    Write-Host ""
    Write-Host "Starting development server..." -ForegroundColor Yellow
    npm run start:dev
}
