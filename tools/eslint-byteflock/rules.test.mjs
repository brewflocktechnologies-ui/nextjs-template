// Unit tests for the byteflock ESLint rules (P1.6-AC08). Run: node --test tools/eslint-byteflock/
import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import plugin from './index.mjs';

RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
});
const rule = (name) => plugin.rules[name];

tester.run(
  'no-request-apis-in-cached-scope',
  rule('no-request-apis-in-cached-scope'),
  {
    valid: [
      {
        code: "import { cookies } from 'next/headers'; export async function f() { return cookies(); }",
      },
      { code: "'use cache';\nexport async function f() { return 1; }" },
    ],
    invalid: [
      {
        code: "'use cache';\nimport { cookies } from 'next/headers';\nexport async function f() { return cookies(); }",
        errors: [{ messageId: 'import' }, { messageId: 'call' }],
      },
      {
        code: "export async function f() { 'use cache'; return headers(); }",
        errors: [{ messageId: 'call' }],
      },
    ],
  },
);

tester.run('qk-only', rule('qk-only'), {
  valid: [
    {
      code: "useQuery({ queryKey: qk(t, 'theme'), queryFn })",
      filename: 'src/app/x.tsx',
    },
    {
      code: "export const k = { queryKey: ['allowed'] }",
      filename: 'src/lib/query/qk.ts',
    },
  ],
  invalid: [
    {
      code: "useQuery({ queryKey: ['theme', t], queryFn })",
      filename: 'src/app/x.tsx',
      errors: [{ messageId: 'raw' }],
    },
  ],
});

tester.run('proxy-allowlist', rule('proxy-allowlist'), {
  valid: [
    {
      code: "import { NextResponse } from 'next/server'; import { SESSION_COOKIE } from './server/proxy-allowlist';",
      filename: 'src/proxy.ts',
    },
    {
      code: "import { getDraft } from './data/themes';",
      filename: 'src/other.ts',
    },
  ],
  invalid: [
    {
      code: "import { getDraft } from './data/themes';",
      filename: 'src/proxy.ts',
      errors: [{ messageId: 'forbidden' }],
    },
    {
      code: "const m = await import('./server/request-context');",
      filename: 'src/proxy.ts',
      errors: [{ messageId: 'forbidden' }],
    },
  ],
});

tester.run('data-access-tenant-first', rule('data-access-tenant-first'), {
  valid: [
    {
      code: 'export async function getDraft(tenantId: string) {}',
      filename: 'src/data/themes.ts',
    },
    {
      code: 'export const save = (tenantId: string, x: number) => x;',
      filename: 'src/data/a.ts',
    },
    { code: 'export function helper(x: number) {}', filename: 'src/lib/a.ts' },
    {
      code: 'export class ThemeError extends Error {}',
      filename: 'src/data/themes.ts',
    },
    {
      code: 'export async function listTenants(ctx: PlatformContext) {}',
      filename: 'src/data/platform/tenants.ts',
    },
  ],
  invalid: [
    {
      code: 'export async function listTenants(tenantId: string) {}',
      filename: 'src/data/platform/tenants.ts',
      errors: [{ messageId: 'first' }],
    },
    {
      code: 'export async function listTenants(ctx: TenantContext) {}',
      filename: 'src/data/platform/tenants.ts',
      errors: [{ messageId: 'first' }],
    },
    {
      code: 'export async function listTenants(ctx) {}',
      filename: 'src/data/platform/tenants.ts',
      errors: [{ messageId: 'first' }],
    },
    {
      code: 'export async function getDraft(ctx: PlatformContext) {}',
      filename: 'src/data/themes.ts',
      errors: [{ messageId: 'first' }],
    },
    {
      code: 'export async function getDraft(id: string) {}',
      filename: 'src/data/themes.ts',
      errors: [{ messageId: 'first' }],
    },
    {
      code: 'export const list = () => [];',
      filename: 'src/data/a.ts',
      errors: [{ messageId: 'first' }],
    },
  ],
});
