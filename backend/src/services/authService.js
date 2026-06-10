const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');
const { ApiError } = require('../errors');

const PUBLIC_USER_COLUMNS = 'id, username, email, role, status, created_at AS createdAt';

function publicUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt
  };
}

function signToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role,
      email: user.email
    },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn }
  );
}

async function findByEmail(email) {
  const rows = await db.query(
    `SELECT ${PUBLIC_USER_COLUMNS}, password_hash AS passwordHash FROM Users WHERE email = ? LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

async function findByUsername(username) {
  const rows = await db.query(
    `SELECT ${PUBLIC_USER_COLUMNS} FROM Users WHERE username = ? LIMIT 1`,
    [username]
  );
  return rows[0] || null;
}

async function findById(userId) {
  const rows = await db.query(`SELECT ${PUBLIC_USER_COLUMNS} FROM Users WHERE id = ? LIMIT 1`, [userId]);
  return publicUser(rows[0]);
}

async function register({ username, email, password }) {
  const existing = await findByEmail(email);
  if (existing) {
    throw new ApiError(409, 'email is already registered', 'EMAIL_ALREADY_REGISTERED');
  }

  const existingUsername = await findByUsername(username);
  if (existingUsername) {
    throw new ApiError(409, 'username is already registered', 'USERNAME_ALREADY_REGISTERED');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await db.query(
    `
      INSERT INTO Users (username, email, password_hash, role, status)
      VALUES (?, ?, ?, 'user', 'active')
    `,
    [username, email, passwordHash]
  );

  const user = await findById(result.insertId);
  return {
    user,
    token: signToken(user)
  };
}

async function login({ email, password }) {
  const row = await findByEmail(email);
  if (!row) {
    throw new ApiError(401, 'invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (row.status !== 'active') {
    throw new ApiError(403, 'user is not active', 'USER_INACTIVE');
  }

  const ok = await bcrypt.compare(password, row.passwordHash);
  if (!ok) {
    throw new ApiError(401, 'invalid email or password', 'INVALID_CREDENTIALS');
  }

  const user = publicUser(row);
  return {
    user,
    token: signToken(user)
  };
}

async function verifyToken(token) {
  try {
    const payload = jwt.verify(token, config.auth.jwtSecret);
    const user = await findById(Number(payload.sub));
    if (!user || user.status !== 'active') {
      throw new ApiError(401, 'invalid token', 'INVALID_TOKEN');
    }
    return user;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(401, 'invalid token', 'INVALID_TOKEN');
  }
}

async function ensureAdminUser({ username, email, password } = config.auth.admin) {
  const existing = await findByEmail(email);
  if (existing) {
    if (existing.role !== 'admin') {
      await db.query("UPDATE Users SET role = 'admin', status = 'active' WHERE id = ?", [existing.id]);
    }
    return findByEmail(email);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await db.query(
    `
      INSERT INTO Users (username, email, password_hash, role, status)
      VALUES (?, ?, ?, 'admin', 'active')
    `,
    [username, email, passwordHash]
  );

  return findById(result.insertId);
}

module.exports = {
  register,
  login,
  verifyToken,
  findById,
  ensureAdminUser
};
