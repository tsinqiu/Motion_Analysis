const db = require('../db');
const { ApiError } = require('../errors');

function toPost(row) {
  return {
    id: row.id,
    userId: row.userId,
    username: row.username,
    userBio: row.userBio || '',
    content: row.content,
    activityId: row.activityId,
    visibility: row.visibility,
    likeCount: Number(row.likeCount || 0),
    commentCount: Number(row.commentCount || 0),
    shareCount: Number(row.shareCount || 0),
    likedByMe: Boolean(row.likedByMe),
    followedByMe: Boolean(row.followedByMe),
    createdAt: row.createdAt
  };
}

function toComment(row) {
  return {
    id: row.id,
    postId: row.postId,
    userId: row.userId,
    username: row.username,
    content: row.content,
    createdAt: row.createdAt
  };
}

function postSelect(user) {
  return `
    SELECT
      p.id,
      p.user_id AS userId,
      u.username,
      u.bio AS userBio,
      p.content,
      p.activity_id AS activityId,
      p.visibility,
      p.created_at AS createdAt,
      (SELECT COUNT(*) FROM CommunityLikes l WHERE l.post_id = p.id) AS likeCount,
      (SELECT COUNT(*) FROM CommunityComments c WHERE c.post_id = p.id) AS commentCount,
      (SELECT COUNT(*) FROM CommunityShares s WHERE s.post_id = p.id) AS shareCount,
      ${
        user
          ? 'EXISTS(SELECT 1 FROM CommunityLikes ml WHERE ml.post_id = p.id AND ml.user_id = ?) AS likedByMe'
          : 'FALSE AS likedByMe'
      },
      ${
        user
          ? 'EXISTS(SELECT 1 FROM UserFollows uf WHERE uf.follower_user_id = ? AND uf.following_user_id = p.user_id) AS followedByMe'
          : 'FALSE AS followedByMe'
      }
    FROM CommunityPosts p
    JOIN Users u ON u.id = p.user_id
  `;
}

function visibilityWhere(user) {
  if (!user) {
    return { sql: "p.visibility = 'public'", params: [] };
  }
  return {
    sql: `
      (
        p.visibility = 'public'
        OR p.user_id = ?
        OR (
          p.visibility = 'followers'
          AND EXISTS (
            SELECT 1
            FROM UserFollows vf
            WHERE vf.follower_user_id = ?
              AND vf.following_user_id = p.user_id
          )
        )
      )
    `,
    params: [user.id, user.id]
  };
}

function postSelectParams(user) {
  return user ? [user.id, user.id] : [];
}

async function ensureActivityUsable(activityId, user) {
  if (!activityId) {
    return;
  }

  const rows = await db.query('SELECT id, owner_user_id AS ownerUserId FROM Activities WHERE id = ? LIMIT 1', [activityId]);
  const activity = rows[0];
  if (!activity) {
    throw new ApiError(404, 'activity not found', 'NOT_FOUND');
  }
  if (user.role !== 'admin' && activity.ownerUserId && activity.ownerUserId !== user.id) {
    throw new ApiError(403, 'you cannot share this activity', 'FORBIDDEN');
  }
}

async function getPostById(postId, user) {
  const visibility = visibilityWhere(user);
  const rows = await db.query(
    `
      ${postSelect(user)}
      WHERE p.id = ? AND ${visibility.sql}
      LIMIT 1
    `,
    [...postSelectParams(user), postId, ...visibility.params]
  );
  const post = rows[0];
  if (!post) {
    throw new ApiError(404, 'post not found', 'NOT_FOUND');
  }
  return toPost(post);
}

