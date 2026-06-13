const db = require('../db');
const { ApiError } = require('../errors');

function parseTags(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toArticle(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    summary: row.summary,
    coverUrl: row.coverUrl,
    tags: parseTags(row.tags),
    difficulty: row.difficulty,
    durationMin: row.durationMin,
    content: row.content,
    publishedAt: row.publishedAt
  };
}

async function listArticles(filters) {
  const where = ["status = 'published'"];
  const params = [];
  if (filters.type) {
    where.push('type = ?');
    params.push(filters.type);
  }
  if (filters.keyword) {
    where.push('(title LIKE ? OR summary LIKE ? OR content LIKE ?)');
    params.push(`%${filters.keyword}%`, `%${filters.keyword}%`, `%${filters.keyword}%`);
  }

  const countRows = await db.query(`SELECT COUNT(*) AS total FROM ExploreArticles WHERE ${where.join(' AND ')}`, params);
  const rows = await db.query(
    `
      SELECT
        id,
        type,
        title,
        summary,
        cover_url AS coverUrl,
        tags_json AS tags,
        difficulty,
        duration_min AS durationMin,
        content,
        published_at AS publishedAt
      FROM ExploreArticles
      WHERE ${where.join(' AND ')}
      ORDER BY published_at DESC, id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, filters.pageSize, filters.offset]
  );

  const total = Number(countRows[0]?.total || 0);
  return {
    items: rows.map(toArticle),
    page: filters.page,
    pageSize: filters.pageSize,
    total,
    totalPages: Math.ceil(total / filters.pageSize)
  };
}

async function getArticleById(articleId) {
  const rows = await db.query(
    `
      SELECT
        id,
        type,
        title,
        summary,
        cover_url AS coverUrl,
        tags_json AS tags,
        difficulty,
        duration_min AS durationMin,
        content,
        published_at AS publishedAt
      FROM ExploreArticles
      WHERE id = ? AND status = 'published'
      LIMIT 1
    `,
    [articleId]
  );

  if (!rows[0]) {
    throw new ApiError(404, 'article not found', 'NOT_FOUND');
  }

  return toArticle(rows[0]);
}

async function getRecommendations(filters, user) {
  return listArticles({
    ...filters,
    userId: user?.id
  });
}

module.exports = {
  listArticles,
  getArticleById,
  getRecommendations
};
