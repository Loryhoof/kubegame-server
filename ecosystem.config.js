module.exports = {
  apps: [
    {
      name: "myapp",
      script: "node_modules/.bin/ts-node-dev",
      args: "--respawn src/server.ts",
      watch: false, // you can set true if you want auto-reload
      env: {
        PORT: 443,
        ENVIRONMENT: "PROD",
      },
    },
  ],
};
