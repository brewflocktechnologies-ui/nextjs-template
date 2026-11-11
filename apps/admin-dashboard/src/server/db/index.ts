// The database layer's public surface (P2.1-T05). The rest of the app goes through withScope;
// `pg` is imported only inside this folder.
export { closePool, getPool } from './pool';
export * from './rows';
export { withScope } from './scope';
export type { Db, DbScope } from './scope';
