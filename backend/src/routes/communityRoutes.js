const express = require('express');
const defaultCommunityService = require('../services/communityService');
const defaultAuthService = require('../services/authService');
const { ApiError } = require('../errors');
const { asyncHandler, parseEnum, parseKeyword, parsePage, parsePageSize, parsePositiveId } = require('../http');
const { authenticate, optionalAuthenticate } = require('../middleware/authMiddleware');
const { sendCreated, sendData } = require('../response');

const VISIBILITY = ['private', 'followers', 'public'];
const SHARE_CHANNELS = ['copy_link', 'wechat', 'qq', 'weibo', 'system'];

function parsePaging(query, fallback = 20, max = 100) {
  const page = parsePage(query.page);
  const pageSize = parsePageSize(query.page_size, fallback, max);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function requireText(value, name, max) {
  const text = String(value || '').trim();
  if (!text || text.length > max) {
    throw new ApiError(400, `${name} is required and must be at most ${max} characters`, 'VALIDATION_ERROR');
  }
  return text;
}

function parseOptionalPositiveId(value, name) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return parsePositiveId(String(value), name);
}

function createCommunityRouter({ communityService = defaultCommunityService, authService = defaultAuthService } = {}) {
  const router = express.Router();
  const requireAuth = authenticate(authService);
  const maybeAuth = optionalAuthenticate(authService);

  router.get(
    '/community/posts',
    maybeAuth,
    asyncHandler(async (req, res) => {
      sendData(
        res,
        await communityService.listPosts(
          {
            ...parsePaging(req.query),
            keyword: parseKeyword(req.query.keyword)
          },
          req.user
        )
      );
    })
  );

  router.post(
    '/community/posts',
    requireAuth,
    asyncHandler(async (req, res) => {
      sendCreated(
        res,
        await communityService.createPost(
          {
            content: requireText(req.body.content, 'content', 2000),
            activityId: parseOptionalPositiveId(req.body.activityId || req.body.activity_id, 'activityId'),
            visibility: parseEnum(req.body.visibility, VISIBILITY, 'visibility', 'public')
          },
          req.user
        )
      );
    })
  );

  router.get(
    '/community/posts/:id/comments',
    maybeAuth,
    asyncHandler(async (req, res) => {
      sendData(
        res,
        await communityService.listComments(parsePositiveId(req.params.id, 'post id'), parsePaging(req.query), req.user)
      );
    })
  );

  router.post(
    '/community/posts/:id/comments',
    requireAuth,
    asyncHandler(async (req, res) => {
      sendCreated(
        res,
        await communityService.createComment(
          parsePositiveId(req.params.id, 'post id'),
          { content: requireText(req.body.content, 'content', 1000) },
          req.user
        )
      );
    })
  );

  router.post(
    '/community/posts/:id/like',
    requireAuth,
    asyncHandler(async (req, res) => {
      sendData(res, await communityService.likePost(parsePositiveId(req.params.id, 'post id'), req.user));
    })
  );

  router.delete(
    '/community/posts/:id/like',
    requireAuth,
    asyncHandler(async (req, res) => {
      sendData(res, await communityService.unlikePost(parsePositiveId(req.params.id, 'post id'), req.user));
    })
  );

  router.post(
    '/community/posts/:id/share',
    requireAuth,
    asyncHandler(async (req, res) => {
      sendCreated(
        res,
        await communityService.sharePost(
          parsePositiveId(req.params.id, 'post id'),
          { channel: parseEnum(req.body.channel, SHARE_CHANNELS, 'channel', 'copy_link') },
          req.user
        )
      );
    })
  );

  return router;
}

module.exports = createCommunityRouter;
