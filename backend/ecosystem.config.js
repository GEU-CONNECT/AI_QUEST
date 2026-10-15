module.exports = {
  apps: [
    {
      name: 'aiquest-backend',
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 5005
      }
    }
  ]
};
