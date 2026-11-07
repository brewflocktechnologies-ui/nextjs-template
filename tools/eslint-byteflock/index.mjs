// Byteflock custom ESLint rules (P1.6-T03, T05, T06, §4). Loaded as the `byteflock` plugin by the
// dashboard's eslint.config.mjs. Tests: `node --test tools/eslint-byteflock/` (policy check
// check-eslint-rules runs them in `pnpm verify`).
import path from 'node:path';

const norm = (file) => file.split(path.sep).join('/');

/** Files containing a "use cache" directive must not use request-time APIs (Next 16 caching). */
const noRequestApisInCachedScope = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'No cookies(), headers() or next/headers in "use cache" files',
    },
    messages: {
      import:
        'A "use cache" file must not import next/headers (request data would be cached across users).',
      call: 'A "use cache" file must not call {{name}}() (request data would be cached across users).',
    },
    schema: [],
  },
  create(context) {
    const source = context.sourceCode.getText();
    if (!/(['"])use cache(?::[\w-]+)?\1/.test(source)) return {};
    return {
      ImportDeclaration(node) {
        if (node.source.value === 'next/headers')
          context.report({ node, messageId: 'import' });
      },
      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          (node.callee.name === 'cookies' || node.callee.name === 'headers')
        )
          context.report({
            node,
            messageId: 'call',
            data: { name: node.callee.name },
          });
      },
    };
  },
};

/** Query keys only through qk(tenantId, ...), never raw arrays (P1.6-T06). */
const qkOnly = {
  meta: {
    type: 'problem',
    docs: { description: 'queryKey must be built with qk()' },
    messages: {
      raw: 'Build query keys with qk(tenantId, ...) so every key starts with the tenant.',
    },
    schema: [],
  },
  create(context) {
    if (/(^|\/)qk\.ts$/.test(norm(context.filename))) return {};
    return {
      Property(node) {
        const key =
          node.key.type === 'Identifier' ? node.key.name : node.key.value;
        if (key === 'queryKey' && node.value.type === 'ArrayExpression')
          context.report({ node, messageId: 'raw' });
      },
    };
  },
};

/** proxy.ts imports only next/server and the proxy allowlist (T-11). */
const proxyAllowlist = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'proxy.ts may import only next/server and server/proxy-allowlist',
    },
    messages: {
      forbidden:
        'proxy.ts routes only (T-11): import from next/server or ./server/proxy-allowlist, not "{{source}}".',
    },
    schema: [],
  },
  create(context) {
    if (!/(^|\/)proxy\.ts$/.test(norm(context.filename))) return {};
    const allowed = (s) =>
      s === 'next/server' || /(^|\/)server\/proxy-allowlist$/.test(s);
    const check = (node, source) => {
      if (typeof source === 'string' && !allowed(source))
        context.report({ node, messageId: 'forbidden', data: { source } });
    };
    return {
      ImportDeclaration: (node) => check(node, node.source.value),
      ExportNamedDeclaration: (node) =>
        node.source && check(node, node.source.value),
      ExportAllDeclaration: (node) => check(node, node.source.value),
      ImportExpression: (node) =>
        check(
          node,
          node.source.type === 'Literal' ? node.source.value : '<dynamic>',
        ),
    };
  },
};

/** Exported data-access functions take tenantId as their first parameter (ADR-005). */
const dataAccessTenantFirst = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Exported functions in src/data/** take tenantId first',
    },
    messages: {
      first:
        'Data-access function "{{name}}" must take tenantId as its first parameter.',
    },
    schema: [],
  },
  create(context) {
    if (!/(^|\/)src\/data\//.test(norm(context.filename))) return {};
    const check = (fn, name, node) => {
      const first = fn.params[0];
      if (!first || first.type !== 'Identifier' || first.name !== 'tenantId')
        context.report({ node, messageId: 'first', data: { name } });
    };
    return {
      ExportNamedDeclaration(node) {
        const d = node.declaration;
        if (!d) return;
        if (d.type === 'FunctionDeclaration')
          check(d, d.id?.name ?? 'default', d);
        if (d.type === 'VariableDeclaration')
          for (const v of d.declarations)
            if (
              v.init &&
              (v.init.type === 'ArrowFunctionExpression' ||
                v.init.type === 'FunctionExpression')
            )
              check(v.init, v.id.name, v);
      },
    };
  },
};

export default {
  meta: { name: 'byteflock' },
  rules: {
    'no-request-apis-in-cached-scope': noRequestApisInCachedScope,
    'qk-only': qkOnly,
    'proxy-allowlist': proxyAllowlist,
    'data-access-tenant-first': dataAccessTenantFirst,
  },
};
