const createApp = require('./app');
const config = require('./config');
const db = require('./db');

const app = createApp();
const server = app.listen(config.server.port, config.server.host, () => {
  console.log(`Motion Analysis API listening on http://${config.server.host}:${config.server.port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await db.closePool();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
