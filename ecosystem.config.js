module.exports = {
  apps : [{
    name: 'retellai-shim',
    script: 'app.js',
    instance_var: 'INSTANCE_ID',
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      LOGLEVEL: 'info',
      HTTP_PORT: 3000,
      JAMBONZ_ACCOUNT_SID: 'your_account_sid',
      JAMBONZ_API_KEY: 'your_api_key',
      JAMBONZ_REST_API_BASE_URL: 'https://sip.svpgroup.biz/api/v1', // or replace with your own self-hosted jambonz URL
      RETELL_API_KEY: 'your_retell_api_key',
      RETELL_AGENT_ID: 'your_retell_agent_id'
    }
  }]
};
