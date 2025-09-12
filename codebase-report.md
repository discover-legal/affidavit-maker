# AFFIDAVIT_MAKER_PROJECT::LLM_OPTIMIZED_KNOWLEDGE_BASE::v1.0

## META::PROJECT_IDENTIFICATION
```
PROJECT_NAME: "Affidavit Maker"
PROJECT_TYPE: "SaaS Legal Document Generation Platform"
PRIMARY_DOMAIN: "Legal Technology"
DEPLOYMENT_STATUS: "Production"
LAST_UPDATED: "2025-09-04"
INTENDED_FOR_UPDATES: true
OPTIMIZATION_TARGET: "LLM_PARSING"
```

## ARCHITECTURE::COMPONENT_GRAPH
```yaml
COMPONENTS:
  frontend:
    id: "COMP_001"
    type: "CLIENT_APPLICATION"
    technology: ["React@18", "Tailwind_CSS", "Lucide_React"]
    location: "./client"
    entry_point: "./client/src/App.js"
    port: 3000
    dependencies: ["COMP_002", "COMP_007"]
    state_management: "React_Hooks+Context_API"
    routing: "React_Router_v6"
    
  backend:
    id: "COMP_002"
    type: "API_SERVER"
    technology: ["Node.js@16+", "Express@4.x"]
    location: "./server.js"
    port: 3001
    dependencies: ["COMP_003", "COMP_004", "COMP_005", "COMP_006"]
    middleware_stack: ["helmet", "cors", "compression", "morgan", "auth0", "rate_limiting"]
    
  database:
    id: "COMP_003"
    type: "PERSISTENT_STORAGE"
    technology: "PostgreSQL@13+"
    schema_file: "./database-schema.sql"
    connection_pool: {max: 25, idle_timeout: 10000}
    tables: ["users", "documents", "payments", "activity_logs", "sessions", "email_notifications", "document_templates", "api_keys"]
    
  ai_service:
    id: "COMP_004"
    type: "EXTERNAL_AI"
    technology: "OpenAI_GPT-4"
    wrapper: "./services/ResilientOpenAIService.js"
    features: ["circuit_breaker", "retry_policy", "caching", "fallback_responses"]
    timeout: 45000
    max_retries: 3
    
  auth_service:
    id: "COMP_005"
    type: "AUTHENTICATION"
    technology: "Auth0"
    middleware: "./middleware/auth0Middleware.js"
    features: ["JWT_verification", "RBAC", "MFA_support"]
    
  payment_service:
    id: "COMP_006"
    type: "PAYMENT_PROCESSOR"
    technology: "Stripe"
    routes: "./routes/payment.js"
    webhook_endpoint: "/api/webhooks/stripe"
    
  template_engine:
    id: "COMP_007"
    type: "DOCUMENT_GENERATOR"
    technology: "Custom_StateTemplateManager"
    location: "./templates/StateTemplateManager.js"
    supported_states: ["TX", "UT", "AZ"]
```

## DATA_FLOW::PROCESSING_PIPELINES
```yaml
PIPELINE_CHAT_PROCESSING:
  trigger: "POST /api/chat"
  flow:
    - validate_input: {max_length: 5000, sanitize: true}
    - check_authentication: {optional: false}
    - rate_limit: {window: 60s, max_requests: 30}
    - process_with_ai:
        service: "ResilientOpenAIService"
        method: "processMessage"
        context: {conversation_history: true, affidavit_data: true}
    - extract_facts: {categories: ["financial", "property", "relational", "temporal", "witness", "communication", "parental"]}
    - validate_facts: {legal_requirements: true, state_specific: true}
    - update_document: {merge_strategy: "incremental"}
    - generate_preview: {real_time: true}
    - persist_to_db: {table: "documents", status: "draft"}
    - return_response: {format: "json", include_preview: true}

PIPELINE_DOCUMENT_GENERATION:
  trigger: "POST /api/generate-affidavit"
  flow:
    - validate_completeness: {required_fields: ["affiantName", "state", "facts"]}
    - check_payment_status: {require_payment: true}
    - apply_state_template: {dynamic: true}
    - legal_formatting: {jurisdiction_specific: true}
    - pdf_generation: {engine: "puppeteer", format: "letter"}
    - store_document: {encrypt: true}
    - log_activity: {type: "document_generated"}
```

