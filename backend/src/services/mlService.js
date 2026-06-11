const fs = require('node:fs');
const { spawn } = require('node:child_process');
const config = require('../config');
const { ApiError } = require('../errors');

const MODEL_VERSION = 'running-v1';
const FEATURE_NAMES = [
  'distanceM',
  'durationS',
  'movingDurationS',
  'elapsedDurationS',
  'avgSpeedMps',
  'maxSpeedMps',
  'avgHeartRateBpm',
  'maxHeartRateBpm',
  'avgCadenceSpm',
  'maxCadenceSpm',
  'elevationGainM',
  'elevationLossM',
  'avgStrideLengthCm',
  'normalizedPowerW'
];

async function getHealth() {
  const modelAvailable = fs.existsSync(config.ml.modelPath);
  const scriptAvailable = fs.existsSync(config.ml.scriptPath);

  return {
    status: modelAvailable && scriptAvailable ? 'ok' : 'unavailable',
    modelAvailable,
    scriptAvailable,
    modelVersion: MODEL_VERSION,
    supportedActivityType: 'running',
    featureNames: FEATURE_NAMES,
    sampleNote: 'trained only from running activities with activity_training_load available'
  };
}

function runPrediction(payload) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(config.ml.modelPath)) {
      reject(new ApiError(503, 'running model is not trained yet', 'MODEL_UNAVAILABLE'));
      return;
    }

    if (!fs.existsSync(config.ml.scriptPath)) {
      reject(new ApiError(503, 'running prediction script is missing', 'MODEL_UNAVAILABLE'));
      return;
    }

    const child = spawn(
      config.ml.pythonPath,
      [config.ml.scriptPath, '--model', config.ml.modelPath],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8'
        },
        windowsHide: true
      }
    );

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new ApiError(503, 'running prediction timed out', 'MODEL_TIMEOUT'));
    }, config.ml.timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(new ApiError(503, `failed to start python prediction: ${error.message}`, 'MODEL_INFERENCE_FAILED'));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new ApiError(503, stderr.trim() || 'running prediction failed', 'MODEL_INFERENCE_FAILED'));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new ApiError(503, 'running prediction returned invalid JSON', 'MODEL_INFERENCE_FAILED'));
      }
    });

    child.stdin.end(JSON.stringify(payload));
  });
}

module.exports = {
  FEATURE_NAMES,
  MODEL_VERSION,
  getHealth,
  runPrediction
};
