# Real-Time Pulse - Feature Installation Script
# This script installs dependencies and sets up the new features

Write-Host "🚀 Installing Real-Time Pulse New Features..." -ForegroundColor Cyan
Write-Host ""

# Check if we're in the backend-nest directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found. Please run this script from the backend-nest directory." -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "📦 Installing new dependencies..." -ForegroundColor Yellow
npm install pdfkit exceljs @types/pdfkit --save

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
Write-Host ""

# Generate Prisma Client
Write-Host "🔄 Generating Prisma Client..." -ForegroundColor Yellow
npx prisma generate

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to generate Prisma client" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Prisma Client generated" -ForegroundColor Green
Write-Host ""

# Check if database is accessible
Write-Host "🔍 Checking database connection..." -ForegroundColor Yellow
$env:DATABASE_URL = (Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' }) -replace 'DATABASE_URL=', ''

if (-not $env:DATABASE_URL) {
    Write-Host "⚠️  Warning: DATABASE_URL not found in .env file" -ForegroundColor Yellow
    Write-Host "Please configure your database connection before running migrations" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "✅ Database URL found" -ForegroundColor Green
    Write-Host ""
    
    # Ask user if they want to run migrations
    $runMigrations = Read-Host "Do you want to run database migrations now? (y/n)"
    
    if ($runMigrations -eq 'y' -or $runMigrations -eq 'Y') {
        Write-Host ""
        Write-Host "📊 Creating database migration..." -ForegroundColor Yellow
        npx prisma migrate dev --name add_new_features
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Failed to create migration" -ForegroundColor Red
            Write-Host "You can run migrations manually later with: npx prisma migrate dev" -ForegroundColor Yellow
        } else {
            Write-Host "✅ Database migration completed" -ForegroundColor Green
        }
    } else {
        Write-Host "⏭️  Skipping migrations. Run manually with: npx prisma migrate dev --name add_new_features" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✨ Installation Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📚 New Features Added:" -ForegroundColor White
Write-Host "  ✅ Export System (PDF, CSV, Excel)" -ForegroundColor Green
Write-Host "  ✅ AI-Powered Insights" -ForegroundColor Green
Write-Host "  ✅ Smart Alerts with Multi-Channel Notifications" -ForegroundColor Green
Write-Host "  ✅ Webhooks Platform" -ForegroundColor Green
Write-Host ""
Write-Host "📖 Documentation:" -ForegroundColor White
Write-Host "  - Feature Guide: ../FEATURES_GUIDE.md" -ForegroundColor Cyan
Write-Host "  - API Docs: http://localhost:3000/api/docs (after starting server)" -ForegroundColor Cyan
Write-Host ""
Write-Host "🚀 Next Steps:" -ForegroundColor White
Write-Host "  1. Review the .env file and add any missing configuration" -ForegroundColor Yellow
Write-Host "  2. Start the development server: npm run start:dev" -ForegroundColor Yellow
Write-Host "  3. Test the new endpoints with the examples in FEATURES_GUIDE.md" -ForegroundColor Yellow
Write-Host ""
Write-Host "🔧 Optional Configuration:" -ForegroundColor White
Write-Host "  - Add OPENAI_API_KEY for enhanced AI insights" -ForegroundColor Gray
Write-Host "  - Configure Slack webhook URLs for alerts" -ForegroundColor Gray
Write-Host "  - Set up webhook endpoints for external integrations" -ForegroundColor Gray
Write-Host ""
Write-Host "Happy coding! 🎉" -ForegroundColor Cyan
Write-Host ""