## IMPLEMENTATION::CORE_ALGORITHMS
```yaml
ALGORITHM_FACT_EXTRACTION:
  location: "./affidavitService.js::processMessage"
  approach: "CONSOLIDATED_LLM_FUNCTION_CALLING"
  steps:
    1: "Single LLM call with function definitions"
    2: "Extract facts with categories simultaneously"
    3: "Professional rewriting in same call"
    4: "Legal validation inline"
  optimization: "Reduced from 4 LLM calls to 1"
  categories:
    financial: {subcategories: ["income", "assets", "debts", "payments", "support", "expenses"]}
    property: {subcategories: ["real_estate", "personal_property", "vehicles", "intellectual_property"]}
    relational: {subcategories: ["family", "custody", "visitation", "marriage", "divorce"]}
    temporal: {subcategories: ["dates", "timelines", "sequences", "duration"]}
    witness: {subcategories: ["observations", "conversations", "events", "actions"]}
    communication: {subcategories: ["verbal", "written", "electronic", "legal_notices"]}
    parental: {subcategories: ["childcare", "education", "health", "environment", "routines"]}

ALGORITHM_RESILIENT_AI:
  location: "./services/ResilientOpenAIService.js"
  patterns:
    circuit_breaker: {threshold: 5, timeout: 120000, half_open_attempts: 3}
    retry_policy: {max_attempts: 3, backoff: "exponential", initial_delay: 1000}
    caching: {ttl: 300000, max_size: 100}
    fallback: {static_responses: true, degraded_mode: true}
```

## STATE_SPECIFIC::LEGAL_REQUIREMENTS
```yaml
TEXAS:
  code: "TX"
  requirements:
    venue: {required: true, format: "STATE OF TEXAS\nCOUNTY OF [COUNTY]"}
    county: {required: true, validation: "must_be_valid_texas_county"}
    notary: {format: "texas_specific", seal_required: true}
    jurat: {language: "SWORN TO AND SUBSCRIBED BEFORE ME"}
    
UTAH:
  code: "UT"
  requirements:
    venue: {required: true, format: "STATE OF UTAH\nCOUNTY OF [COUNTY]"}
    county: {required: true, validation: "must_be_valid_utah_county"}
    notary: {format: "utah_specific", electronic_allowed: true}
    verification: {type: "verification_upon_oath"}
    
ARIZONA:
  code: "AZ"
  requirements:
    venue: {required: false}
    county: {required: false}
    notary: {format: "arizona_specific"}
    acknowledgment: {type: "standard_acknowledgment"}
```

## SECURITY::DEFENSE_LAYERS
```yaml
LAYER_1_TRANSPORT:
  protocol: "HTTPS"
  certificate: "Let's Encrypt"
  headers: ["HSTS", "CSP", "X-Frame-Options"]
  
LAYER_2_AUTHENTICATION:
  provider: "Auth0"
  method: "JWT"
  validation: {audience: true, issuer: true, expiration: true}
  
LAYER_3_AUTHORIZATION:
  pattern: "RBAC"
  middleware: "./middleware/auth0Middleware.js"
  document_ownership: {verify: true}
  
LAYER_4_INPUT_VALIDATION:
  middleware: "./middleware/securityMiddleware.js"
  sanitization: ["XSS_prevention", "SQL_injection_prevention"]
  validation_rules: {stored_in: "middleware/validationSchemas.js"}
  
LAYER_5_RATE_LIMITING:
  anonymous: {window: 60s, max: 10}
  authenticated: {window: 60s, max: 100}
  payment_endpoints: {window: 60s, max: 5}
```

## DATABASE::SCHEMA_RELATIONSHIPS
```sql
RELATIONSHIPS:
  users->documents: "1:N CASCADE_DELETE"
  users->payments: "1:N CASCADE_DELETE"
  documents->payments: "1:1 NULLABLE"
  users->activity_logs: "1:N SET_NULL"
  users->sessions: "1:N CASCADE_DELETE"
  users->email_notifications: "1:N CASCADE_DELETE"
  users->document_templates: "1:N CASCADE_DELETE"
  users->api_keys: "1:N CASCADE_DELETE"
  
INDEXES:
  - users: ["auth0_id", "email"]
  - documents: ["user_id", "status", "created_at"]
  - payments: ["stripe_payment_intent_id", "user_id", "status"]
  - activity_logs: ["user_id", "created_at", "action"]
  
JSONB_FIELDS:
  documents.content: {structure: "affidavit_data"}
  documents.conversation_history: {structure: "chat_messages[]"}
  documents.validation_results: {structure: "validation_output"}
  payments.metadata: {structure: "stripe_metadata"}
```

## API::ENDPOINT_MATRIX
```yaml
PUBLIC_ENDPOINTS:
  GET /health: {auth: false, rate_limit: "none"}
  GET /api/templates/states: {auth: false, cache: 3600}
  POST /api/preview: {auth: "optional", validation: true}
  
PROTECTED_ENDPOINTS:
  POST /api/chat: {auth: true, rate_limit: 30, timeout: 30000}
  POST /api/save-draft: {auth: true, ownership: true}
  GET /api/documents: {auth: true, pagination: true}
  POST /api/generate-affidavit: {auth: true, payment: true}
  GET /api/download/:id: {auth: true, ownership: true}
  
PAYMENT_ENDPOINTS:
  POST /api/payment/create-intent: {auth: true, idempotent: true}
  POST /api/payment/confirm: {auth: true, webhook: true}
  POST /api/webhooks/stripe: {auth: "webhook_signature", async: true}
```

