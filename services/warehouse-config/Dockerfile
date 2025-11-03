FROM node:20-alpine

WORKDIR /app

# Install dependencies first (leverage Docker layer caching)
COPY package*.json ./
RUN npm install

# Copy the rest of the source code
COPY . .

# Default internal port; overridden by PORT env if provided
EXPOSE 3000

# Simple healthcheck against the service's /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start in dev mode (nodemon) to enable hot reload when volume mounted
CMD ["npm", "run", "dev"]