async function listPosts(filters, user) {
  const visibility = visibilityWhere(user);
  const where = [visibility.sql];
  const params = [...visibility.params];
  if (filters.keyword) {
    where.push('p.content LIKE ?');
    params.push(`%${filters.keyword}%`);
  }

  const countRows = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM CommunityPosts p
      WHERE ${where.join(' AND ')}
    `,
    params
  );

  const rows = await db.query(
    `
      ${postSelect(user)}
      WHERE ${where.join(' AND ')}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ? OFFSET ?
    `,
    [...postSelectParams(user), ...params, filters.pageSize, filters.offset]
  );

  const total = Number(countRows[0]?.total || 0);
  return {
    items: rows.map(toPost),
    page: filters.page,
    pageSize: filters.pageSize,
    total,
    totalPages: Math.ceil(total / filters.pageSize)
  };
}

async function createPost(payload, user) {
  await ensureActivityUsable(payload.activityId, user);
  const result = await db.query(
    `
      INSERT INTO CommunityPosts (user_id, activity_id, content, visibility)
      VALUES (?, ?, ?, ?)
    `,
    [user.id, payload.activityId || null, payload.content, payload.visibility]
  );

  return getPostById(result.insertId, user);
}

async function listComments(postId, filters, user) {
  await getPostById(postId, user);
  const countRows = await db.query('SELECT COUNT(*) AS total FROM CommunityComments WHERE post_id = ?', [postId]);
  const rows = await db.query(
    `
      SELECT
        c.id,
        c.post_id AS postId,
        c.user_id AS userId,
        u.username,
        c.content,
        c.created_at AS createdAt
      FROM CommunityComments c
      JOIN Users u ON u.id = c.user_id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC, c.id ASC
      LIMIT ? OFFSET ?
    `,
    [postId, filters.pageSize, filters.offset]
  );

  const total = Number(countRows[0]?.total || 0);
  return {
    items: rows.map(toComment),
    page: filters.page,
    pageSize: filters.pageSize,
    total,
    totalPages: Math.ceil(total / filters.pageSize)
  };
}

async function createComment(postId, payload, user) {
  await getPostById(postId, user);
  const result = await db.query(
    'INSERT INTO CommunityComments (post_id, user_id, content) VALUES (?, ?, ?)',
    [postId, user.id, payload.content]
  );

  const rows = await db.query(
    `
      SELECT
        c.id,
        c.post_id AS postId,
        c.user_id AS userId,
        u.username,
        c.content,
        c.created_at AS createdAt
      FROM CommunityComments c
      JOIN Users u ON u.id = c.user_id
      WHERE c.id = ?
      LIMIT 1
    `,
    [result.insertId]
  );
  return toComment(rows[0]);
}

async function likePost(postId, user) {
  await getPostById(postId, user);
  await db.query('INSERT IGNORE INTO CommunityLikes (post_id, user_id) VALUES (?, ?)', [postId, user.id]);
  return getPostById(postId, user);
}

async function unlikePost(postId, user) {
  await getPostById(postId, user);
  await db.query('DELETE FROM CommunityLikes WHERE post_id = ? AND user_id = ?', [postId, user.id]);
  return getPostById(postId, user);
}

async function sharePost(postId, payload, user) {
  await getPostById(postId, user);
  const result = await db.query(
    'INSERT INTO CommunityShares (post_id, user_id, channel) VALUES (?, ?, ?)',
    [postId, user.id, payload.channel]
  );

  return {
    id: result.insertId,
    postId,
    channel: payload.channel,
    shared: true
  };
}

async function ensureFollowTarget(targetUserId, user) {
  if (Number(targetUserId) === Number(user.id)) {
    throw new ApiError(400, 'cannot follow yourself', 'VALIDATION_ERROR');
  }
  const rows = await db.query("SELECT id FROM Users WHERE id = ? AND status = 'active' LIMIT 1", [targetUserId]);
  if (!rows[0]) {
    throw new ApiError(404, 'user not found', 'NOT_FOUND');
  }
}

async function followUser(targetUserId, user) {
  await ensureFollowTarget(targetUserId, user);
  await db.query(
    'INSERT IGNORE INTO UserFollows (follower_user_id, following_user_id) VALUES (?, ?)',
    [user.id, targetUserId]
  );
  return { userId: targetUserId, following: true };
}

async function unfollowUser(targetUserId, user) {
  await ensureFollowTarget(targetUserId, user);
  await db.query(
    'DELETE FROM UserFollows WHERE follower_user_id = ? AND following_user_id = ?',
    [user.id, targetUserId]
  );
  return { userId: targetUserId, following: false };
}

module.exports = {
  listPosts,
  createPost,
  listComments,
  createComment,
  likePost,
  unlikePost,
  sharePost,
  followUser,
  unfollowUser
};
