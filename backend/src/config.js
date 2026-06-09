const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseCorsOrigins(value, serverPort) {
  const localApiOrigins = [`http://127.0.0.1:${serverPort}`, `http://localhost:${serverPort}`];

  if (!value) {
    return ['http://localhost:5173', ...localApiOrigins];
  }

  return [
    ...value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    ...localApiOrigins
  ];
}

function resolveBackendPath(value, fallback) {
  const target = value || fallback;
  if (path.isAbsolute(target)) {
    return target;
  }
  return path.resolve(__dirname, '..', target);
}

const serverPort = parseInteger(process.env.PORT, 8080);

const config = {
  server: {
    host: process.env.HOST || '127.0.0.1',
    port: serverPort
  },
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInteger(process.env.DB_PORT, 3306),
    database: process.env.DB_NAME || 'MotionAnalysis',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit: parseInteger(process.env.DB_CONNECTION_LIMIT, 10),
    queueLimit: 0,
    decimalNumbers: true,
    dateStrings: true
  },
  cors: {
    origins: [...new Set(parseCorsOrigins(process.env.CORS_ORIGIN, serverPort))]
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev_only_change_me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    admin: {
      username: process.env.ADMIN_USERNAME || 'admin',
      email: process.env.ADMIN_EMAIL || 'admin@example.com',
      password: process.env.ADMIN_PASSWORD || 'admin123456'
    }
  },
  ml: {
    pythonPath: process.env.ML_PYTHON_PATH || 'python',
    scriptPath:
      resolveBackendPath(process.env.ML_PREDICT_SCRIPT, 'ml/predict_running.py'),
    modelPath:
      resolveBackendPath(process.env.ML_MODEL_PATH, 'ml/models/running_model.joblib'),
    timeoutMs: parseInteger(process.env.ML_TIMEOUT_MS, 10000)
  }
};

module.exports = config;
