const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const BACKEND_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseProviderOrder(value) {
  const supported = new Set(['deepseek', 'ollama']);
  const providers = String(value || 'deepseek,ollama')
    .split(',')
    .map((provider) => provider.trim().toLowerCase())
    .filter((provider) => supported.has(provider));
  return providers.length ? providers : ['deepseek', 'ollama'];
}

function parseCorsOrigins(value, serverPort) {
  const localApiOrigins = [`http://127.0.0.1:${serverPort}`, `http://localhost:${serverPort}`];
  const localFrontendOrigins = ['http://127.0.0.1:5173', 'http://localhost:5173'];

  if (!value) {
    return [...localFrontendOrigins, ...localApiOrigins];
  }

  return [
    ...value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    ...localFrontendOrigins,
    ...localApiOrigins
  ];
}

function resolveBackendPath(value, fallback) {
  const target = value || fallback;
  if (path.isAbsolute(target)) {
    return target;
  }
  return path.resolve(BACKEND_ROOT, target);
}

function resolveProjectPath(value, fallback) {
  const target = value || fallback;
  if (path.isAbsolute(target)) {
    return target;
  }
  if (value && target.startsWith('..')) {
    return path.resolve(BACKEND_ROOT, target);
  }
  return path.resolve(PROJECT_ROOT, target);
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
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    admin: {
      username: process.env.ADMIN_USERNAME || 'admin',
      email: process.env.ADMIN_EMAIL || 'admin@example.com',
      password: process.env.ADMIN_PASSWORD || ''
    }
  },
  cache: {
    statsTtlSeconds: parseInteger(process.env.STATS_CACHE_TTL_SECONDS, 60)
  },
  uploads: {
    root: resolveBackendPath(process.env.UPLOAD_ROOT, 'uploads'),
    exploreVideosDir: resolveBackendPath(process.env.EXPLORE_VIDEO_UPLOAD_DIR, 'uploads/explore-videos'),
    exploreImagesDir: resolveBackendPath(process.env.EXPLORE_IMAGE_UPLOAD_DIR, 'uploads/explore-images'),
    communityImagesDir: resolveBackendPath(process.env.COMMUNITY_IMAGE_UPLOAD_DIR, 'uploads/community-images'),
    maxVideoBytes: parseInteger(process.env.EXPLORE_VIDEO_MAX_BYTES, 200 * 1024 * 1024),
    maxImageBytes: parseInteger(process.env.IMAGE_UPLOAD_MAX_BYTES, 10 * 1024 * 1024)
  },
  ml: {
    pythonPath: process.env.ML_PYTHON_PATH || 'python',
    scriptPath:
      resolveBackendPath(process.env.ML_PREDICT_SCRIPT, 'ml/predict_running.py'),
    modelPath:
      resolveBackendPath(process.env.ML_MODEL_PATH, 'ml/models/running_model.joblib'),
    timeoutMs: parseInteger(process.env.ML_TIMEOUT_MS, 10000)
  },
  ai: {
    provider: (process.env.AI_PROVIDER || 'auto').toLowerCase(),
    providerOrder: parseProviderOrder(process.env.AI_PROVIDER_ORDER),
    model: process.env.AI_MODEL || process.env.AI_DEEPSEEK_MODEL || process.env.AI_OLLAMA_MODEL || 'deepseek-chat',
    deepseekBaseUrl: process.env.AI_DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    deepseekApiKey: process.env.DEEPSEEK_API_KEY || process.env.AI_DEEPSEEK_API_KEY || '',
    deepseekModel: process.env.AI_DEEPSEEK_MODEL || process.env.AI_MODEL || 'deepseek-chat',
    ollamaBaseUrl: process.env.AI_OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
    ollamaModel: process.env.AI_OLLAMA_MODEL || process.env.AI_MODEL || 'qwen2.5:3b-instruct',
    timeoutMs: parseInteger(process.env.AI_TIMEOUT_MS, 60000),
    fallbackRules: process.env.AI_FALLBACK_RULES !== 'false'
  },
  garmin: {
    pythonPath: process.env.GARMIN_PYTHON_PATH || process.env.ML_PYTHON_PATH || 'python',
    downloadScriptPath: resolveProjectPath(
      process.env.GARMIN_DOWNLOAD_SCRIPT,
      'database/scripts/download_garmin_connect.py'
    ),
    importScriptPath: resolveProjectPath(
      process.env.GARMIN_IMPORT_SCRIPT,
      'database/scripts/import_fit_files.py'
    ),
    tokenBaseDir: resolveProjectPath(
      process.env.GARMIN_TOKEN_BASE_DIR,
      'database/.garmin_tokens/users'
    ),
    syncWorkDir: resolveProjectPath(
      process.env.GARMIN_SYNC_WORK_DIR,
      'database/data/garmin_sync'
    ),
    jsonMode: process.env.GARMIN_JSON_MODE || 'summary',
    chunkDays: parseInteger(process.env.GARMIN_CHUNK_DAYS, 14),
    chunkSleepSeconds: Number(process.env.GARMIN_CHUNK_SLEEP_SECONDS ?? 10),
    sleepSeconds: Number(process.env.GARMIN_SLEEP_SECONDS ?? 1.5),
    extraSleepSeconds: Number(process.env.GARMIN_EXTRA_SLEEP_SECONDS ?? 0.5),
    retries: parseInteger(process.env.GARMIN_RETRIES, 2),
    timeoutMs: parseInteger(process.env.GARMIN_SYNC_TIMEOUT_MS, 15 * 60 * 1000)
  }
};

module.exports = config;
