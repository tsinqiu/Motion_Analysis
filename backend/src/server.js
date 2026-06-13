const createApp = require('./app');
const config = require('./config');
const db = require('./db');

const app = createApp();
const server = app.listen(config.server.port, config.server.host, () => {
  console.log(`Motion Analysis API listening on http://${config.server.host}:${config.server.port}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Failed to start Motion Analysis API: ${config.server.host}:${config.server.port} is already in use`);
  } else if (error.code === 'EACCES') {
    console.error(`Failed to start Motion Analysis API: permission denied for ${config.server.host}:${config.server.port}`);
  } else {
    console.error(`Failed to start Motion Analysis API: ${error.message}`);
  }
  process.exit(1);
});

const SHUTDOWN_TIMEOUT_MS = 30000;
let shuttingDown = false;

function closeServer() {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`${signal} received, shutting down`);

  const timer = setTimeout(() => {
    console.error(`Graceful shutdown timed out after ${SHUTDOWN_TIMEOUT_MS}ms`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  timer.unref?.();

  try {
    await closeServer();
    await db.closePool();
    clearTimeout(timer);
    process.exit(0);
  } catch (error) {
    clearTimeout(timer);
    console.error(`Graceful shutdown failed: ${error.message}`);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
