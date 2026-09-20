#!/bin/bash
# One-time setup script for pumpd
# Run this once: ./setup.sh

set -e

echo "🔧 pumpd Setup"
echo "=============="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 22+ from https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'.' -f1 | sed 's/v//')
if [ "$NODE_VERSION" -lt 22 ]; then
    echo "⚠️  Node.js $NODE_VERSION detected. Version 22+ recommended."
fi

echo "✓ Node.js $(node -v) detected"
echo ""

# Check for .env
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << 'EOF'
# App Configuration
RP_ID=localhost
ORIGIN=http://localhost:5173
WEB_PORT=5173
RP_NAME=pumpd
DATA_DIR=./data

# MongoDB Configuration (REQUIRED)
MONGO_URI=your_mongodb_connection_string_here
MONGO_DB=pumpd

# Optional: Admin user IDs (comma-separated)
# ADMIN_UIDS=

# Optional: Invite-only mode
# INVITE_ONLY=true
EOF
    echo "✓ Created .env file"
    echo ""
    echo "⚠️  ACTION REQUIRED: Edit .env and add your MongoDB connection string"
    echo "   Open .env and replace: MONGO_URI=your_mongodb_connection_string_here"
    echo ""
    read -p "Press Enter after updating .env, or Ctrl+C to exit..."
fi

# Validate MongoDB URI
if grep -q "your_mongodb_connection_string_here" .env 2>/dev/null; then
    echo "❌ Please update MONGO_URI in .env with your MongoDB connection string"
    exit 1
fi

echo "✓ Environment configured"
echo ""

# Install API dependencies
echo "📦 Installing API dependencies..."
cd api
npm install --silent
cd ..
echo "✓ API dependencies installed"
echo ""

# Install Frontend dependencies
echo "📦 Installing Frontend dependencies..."
cd frontend
npm install --silent
cd ..
echo "✓ Frontend dependencies installed"
echo ""

# Create data directory
mkdir -p data
echo "✓ Data directory created"
echo ""

# Migration prompt
echo "📊 Exercise Data Migration"
echo "If this is your first setup, run: npm run migrate"
echo "This loads 1,324 exercises with images into MongoDB (~140MB)"
echo ""

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Run migration (first time only): npm run migrate"
echo "  2. Start the app: npm start"
echo ""
