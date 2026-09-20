# Build stage for frontend
FROM node:22-alpine AS frontend-build

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Install API dependencies
COPY api/package*.json ./api/
RUN cd api && npm ci --omit=dev

# Copy API source
COPY api/ ./api/

# Copy built frontend from build stage
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Create data directory for VAPID keys and other persistent data
RUN mkdir -p /app/data && chmod 755 /app/data

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data

# Start the API server (which also serves the frontend)
CMD ["node", "api/server.js"]
