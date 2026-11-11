// withScope: the only way to run a query (P2.1-T05, ADR-013, section 4.3). It opens a transaction,
// sets `app.scope` and `app.tenant_id` for that transaction only, runs the callback, then commits
// (or rolls back if the callback throws). Row-level security reads those settings, so a query
// cannot see another tenant's rows. Code outside src/server/db must not import `pg` (ESLint).
import 'server-only';
import { getPool } from './pool';

const TENANT_ID = /^t_[a-z0-9_]{2,40}$/;

/** What the database needs to know about the caller. RequestContext (P2.1-T06) satisfies this. */
export type DbScope =
  | { scope: 'tenant'; tenantId: string }
  | { scope: 'platform' };

/** A query handle valid only inside one withScope call. */
export interface Db {
  /** Runs a parameterised statement and returns its rows. Never build SQL from user input. */
  rows<T = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<T[]>;
  /** At most one row: null when there is none; throws when more than one comes back. */
  maybeOne<T = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<T | null>;
}

export async function withScope<T>(
  ctx: DbScope,
  fn: (db: Db) => Promise<T>,
): Promise<T> {
  if (ctx.scope !== 'tenant' && ctx.scope !== 'platform') {
    throw new Error('withScope: unknown scope');
  }
  if (ctx.scope === 'tenant' && !TENANT_ID.test(ctx.tenantId)) {
    throw new Error('withScope: invalid tenant id');
  }
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    // set_config(..., true) is SET LOCAL with parameters: the settings end with the transaction.
    await client.query(
      "SELECT set_config('app.scope', $1, true), set_config('app.tenant_id', $2, true)",
      [ctx.scope, ctx.scope === 'tenant' ? ctx.tenantId : ''],
    );
    const db: Db = {
      async rows<R>(text: string, values?: readonly unknown[]) {
        const result = await client.query(text, values as unknown[]);
        return result.rows as R[];
      },
      async maybeOne<R>(text: string, values?: readonly unknown[]) {
        const result = await client.query(text, values as unknown[]);
        if (result.rows.length > 1) {
          throw new Error(
            `maybeOne: expected at most one row, got ${result.rows.length}`,
          );
        }
        return (result.rows[0] as R | undefined) ?? null;
      },
    };
    const value = await fn(db);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // The connection is already broken; it is discarded when released.
    }
    throw error;
  } finally {
    client.release();
  }
}
