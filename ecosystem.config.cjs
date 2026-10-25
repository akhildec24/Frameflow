module.exports = {
  apps: [
    {
      name: 'slideshow',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3070,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3070,
      },
      max_restarts: 10,
      restart_delay: 1000,
    },
  ],
};
