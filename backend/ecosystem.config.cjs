module.exports = {
  apps: [
    {
      name: 'motion-analysis-api',
      script: 'src/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      time: true,
      max_memory_restart: '512M'
    }
  ]
};