## PERFORMANCE::OPTIMIZATIONS
```yaml
CONNECTION_POOLING:
  database: {min: 5, max: 25, idle: 10000}
  
CACHING_STRATEGY:
  ai_responses: {ttl: 300s, key: "message_hash"}
  templates: {ttl: 3600s, invalidate_on: "deploy"}
  user_sessions: {store: "memory", ttl: 86400s}
  
ASYNC_PROCESSING:
  pdf_generation: {queue: "in_memory", workers: 2}
  email_notifications: {batch: true, interval: 60s}
  
COMPRESSION:
  responses: {threshold: 1kb, algorithm: "gzip"}
  static_assets: {cache_control: "1y", etag: true}
```

## TESTING::COVERAGE_MATRIX
```yaml
UNIT_TESTS:
  coverage_target: 80
  locations: ["./__tests__", "./client/src/**/*.test.js"]
  frameworks: ["Jest", "React Testing Library"]
  
INTEGRATION_TESTS:
  api_endpoints: {coverage: "100%", tool: "supertest"}
  database_operations: {transactions: true, rollback: true}
  
E2E_TESTS:
  user_journeys: ["signup", "create_affidavit", "payment", "download"]
  tools: ["Playwright", "Cypress"]
```

## DEPLOYMENT::INFRASTRUCTURE
```yaml
ENVIRONMENT_PROGRESSION:
  development: {branch: "develop", auto_deploy: false}
  staging: {branch: "staging", auto_deploy: true}
  production: {branch: "main", manual_approval: true}
  
PROCESS_MANAGEMENT:
  tool: "PM2"
  config: "./ecosystem.config.js"
  features: ["clustering", "auto_restart", "log_rotation"]
  
MONITORING:
  application: ["PM2 metrics", "Winston logs"]
  infrastructure: ["Nginx access logs", "PostgreSQL slow queries"]
  business: ["Stripe webhooks", "document generation rate"]
```

## ERROR_HANDLING::STRATEGIES
```yaml
GRACEFUL_DEGRADATION:
  ai_failure: {fallback: "basic_template", notify_user: true}
  payment_failure: {retry: 3, save_draft: true}
  database_failure: {circuit_break: true, cache_response: true}
  
LOGGING_HIERARCHY:
  error: {persistent: true, alert: true, file: "logs/error.log"}
  warn: {persistent: true, file: "logs/combined.log"}
  info: {persistent: true, file: "logs/combined.log"}
  debug: {development_only: true, console: true}
```

## BUSINESS_LOGIC::RULES
```yaml
PRICING:
  single_affidavit: {price_cents: 999, currency: "USD"}
  subscription_tiers:
    free: {documents_per_month: 0, preview_only: true}
    pro: {documents_per_month: 10, price_cents: 2999}
    enterprise: {unlimited: true, api_access: true, custom_pricing: true}
    
DOCUMENT_LIFECYCLE:
  states: ["draft", "completed", "paid", "generated", "downloaded"]
  transitions:
    draft->completed: {requires: "all_required_fields"}
    completed->paid: {requires: "successful_payment"}
    paid->generated: {automatic: true, async: true}
    generated->downloaded: {track: true, limit: "unlimited"}
```

## FUTURE::SCALABILITY_PATHS
```yaml
IMMEDIATE_SCALING:
  database: {read_replicas: true, connection_pool: 50}
  caching: {redis: true, CDN: "CloudFlare"}
  
MEDIUM_TERM:
  microservices: ["pdf_generation", "ai_processing", "payment"]
  queue_system: "RabbitMQ || AWS_SQS"
  storage: "S3 || Google_Cloud_Storage"
  
LONG_TERM:
  multi_region: {databases: "replicated", cdn: "global"}
  kubernetes: {orchestration: true, auto_scaling: true}
  event_sourcing: {audit_trail: "complete", replay: true}
```

## KNOWLEDGE_UPDATE_PROTOCOL
```
This knowledge base is designed for continuous updates.
When updating:
1. Maintain existing structure and notation
2. Add new components with unique IDs
3. Update relationships explicitly
4. Increment version number
5. Add update timestamp
6. Preserve all existing context
```

## END::METADATA
```
GENERATION_DATE: "2025-09-04"
GENERATOR: "Claude-3.5"
PURPOSE: "LLM-optimized project knowledge persistence"
UPDATE_FREQUENCY: "per_significant_change"
PARSING_OPTIMIZATION: "maximum_density"
```