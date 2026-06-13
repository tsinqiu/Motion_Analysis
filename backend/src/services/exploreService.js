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
    userId: row.userId,
    username: row.username || '',
    userBio: row.userBio || '',
    type: row.type,
    title: row.title,
    summary: row.summary,
    coverUrl: row.coverUrl,
    videoUrl: row.videoPath || '',
    videoOriginalName: row.videoOriginalName || '',
    videoMimeType: row.videoMimeType || '',
    videoSizeBytes: row.videoSizeBytes == null ? null : Number(row.videoSizeBytes),
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
        a.id,
        a.user_id AS userId,
        u.username,
        u.bio AS userBio,
        a.type,
        a.title,
        a.summary,
        a.cover_url AS coverUrl,
        a.video_path AS videoPath,
        a.video_original_name AS videoOriginalName,
        a.video_mime_type AS videoMimeType,
        a.video_size_bytes AS videoSizeBytes,
        a.tags_json AS tags,
        a.difficulty,
        a.duration_min AS durationMin,
        a.content,
        a.published_at AS publishedAt
      FROM ExploreArticles a
      LEFT JOIN Users u ON u.id = a.user_id
      WHERE ${where.map((item) => item.replaceAll('status', 'a.status').replaceAll('type', 'a.type').replaceAll('title', 'a.title').replaceAll('summary', 'a.summary').replaceAll('content', 'a.content')).join(' AND ')}
      ORDER BY a.published_at DESC, a.id DESC
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
        a.id,
        a.user_id AS userId,
        u.username,
        u.bio AS userBio,
        a.type,
        a.title,
        a.summary,
        a.cover_url AS coverUrl,
        a.video_path AS videoPath,
        a.video_original_name AS videoOriginalName,
        a.video_mime_type AS videoMimeType,
        a.video_size_bytes AS videoSizeBytes,
        a.tags_json AS tags,
        a.difficulty,
        a.duration_min AS durationMin,
        a.content,
        a.published_at AS publishedAt
      FROM ExploreArticles a
      LEFT JOIN Users u ON u.id = a.user_id
      WHERE a.id = ? AND a.status = 'published'
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

async function createArticle(payload, user) {
  const result = await db.query(
    `
      INSERT INTO ExploreArticles (
        user_id,
        type,
        title,
        summary,
        content,
        status,
        published_at,
        video_path,
        video_original_name,
        video_mime_type,
        video_size_bytes
      )
      VALUES (?, ?, ?, ?, ?, 'published', NOW(3), ?, ?, ?, ?)
    `,
    [
      user.id,
      payload.type,
      payload.title,
      payload.summary || null,
      payload.content || null,
      payload.videoPath || null,
      payload.videoOriginalName || null,
      payload.videoMimeType || null,
      payload.videoSizeBytes || null
    ]
  );

  return getArticleById(result.insertId);
}

module.exports = {
  listArticles,
  getArticleById,
  getRecommendations,
  createArticle
};
