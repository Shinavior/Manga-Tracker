import postgres from 'postgres';

/**
 * Migration Script: Single-User to Real Supabase User
 * 
 * Reassigns all foreign keys (series, chapters via series, settings, api_tokens, undo_tokens)
 * from the placeholder SINGLE_USER_ID ('00000000-0000-0000-0000-000000000001')
 * to your authenticated Supabase user ID or target email.
 * 
 * Usage:
 *   npx tsx scripts/migrate-single-user.ts <TARGET_USER_UUID_OR_EMAIL>
 */

const targetUser = process.argv[2];
const dbUrl = process.env.DATABASE_URL;

if (!targetUser) {
  console.error('❌ Error: Missing target user ID or email.');
  console.log('Usage: npx tsx scripts/migrate-single-user.ts <TARGET_USER_UUID_OR_EMAIL>');
  process.exit(1);
}

if (!dbUrl) {
  console.error('❌ Error: DATABASE_URL environment variable is required.');
  process.exit(1);
}

const sql = postgres(dbUrl);
const PLACEHOLDER_ID = '00000000-0000-0000-0000-000000000001';

async function migrate() {
  console.log(`🔍 Resolving target user: ${targetUser}...`);

  // Find target user row
  let userRow;
  if (targetUser.includes('@')) {
    const rows = await sql`SELECT id, email FROM users WHERE email = ${targetUser.toLowerCase()} LIMIT 1`;
    userRow = rows[0];
  } else {
    const rows = await sql`SELECT id, email FROM users WHERE id = ${targetUser}::uuid LIMIT 1`;
    userRow = rows[0];
  }

  if (!userRow) {
    console.error(`❌ User not found for ${targetUser}. Ensure the user has registered in the app first.`);
    await sql.end();
    process.exit(1);
  }

  const newUserId = userRow.id;
  console.log(`✅ Target user resolved: ID ${newUserId} (${userRow.email})`);

  console.log(`🔄 Migrating series, settings, and tokens from placeholder ${PLACEHOLDER_ID}...`);

  await sql.begin(async (tx) => {
    // 1. Update Series
    const updatedSeries = await tx`
      UPDATE series 
      SET user_id = ${newUserId}::uuid 
      WHERE user_id = ${PLACEHOLDER_ID}::uuid
      RETURNING id
    `;
    console.log(`   📦 Migrated ${updatedSeries.length} series rows.`);

    // 2. Update Settings
    await tx`
      DELETE FROM settings WHERE user_id = ${newUserId}::uuid
    `;
    const updatedSettings = await tx`
      UPDATE settings 
      SET user_id = ${newUserId}::uuid 
      WHERE user_id = ${PLACEHOLDER_ID}::uuid
      RETURNING user_id
    `;
    console.log(`   ⚙️ Migrated settings row (${updatedSettings.length} updated).`);

    // 3. Update API Tokens
    const updatedTokens = await tx`
      UPDATE api_tokens 
      SET user_id = ${newUserId}::uuid 
      WHERE user_id = ${PLACEHOLDER_ID}::uuid
      RETURNING id
    `;
    console.log(`   🔑 Migrated ${updatedTokens.length} API tokens.`);

    // 4. Update Undo Tokens
    const updatedUndo = await tx`
      UPDATE undo_tokens 
      SET user_id = ${newUserId}::uuid 
      WHERE user_id = ${PLACEHOLDER_ID}::uuid
      RETURNING token
    `;
    console.log(`   ⏪ Migrated ${updatedUndo.length} undo tokens.`);

    // 5. Remove placeholder user row if it exists
    await tx`DELETE FROM users WHERE id = ${PLACEHOLDER_ID}::uuid`;
  });

  console.log('🎉 Migration completed successfully! Your previous library is now linked to your authenticated account.');
  await sql.end();
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  sql.end();
  process.exit(1);
});
