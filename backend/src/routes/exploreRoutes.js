const express = require('express');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');
const defaultExploreService = require('../services/exploreService');
const defaultAuthService = require('../services/authService');
const config = require('../config');
const { ApiError } = require('../errors');
const { asyncHandler, parseEnum, parseKeyword, parsePage, parsePageSize, parsePositiveId } = require('../http');
const { authenticate, optionalAuthenticate } = require('../middleware/authMiddleware');
const { sendCreated, sendData } = require('../response');

const ARTICLE_TYPES = ['course', 'article', 'training_advice'];

fs.mkdirSync(config.uploads.exploreVideosDir, { recursive: true });

const videoStorage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, config.uploads.exploreVideosDir);
  },
  filename(req, file, callback) {
    const extension = path.extname(file.originalname || '').slice(0, 16) || '.mp4';
    callback(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`);
  }
});

const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: config.uploads.maxVideoBytes },
  fileFilter(req, file, callback) {
    if (!String(file.mimetype || '').startsWith('video/')) {
      callback(new ApiError(400, 'video file is required', 'INVALID_UPLOAD'));
      return;
    }
    callback(null, true);
  }
});

function parsePaging(query, fallback = 20, max = 100) {
  const page = parsePage(query.page);
  const pageSize = parsePageSize(query.page_size, fallback, max);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function parseArticleFilters(query) {
  return {
    ...parsePaging(query),
    type: parseEnum(query.type, ARTICLE_TYPES, 'type', undefined),
    keyword: parseKeyword(query.keyword)
  };
}

function requireText(value, name, max) {
  const text = String(value || '').trim();
  if (!text || text.length > max) {
    throw new ApiError(400, `${name} is required and must be at most ${max} characters`, 'VALIDATION_ERROR');
  }
  return text;
}

function optionalText(value, max) {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : '';
}

function createExploreRouter(exploreService = defaultExploreService, authService = defaultAuthService) {
  const router = express.Router();
  const maybeAuth = optionalAuthenticate(authService);
  const requireAuth = authenticate(authService);

  router.get(
    '/explore/articles',
    asyncHandler(async (req, res) => {
      sendData(res, await exploreService.listArticles(parseArticleFilters(req.query)));
    })
  );

  router.get(
    '/explore/recommendations',
    maybeAuth,
    asyncHandler(async (req, res) => {
      sendData(res, await exploreService.getRecommendations(parseArticleFilters(req.query), req.user));
    })
  );

  router.post(
    '/explore/articles',
    requireAuth,
    uploadVideo.single('video'),
    asyncHandler(async (req, res) => {
      const file = req.file;
      const videoPath = file
        ? `/uploads/explore-videos/${file.filename}`
        : '';

      sendCreated(
        res,
        await exploreService.createArticle(
          {
            type: parseEnum(req.body.type, ARTICLE_TYPES, 'type', 'article'),
            title: requireText(req.body.title, 'title', 200),
            summary: optionalText(req.body.summary, 500),
            content: optionalText(req.body.content, 10000),
            videoPath,
            videoOriginalName: file?.originalname || '',
            videoMimeType: file?.mimetype || '',
            videoSizeBytes: file?.size || null
          },
          req.user
        )
      );
    })
  );

  router.get(
    '/explore/articles/:id',
    asyncHandler(async (req, res) => {
      sendData(res, await exploreService.getArticleById(parsePositiveId(req.params.id, 'article id')));
    })
  );

  return router;
}

module.exports = createExploreRouter;
