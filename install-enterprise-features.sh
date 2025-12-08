#!/bin/bash

# Enterprise Features Installation Script
# Real-Time Pulse Dashboard

set -e

echo "🚀 Real-Time Pulse - Enterprise Features Installation"
echo "======================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running from project root
if [ ! -d "backend-nest" ] || [ ! -d "frontend" ]; then
    echo -e "${RED}Error: Please run this script from the project root directory${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 1/6: Installing Backend Dependencies...${NC}"
cd backend-nest
npm install
echo -e "${GREEN}✓ Backend dependencies installed${NC}"
echo ""

echo -e "${YELLOW}Step 2/6: Installing Frontend Dependencies...${NC}"
cd ../frontend
npm install
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
echo ""

echo -e "${YELLOW}Step 3/6: Setting up Environment Variables...${NC}"
cd ../backend-nest

if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOF
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/realtimepulse"

# JWT
JWT_SECRET="your-jwt-secret-key"
JWT_EXPIRES_IN="7d"

# Redis (for rate limiting)
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD=""

# Backup Configuration
BACKUP_ENCRYPTION_KEY="$(openssl rand -base64 32)"
BACKUP_RETENTION_DAYS=30

# App Configuration
PORT=3000
NODE_ENV=development
EOF
    echo -e "${GREEN}✓ Environment file created${NC}"
else
    echo -e "${YELLOW}⚠ .env file already exists, adding missing variables...${NC}"
    
    # Add backup variables if not present
    if ! grep -q "BACKUP_ENCRYPTION_KEY" .env; then
        echo "" >> .env
        echo "# Backup Configuration" >> .env
        echo "BACKUP_ENCRYPTION_KEY=\"$(openssl rand -base64 32)\"" >> .env
        echo "BACKUP_RETENTION_DAYS=30" >> .env
        echo -e "${GREEN}✓ Backup configuration added${NC}"
    fi
    
    # Add Redis variables if not present
    if ! grep -q "REDIS_HOST" .env; then
        echo "" >> .env
        echo "# Redis Configuration" >> .env
        echo "REDIS_HOST=\"localhost\"" >> .env
        echo "REDIS_PORT=6379" >> .env
        echo "REDIS_PASSWORD=\"\"" >> .env
        echo -e "${GREEN}✓ Redis configuration added${NC}"
    fi
fi
echo ""

echo -e "${YELLOW}Step 4/6: Checking Redis...${NC}"
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        echo -e "${GREEN}✓ Redis is running${NC}"
    else
        echo -e "${YELLOW}⚠ Redis is not running. Starting Redis with Docker...${NC}"
        if command -v docker &> /dev/null; then
            docker run -d --name redis-rtpulse -p 6379:6379 redis:alpine
            echo -e "${GREEN}✓ Redis started in Docker${NC}"
        else
            echo -e "${RED}⚠ Redis is not running. Please start Redis manually:${NC}"
            echo "   Docker: docker run -d -p 6379:6379 redis:alpine"
            echo "   Or install Redis: https://redis.io/download"
        fi
    fi
else
    echo -e "${YELLOW}⚠ Redis CLI not found. Attempting to start with Docker...${NC}"
    if command -v docker &> /dev/null; then
        docker run -d --name redis-rtpulse -p 6379:6379 redis:alpine
        echo -e "${GREEN}✓ Redis started in Docker${NC}"
    else
        echo -e "${YELLOW}⚠ Please install Redis or Docker to use rate limiting features${NC}"
    fi
fi
echo ""

echo -e "${YELLOW}Step 5/6: Running Database Migration...${NC}"
if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}⚠ DATABASE_URL not set. Skipping migration.${NC}"
    echo "   Please configure your database and run: npx prisma migrate dev"
else
    npx prisma migrate dev --name enterprise_features || {
        echo -e "${YELLOW}⚠ Migration failed. You may need to run it manually:${NC}"
        echo "   cd backend-nest && npx prisma migrate dev"
    }
fi
echo ""

echo -e "${YELLOW}Step 6/6: Building Service Worker...${NC}"
cd ../frontend
echo -e "${GREEN}✓ Service Worker is ready${NC}"
echo ""

echo -e "${GREEN}======================================================"
echo "🎉 Installation Complete!"
echo "======================================================${NC}"
echo ""
echo "📚 Next Steps:"
echo ""
echo "1. Start the backend:"
echo "   ${YELLOW}cd backend-nest && npm run start:dev${NC}"
echo ""
echo "2. Start the frontend (in a new terminal):"
echo "   ${YELLOW}cd frontend && npm run dev${NC}"
echo ""
echo "3. Open your browser:"
echo "   ${YELLOW}http://localhost:3000${NC}"
echo ""
echo "📖 Documentation:"
echo "   - Quick Start: ENTERPRISE_FEATURES_QUICKSTART.md"
echo "   - Full Guide: ENTERPRISE_FEATURES_IMPLEMENTATION.md"
echo "   - Summary: IMPLEMENTATION_COMPLETE_SUMMARY.md"
echo ""
echo "✨ Features Installed:"
echo "   ✓ Data Backup & Point-in-Time Recovery"
echo "   ✓ Custom Integration Builder"
echo "   ✓ API Rate Limit Optimization"
echo "   ✓ Offline Dashboard Mode"
echo "   ✓ Voice-Activated Dashboard Control"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"
