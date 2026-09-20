#!/bin/bash
# Simple start script for pumpd
# Usage: ./start.sh

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load environment
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo "❌ .env not found. Run ./setup.sh first"
    exit 1
fi

source "$PROJECT_DIR/.env"

# Set defaults and export all necessary variables
export API_PORT=${PORT:-3000}
export FRONTEND_PORT=${WEB_PORT:-5173}
export PORT=$API_PORT
export RP_ID=${RP_ID:-localhost}
export ORIGIN=${ORIGIN:-http://localhost:$FRONTEND_PORT}
export RP_NAME=${RP_NAME:-pumpd}
export DATA_DIR=${DATA_DIR:-$PROJECT_DIR/data}
export MONGO_URI=$MONGO_URI
export MONGO_DB=${MONGO_DB:-pumpd}

# Validate MongoDB URI
if [ -z "$MONGO_URI" ] || [ "$MONGO_URI" = "your_mongodb_connection_string_here" ]; then
    echo "❌ MONGO_URI not configured in .env"
    echo "   Please add your MongoDB connection string"
    exit 1
fi

echo "🚀 Starting pumpd"
echo "================"
echo ""
echo "  Frontend: http://localhost:$FRONTEND_PORT"
echo "  API:      http://localhost:$API_PORT"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Cleanup handler
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start API
echo "📡 Starting API..."
cd "$PROJECT_DIR/api"
PORT=$API_PORT node server.js &
API_PID=$!

# Wait for API
sleep 2

# Start Frontend
echo "⚛️  Starting Frontend..."
cd "$PROJECT_DIR/frontend"
API_TARGET="http://127.0.0.1:$API_PORT" npm run dev -- --port $FRONTEND_PORT &
FRONTEND_PID=$!

echo ""
echo "✓ Services running"
echo ""

# Wait for processes
wait
