# Use Node.js 18 LTS
FROM node:18-bullseye-slim

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install backend dependencies
RUN npm ci --only=production

# Copy client package files
COPY client/package*.json ./client/

# Install client dependencies (including devDependencies needed for build)
WORKDIR /app/client
RUN npm ci

# Copy all application files
WORKDIR /app
COPY . .

# Build the React frontend
WORKDIR /app/client
RUN npm run build

# Back to app root
WORKDIR /app

# Create documents directory for ephemeral PDF storage
RUN mkdir -p documents

# Expose the port (Render will override with PORT env var)
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3001) + '/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); });"

# Start the application (migrations will run via start command in render.yaml)
CMD ["node", "server.js"]
