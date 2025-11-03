# client/.env.example - React app environment variables

# ===========================
# REACT APP CONFIGURATION
# ===========================
# Auth0 - Frontend needs domain WITHOUT https:// prefix
REACT_APP_AUTH0_DOMAIN=your-tenant.auth0.com
REACT_APP_AUTH0_CLIENT_ID=your_client_id
REACT_APP_AUTH0_AUDIENCE=https://your-api-identifier

# API Configuration
REACT_APP_API_URL=http://localhost:3001

# Stripe - Required for payment processing
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_your_key

# Optional - Environment indicator
REACT_APP_ENVIRONMENT=development