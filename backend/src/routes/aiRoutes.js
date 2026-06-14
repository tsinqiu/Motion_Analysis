const express = require('express');
const defaultAiService = require('../services/aiService');
const defaultAuthService = require('../services/authService');
const { authenticate } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../http');
const { sendData } = require('../response');

function createAiRouter({ aiService = defaultAiService, authService = defaultAuthService } = {}) {
  const router = express.Router();
  const requireAuth = authenticate(authService);

  router.get(
    '/ai/health',
    requireAuth,
    asyncHandler(async (req, res) => {
      const status = await aiService.getHealth(req.user);
      sendData(res, status);
    })
  );

  router.post(
    '/ai/chat',
    requireAuth,
    asyncHandler(async (req, res) => {
      const result = await aiService.chat(req.body, req.user);
      sendData(res, result.data, result.meta);
    })
  );

  router.get(
    '/ai/daily-brief',
    requireAuth,
    asyncHandler(async (req, res) => {
      const result = await aiService.getDailyBrief(req.user);
      sendData(res, result.data, result.meta);
    })
  );

  router.post(
    '/ai/activity-analysis',
    requireAuth,
    asyncHandler(async (req, res) => {
      const result = await aiService.analyzeActivity(req.body, req.user);
      sendData(res, result.data, result.meta);
    })
  );

  return router;
}

module.exports = createAiRouter;
