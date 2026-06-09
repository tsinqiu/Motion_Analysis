const express = require('express');
const cors = require('cors');
const config = require('./config');
const { ApiError } = require('./errors');
const createHealthRouter = require('./routes/healthRoutes');
const createActivityRouter = require('./routes/activityRoutes');
const createStatsRouter = require('./routes/statsRoutes');
const createMlRouter = require('./routes/mlRoutes');

function createApp({ healthService, activityService, mlService } = {}) {
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.cors.origins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new ApiError(403, 'origin is not allowed by CORS'));
      }
    })
  );
  app.use(express.json());

  app.use('/api', createHealthRouter(healthService));
  app.use('/api', createActivityRouter(activityService));
  app.use('/api', createStatsRouter(activityService));
  app.use('/api', createMlRouter(mlService));

  app.use('/api', (req, res) => {
    res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: 'route not found' } });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      error: {
        code: statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : error.code || 'API_ERROR',
        message: statusCode === 500 ? 'internal server error' : error.message
      }
    });
  });

  return app;
}

module.exports = createApp;
