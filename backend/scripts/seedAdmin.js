const authService = require('../src/services/authService');
const db = require('../src/db');
const config = require('../src/config');

async function main() {
  const admin = await authService.ensureAdminUser(config.auth.admin);
  await db.query(
    `
      UPDATE Activities
      SET owner_user_id = ?, data_source = COALESCE(data_source, 'garmin_import'), is_manual = FALSE
      WHERE owner_user_id IS NULL
    `,
    [admin.id]
  );

  console.log(`Admin user ready: ${admin.email} (id=${admin.id})`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.closePool();
  });
