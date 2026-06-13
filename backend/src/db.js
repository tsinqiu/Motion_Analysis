const mysql = require('mysql2/promise');
const config = require('./config');

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool(config.db);
  }

  return pool;
}

async function query(sql, params = []) {
  const [rows] = await getPool().query(sql, params);
  return rows;
}

async function transaction(handler) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await handler(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function ping() {
  const rows = await query('SELECT 1 AS ok');
  return rows[0]?.ok === 1;
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

module.exports = {
  getPool,
  query,
  transaction,
  ping,
  closePool
};
