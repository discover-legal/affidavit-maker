# Use Node.js 18 LTS
FROM node:18-bullseye-slim

# Accept build arguments for React environment variables
# These must be provided during docker build via --build-arg
ARG REACT_APP_AUTH0_DOMAIN
ARG REACT_APP_AUTH0_CLIENT_ID
ARG REACT_APP_AUTH0_AUDIENCE
ARG REACT_APP_API_URL
ARG REACT_APP_STRIPE_PUBLISHABLE_KEY

# Convert build args to environment variables for the build process
ENV REACT_APP_AUTH0_DOMAIN=$REACT_APP_AUTH0_DOMAIN
ENV REACT_APP_AUTH0_CLIENT_ID=$REACT_APP_AUTH0_CLIENT_ID
ENV REACT_APP_AUTH0_AUDIENCE=$REACT_APP_AUTH0_AUDIENCE
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_STRIPE_PUBLISHABLE_KEY=$REACT_APP_STRIPE_PUBLISHABLE_KEY

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

# Build the React frontend (environment variables are now available)
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
