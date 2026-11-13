// Stops the local Postgres and keeps its data (P2.1-T02). `pnpm db:reset` is the way to wipe it.
//
//   pnpm db:down
import { compose, fail, log, requireDocker } from './lib.mjs';

const SCRIPT = 'db:down';

requireDocker(SCRIPT);
if (compose(['stop', 'db']).status !== 0)
  fail(SCRIPT, 'could not stop the db service.');
log(SCRIPT, 'Postgres stopped; data kept in the byteflock-pg volume');
