// PM2 config template — copy to ecosystem.config.cjs (gitignored) and set your port.
module.exports = {
  apps: [
    {
      name: 'frameflow',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3000, // the port your hosting panel assigned
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_restarts: 10,
      restart_delay: 1000,
    },
  ],
};
