const express = require('express');
const defaultAuthService = require('../services/authService');
const { ApiError } = require('../errors');
const { asyncHandler } = require('../http');
const { authenticate } = require('../middleware/authMiddleware');

function requireText(value, name, { min = 1, max = 255 } = {}) {
  const text = String(value || '').trim();
  if (text.length < min || text.length > max) {
    throw new ApiError(400, `${name} must be ${min} to ${max} characters`, 'INVALID_AUTH_INPUT');
  }
  return text;
}

function requireEmail(value) {
  const email = requireText(value, 'email', { min: 3, max: 255 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, 'email must be valid', 'INVALID_AUTH_INPUT');
  }
  return email;
}

function createAuthRouter(authService = defaultAuthService) {
  const router = express.Router();

  router.post(
    '/auth/register',
    asyncHandler(async (req, res) => {
      const payload = {
        username: requireText(req.body.username, 'username', { min: 2, max: 80 }),
        email: requireEmail(req.body.email),
        password: requireText(req.body.password, 'password', { min: 8, max: 200 })
      };

      const result = await authService.register(payload);
      res.status(201).json(result);
    })
  );

  router.post(
    '/auth/login',
    asyncHandler(async (req, res) => {
      const result = await authService.login({
        email: requireEmail(req.body.email),
        password: requireText(req.body.password, 'password', { min: 1, max: 200 })
      });
      res.json(result);
    })
  );

  router.get(
    '/auth/me',
    authenticate(authService),
    asyncHandler(async (req, res) => {
      res.json({ user: req.user });
    })
  );

  return router;
}

module.exports = createAuthRouter;
