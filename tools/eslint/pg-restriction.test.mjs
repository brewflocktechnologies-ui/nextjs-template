// Negative test for the `pg` import restriction (P2.1-T05, ADR-012). Run: node --test tools/eslint/
// `pg` may be imported inside apps/admin-dashboard/src/server/db and nowhere else in the dashboard,
// and the tag restrictions (for example @radix-ui/*) must still apply inside the db folder.
import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { ESLint } from 'eslint';

const dashboard = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  'apps',
  'admin-dashboard',
);
const eslint = new ESLint({ cwd: dashboard });

async function restrictedImports(code, relativePath) {
  const [result] = await eslint.lintText(code, {
    filePath: path.join(dashboard, relativePath),
  });
  return result.messages.filter((m) => m.ruleId === 'no-restricted-imports');
}

describe('pg import restriction', () => {
  it('rejects pg in a page', async () => {
    const found = await restrictedImports(
      "import { Pool } from 'pg';\nexport const p = Pool;\n",
      'src/app/example.ts',
    );
    assert.equal(found.length, 1);
    assert.match(found[0].message, /src\/server\/db/);
  });

  it('rejects pg in the data layer and in other server code', async () => {
    for (const file of ['src/data/themes.ts', 'src/server/api.ts']) {
      const found = await restrictedImports(
        "import pg from 'pg';\nexport default pg;\n",
        file,
      );
      assert.equal(found.length, 1, file);
    }
  });

  it('allows pg inside src/server/db', async () => {
    const found = await restrictedImports(
      "import { Pool } from 'pg';\nexport const p = Pool;\n",
      'src/server/db/pool.ts',
    );
    assert.equal(found.length, 0);
  });

  it('keeps the tag restrictions inside src/server/db', async () => {
    const found = await restrictedImports(
      "import { Dialog } from '@radix-ui/react-dialog';\nexport const d = Dialog;\n",
      'src/server/db/pool.ts',
    );
    assert.equal(found.length, 1);
  });
});
