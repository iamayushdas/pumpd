#!/bin/bash
# Local development runner for pumpd
# Runs API (with MongoDB Atlas) and frontend dev server

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_PORT=${API_PORT:-3000}
FRONTEND_PORT=${FRONTEND_PORT:-5173}

# Load .env file (properly handles quoted values with spaces)
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi

# Set defaults if not in .env
export RP_ID=${RP_ID:-localhost}
export ORIGIN=${ORIGIN:-http://localhost:$FRONTEND_PORT}
export RP_NAME=${RP_NAME:-pumpd}
export DATA_DIR=${DATA_DIR:-$PROJECT_DIR/data}
export PORT=$API_PORT

echo "🚀 Starting pumpd development environment..."
echo "  API & Media: http://localhost:$API_PORT"
echo "  Frontend:    http://localhost:$FRONTEND_PORT"
echo ""

# Create data directory if it doesn't exist
mkdir -p "$DATA_DIR"

# Cleanup function
cleanup() {
  echo ""
  echo "🛑 Shutting down..."
  kill $(jobs -p) 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM

# Start API server (serves API, exercise JSON, images and GIFs directly from MongoDB)
echo "📡 Starting API server..."
cd "$PROJECT_DIR/api"
node server.js &
API_PID=$!

# Give API time to start
sleep 2

# Start frontend dev server
echo "⚛️  Starting frontend dev server..."
cd "$PROJECT_DIR/frontend"
API_TARGET="http://127.0.0.1:$API_PORT" npm run dev &
FRONTEND_PID=$!

echo ""
echo "✓ All services running!"
echo ""
echo "  Frontend: http://localhost:$FRONTEND_PORT"
echo "  API:      http://localhost:$API_PORT"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for all background processes
wait
