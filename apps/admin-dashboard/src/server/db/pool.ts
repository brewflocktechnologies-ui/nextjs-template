// The one Postgres pool (P2.1-T05, ADR-012). Server only, one pool per process. The dashboard
// connects as `byteflock_app` (not the owner, no BYPASSRLS), so row-level security always applies.
import 'server-only';
import { Pool } from 'pg';

const KEY = Symbol.for('byteflock.db.pool');
type Holder = { [KEY]?: Pool };

/** The process-wide pool. Created on first use; kept on globalThis so dev hot reload reuses it. */
export function getPool(): Pool {
  const holder = globalThis as Holder;
  const existing = holder[KEY];
  if (existing) return existing;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. For local development run `pnpm db:up`; the default is in apps/admin-dashboard/.env.development.',
    );
  }
  const pool = new Pool({ connectionString, max: 10 });
  // An idle client dropping (for example Postgres restarting) must not crash the process.
  pool.on('error', (error) => {
    console.error('db pool: idle client error:', error.message);
  });
  holder[KEY] = pool;
  return pool;
}

/** Closes the pool (tests and scripts). The next getPool() makes a new one. */
export async function closePool(): Promise<void> {
  const holder = globalThis as Holder;
  const pool = holder[KEY];
  if (!pool) return;
  holder[KEY] = undefined;
  await pool.end();
}
