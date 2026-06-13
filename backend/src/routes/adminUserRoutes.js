const express = require('express');
const defaultAuthService = require('../services/authService');
const { ApiError } = require('../errors');
const { asyncHandler, parsePositiveId } = require('../http');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');
const { sendCreated, sendData } = require('../response');

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

function normalizeRole(value) {
  return value === 'admin' ? 'admin' : 'user';
}

function createAdminUserRouter(authService = defaultAuthService) {
  const router = express.Router();
  const requireAuth = authenticate(authService);

  router.get(
    '/admin/users',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      sendData(res, await authService.listUsers());
    })
  );

  router.post(
    '/admin/users',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const user = await authService.createUser({
        username: requireText(req.body.username, 'username', { min: 2, max: 80 }),
        email: requireEmail(req.body.email),
        password: requireText(req.body.password, 'password', { min: 8, max: 200 }),
        role: normalizeRole(req.body.role),
        status: 'active'
      });

      sendCreated(res, user);
    })
  );

  router.delete(
    '/admin/users/:id',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      sendData(res, await authService.disableUser(parsePositiveId(req.params.id), req.user));
    })
  );

  return router;
}

module.exports = createAdminUserRouter;
