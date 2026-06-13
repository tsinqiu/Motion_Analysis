const express = require('express');
const defaultExploreService = require('../services/exploreService');
const defaultAuthService = require('../services/authService');
const { asyncHandler, parseEnum, parseKeyword, parsePage, parsePageSize, parsePositiveId } = require('../http');
const { optionalAuthenticate } = require('../middleware/authMiddleware');
const { sendData } = require('../response');

const ARTICLE_TYPES = ['course', 'article', 'training_advice'];

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

function createExploreRouter(exploreService = defaultExploreService, authService = defaultAuthService) {
  const router = express.Router();
  const maybeAuth = optionalAuthenticate(authService);

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

  router.get(
    '/explore/articles/:id',
    asyncHandler(async (req, res) => {
      sendData(res, await exploreService.getArticleById(parsePositiveId(req.params.id, 'article id')));
    })
  );

  return router;
}

module.exports = createExploreRouter;
