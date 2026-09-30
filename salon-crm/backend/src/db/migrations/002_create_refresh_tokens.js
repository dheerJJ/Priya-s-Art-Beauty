'use strict';

/**
 * Migration 002: Create refresh_tokens table (Reversible)
 */
async function up(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id                SERIAL PRIMARY KEY,
      user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash        VARCHAR(64) NOT NULL UNIQUE,
      family_id         UUID NOT NULL,
      family_expires_at TIMESTAMPTZ NOT NULL,
      expires_at        TIMESTAMPTZ NOT NULL,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at        TIMESTAMPTZ,
      replaced_by       VARCHAR(64),
      user_agent        TEXT,
      ip                VARCHAR(45)
    );
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family_id ON refresh_tokens(family_id);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);`);
}

async function down(client) {
  await client.query(`DROP TABLE IF EXISTS refresh_tokens CASCADE;`);
}

module.exports = { up, down };
