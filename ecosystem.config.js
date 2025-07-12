// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'affidavit-app',
    script: './server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    
    // Restart policies
    max_memory_restart: '1G',
    restart_delay: 3000,
    autorestart: true,
    
    // Monitoring
    instance_var: 'INSTANCE_ID',
    merge_logs: true,
    
    // Graceful shutdown
    kill_timeout: 5000,
    listen_timeout: 3000,
    
    // Watch for changes (disable in production)
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'documents', '.git'],
    
    // Environment specific
    env_production: {
      NODE_ENV: 'production'
    },
    env_development: {
      NODE_ENV: 'development',
      watch: true
    }
  }],
  
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/affidavit-maker.git',
      path: '/var/www/affidavit-maker',
      'pre-deploy-local': 'npm test',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'apt-get install git nodejs npm'
    }
  }
};