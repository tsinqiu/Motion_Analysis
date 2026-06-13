const defaultAuthService = require('../services/authService');
const { ApiError } = require('../errors');

function authenticate(authService = defaultAuthService) {
  return async (req, res, next) => {
    try {
      const header = req.get('Authorization') || '';
      const match = header.match(/^Bearer\s+(.+)$/i);
      if (!match) {
        throw new ApiError(401, 'authorization token is required', 'AUTH_REQUIRED');
      }

      req.user = await authService.verifyToken(match[1]);
      next();
    } catch (error) {
      next(error);
    }
  };
}

function optionalAuthenticate(authService = defaultAuthService) {
  return async (req, res, next) => {
    try {
      const header = req.get('Authorization') || '';
      const match = header.match(/^Bearer\s+(.+)$/i);
      if (match) {
        req.user = await authService.verifyToken(match[1]);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    next(new ApiError(403, 'admin role is required', 'FORBIDDEN'));
    return;
  }
  next();
}

module.exports = {
  authenticate,
  optionalAuthenticate,
  requireAdmin
};
