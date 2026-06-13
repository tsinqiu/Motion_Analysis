const fs = require('node:fs');
const mysql = require('mysql2/promise');
const config = require('../src/config');

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    throw new Error('Usage: node scripts/applyMigration.js <sql-file>');
  }

  const sql = fs.readFileSync(filePath, 'utf8');
  const connection = await mysql.createConnection({
    ...config.db,
    multipleStatements: true
  });

  try {
    await connection.query(sql);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
