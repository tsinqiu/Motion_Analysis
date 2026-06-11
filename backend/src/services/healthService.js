const db = require('../db');

async function checkDatabase() {
  try {
    const ok = await db.ping();
    return {
      ok,
      message: ok ? 'connected' : 'query returned unexpected result'
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message
    };
  }
}

module.exports = {
  checkDatabase
};
