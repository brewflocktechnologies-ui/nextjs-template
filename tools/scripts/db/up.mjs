// Starts the local Postgres and waits until it is healthy (P2.1-T02).
//
//   pnpm db:up
import { compose, fail, HOST_PORT, log, requireDocker } from './lib.mjs';

const SCRIPT = 'db:up';

requireDocker(SCRIPT);
const result = compose([
  'up',
  '--detach',
  '--wait',
  '--wait-timeout',
  '90',
  'db',
]);
if (result.status !== 0) {
  fail(
    SCRIPT,
    `Postgres did not become healthy. Check \`docker compose logs db\`; if port ${HOST_PORT} is taken, free it rather than changing it (D-24).`,
  );
}
log(SCRIPT, `Postgres is healthy on 127.0.0.1:${HOST_PORT}`);
