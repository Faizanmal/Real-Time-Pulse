#!/bin/bash

echo "🚀 Setting up Real-Time Pulse Advanced Features"
echo "=============================================="

# Navigate to backend directory
cd backend-nest || exit

echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🔧 Setting up environment..."
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOF
DATABASE_URL="postgresql://postgres:password@localhost:5432/realtime_pulse?schema=public"
JWT_SECRET="your-secret-key-change-in-production"
JWT_EXPIRES_IN="7d"
REDIS_URL="redis://localhost:6379"
ENCRYPTION_KEY="your-32-character-encryption-key!"
NODE_ENV="development"
PORT="3000"
FRONTEND_URL="http://localhost:3001"
EOF
    echo "✅ .env file created"
else
    echo "✅ .env file already exists"
fi

echo ""
echo "🗄️  Setting up database..."
echo "Starting PostgreSQL and Redis with Docker..."
docker-compose up -d postgres redis || echo "⚠️  Make sure Docker is running"

echo ""
echo "⏳ Waiting for database to be ready..."
sleep 5

echo ""
echo "🔨 Generating Prisma Client..."
npx prisma generate

echo ""
echo "📊 Running database migrations..."
npx prisma migrate dev --name add_advanced_features

echo ""
echo "🌱 Seeding database with sample data..."
npx prisma db seed

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Start the backend: npm run start:dev"
echo "2. API will be available at: http://localhost:3000"
echo "3. Check the API documentation at: http://localhost:3000/api"
echo ""
echo "🎯 New features available:"
echo "  - Industry-Specific Solutions"
echo "  - Advanced AI/ML Capabilities"
echo "  - API Marketplace"
echo "  - AR Visualization"
echo "  - Workflow Automation"
echo "  - Enhanced Compliance"
echo ""
echo "📚 Documentation: /workspaces/Real-Time-Pulse/ADVANCED_FEATURES.md"
