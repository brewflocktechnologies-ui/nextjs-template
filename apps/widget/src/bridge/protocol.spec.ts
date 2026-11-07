import {
  ERROR_CODES,
  LIMITS,
  RateLimiter,
  createStats,
  isPreviewVars,
  makeEnvelope,
  parseEnvelope,
  validateFrameToHost,
  validateHostToFrame,
  type Envelope,
} from './protocol';

const env = (
  type: string,
  payload: Record<string, unknown> = {},
): Envelope => ({
  v: 1,
  type,
  id: 'test-1',
  payload,
});
const theme = {
  bg: '#1d4ed8',
  fg: '#ffffff',
  radius: 'md',
  icon: 'chat',
  position: 'bottom-right',
  shape: 'circle',
};

describe('BRIDGE-01 envelope', () => {
  it('accepts a well-formed envelope', () => {
    expect(parseEnvelope(env('open')).ok).toBe(true);
  });

  it.each([
    ['a string', 'open'],
    ['an array', [1, 'open', 'x', {}]],
    ['null', null],
    ['v: 2', { v: 2, type: 'open', id: 'x', payload: {} }],
    ['a missing id', { v: 1, type: 'open', payload: {} }],
    ['an empty id', { v: 1, type: 'open', id: '', payload: {} }],
    [
      'an oversized id',
      { v: 1, type: 'open', id: 'x'.repeat(65), payload: {} },
    ],
    ['an oversized type', { v: 1, type: 'a'.repeat(33), id: 'x', payload: {} }],
    ['a type with symbols', { v: 1, type: 'Open!', id: 'x', payload: {} }],
    ['a missing payload', { v: 1, type: 'open', id: 'x' }],
    ['an array payload', { v: 1, type: 'open', id: 'x', payload: [] }],
    [
      'an extra top-level key',
      { v: 1, type: 'open', id: 'x', payload: {}, extra: 1 },
    ],
  ])('BRIDGE-08 drops %s as a malformed envelope', (_label, data) => {
    expect(parseEnvelope(data)).toEqual({ ok: false, reason: 'envelope' });
  });

  it('builds outgoing envelopes that parse', () => {
    const e = makeEnvelope({ type: 'state', payload: { open: true } });
    expect(parseEnvelope(e).ok).toBe(true);
    expect(makeEnvelope({ type: 'open', payload: {} }).id).not.toBe(e.id);
  });
});

describe('BRIDGE-02 frame → host', () => {
  it('accepts every valid message', () => {
    const valid = [
      env('ready', { launcherTheme: theme }),
      env('state', { open: false }),
      env('unread', { count: 3 }),
      env('layout', { mode: 'panel' }),
      env('layout', { mode: 'fullscreen', height: 800 }),
      env('error', { code: 'CONFIG_TIMEOUT' }),
      env('consent.request'),
    ];
    for (const e of valid) expect(validateFrameToHost(e).ok).toBe(true);
  });

  it('accepts every documented error code and nothing else', () => {
    for (const code of ERROR_CODES)
      expect(validateFrameToHost(env('error', { code })).ok).toBe(true);
    expect(
      validateFrameToHost(env('error', { code: 'Something broke' })).ok,
    ).toBe(false);
  });

  it('BRIDGE-08 clamps unread counts to 99', () => {
    const r = validateFrameToHost(env('unread', { count: 500 }));
    expect(r).toEqual({
      ok: true,
      value: { type: 'unread', payload: { count: LIMITS.unreadMax } },
    });
  });

  it('BRIDGE-08 rejects a launcherTheme with an invalid colour', () => {
    expect(
      validateFrameToHost(
        env('ready', { launcherTheme: { ...theme, bg: 'red' } }),
      ),
    ).toEqual({
      ok: false,
      reason: 'payload',
    });
  });

  it.each([
    ['upper-case colour', { ...theme, fg: '#FFFFFF' }],
    ['unknown radius', { ...theme, radius: 'xl' }],
    ['unknown icon', { ...theme, icon: 'phone' }],
    ['unknown position', { ...theme, position: 'top-left' }],
    ['extra key', { ...theme, url: 'https://evil.example' }],
    [
      'missing key',
      {
        bg: '#000000',
        fg: '#ffffff',
        radius: 'md',
        icon: 'chat',
        position: 'bottom-left',
      },
    ],
    ['unknown shape', { ...theme, shape: 'square' }],
  ])('rejects a launcherTheme with %s', (_label, launcherTheme) => {
    expect(validateFrameToHost(env('ready', { launcherTheme })).ok).toBe(false);
  });

  it.each([
    ['state without a boolean', env('state', { open: 'yes' })],
    ['negative unread', env('unread', { count: -1 })],
    ['fractional unread', env('unread', { count: 1.5 })],
    ['layout with a bad mode', env('layout', { mode: 'floating' })],
    [
      'layout with an oversized height',
      env('layout', { mode: 'panel', height: 5000 }),
    ],
    [
      'consent.request with a payload',
      env('consent.request', { granted: true }),
    ],
    ['state with an extra key', env('state', { open: true, text: 'hello' })],
  ])('BRIDGE-08 drops %s', (_label, e) => {
    expect(validateFrameToHost(e)).toEqual({ ok: false, reason: 'payload' });
  });

  it('BRIDGE-08 drops unknown types and host-to-frame types', () => {
    expect(validateFrameToHost(env('message', { text: 'hi' }))).toEqual({
      ok: false,
      reason: 'type',
    });
    expect(validateFrameToHost(env('open'))).toEqual({
      ok: false,
      reason: 'type',
    });
  });
});

describe('BRIDGE-03 host → frame', () => {
  it('accepts every valid message', () => {
    const valid = [
      env('open'),
      env('close'),
      env('consent', { granted: true }),
      env('locale', { tag: 'en-AU' }),
      env('identify', {
        traits: { externalId: 'c-42', name: 'Sam', email: 'sam@example.com' },
      }),
      env('identify', { traits: {} }),
      env('visibility', { hidden: true }),
      env('theme.preview', {
        vars: { '--sem-color-primary': '#0f766e', '--sem-radius-md': '8px' },
      }),
    ];
    for (const e of valid) expect(validateHostToFrame(e).ok).toBe(true);
  });

  it.each([
    ['open with a payload', env('open', { x: 1 })],
    ['consent without a boolean', env('consent', { granted: 'yes' })],
    ['an invalid locale', env('locale', { tag: 'english please' })],
    ['an oversized locale', env('locale', { tag: `en-${'a'.repeat(40)}` })],
    [
      'identify with an unknown trait',
      env('identify', { traits: { phone: '123' } }),
    ],
    [
      'identify with an oversized trait',
      env('identify', { traits: { name: 'x'.repeat(257) } }),
    ],
    [
      'identify with a non-string trait',
      env('identify', { traits: { name: 42 } }),
    ],
    ['visibility without a boolean', env('visibility', { hidden: 1 })],
    ['open with an extra key', env('close', { reason: 'x' })],
  ])('BRIDGE-08 drops %s', (_label, e) => {
    expect(validateHostToFrame(e)).toEqual({ ok: false, reason: 'payload' });
  });

  it('BRIDGE-08 drops unknown types and frame-to-host types', () => {
    expect(validateHostToFrame(env('eval', { code: 'alert(1)' }))).toEqual({
      ok: false,
      reason: 'type',
    });
    expect(validateHostToFrame(env('ready', { launcherTheme: theme }))).toEqual(
      { ok: false, reason: 'type' },
    );
  });
});

describe('theme.preview values (T-02, T-03)', () => {
  it.each([
    ['a CSS injection', { '--sem-color-primary': '#fff;}body{display:none' }],
    ['url()', { '--sem-color-primary': 'url(javascript:alert(1))' }],
    ['expression()', { '--sem-color-primary': 'expression(alert(1))' }],
    ['a non-sem variable', { '--background': '#ffffff' }],
    ['a property name', { color: '#ffffff' }],
    ['braces', { '--sem-font-family-sans': 'Inter } body {' }],
    ['a comment', { '--sem-font-family-sans': 'Inter /* x */' }],
    ['an empty map', {}],
  ])('rejects %s', (_label, vars) => {
    expect(isPreviewVars(vars)).toBe(false);
    expect(validateHostToFrame(env('theme.preview', { vars })).ok).toBe(false);
  });

  it('accepts colours, lengths, numbers and font stacks', () => {
    expect(
      isPreviewVars({
        '--sem-color-primary': '#1d4ed8',
        '--sem-color-backdrop': '#0f172a80',
        '--sem-radius-md': '8px',
        '--sem-density-factor': '0.85',
        '--sem-font-family-sans': '"Source Sans 3", system-ui, sans-serif',
      }),
    ).toBe(true);
  });
});

describe('BRIDGE-05 rate limiting', () => {
  it('BRIDGE-08 processes at most 20 of a 200-message flood in one second', () => {
    const limiter = new RateLimiter();
    const stats = createStats();
    let processed = 0;
    for (let i = 0; i < 200; i++) {
      const now = 1_000 + (i * 1000) / 200; // spread over one second
      if (limiter.take('open', now)) processed++;
      else stats['dropped.rate_limited']++;
    }
    // 20 from the full bucket plus up to 20 refilled during the second.
    expect(processed).toBeLessThanOrEqual(40);
    expect(stats['dropped.rate_limited']).toBeGreaterThanOrEqual(160);
  });

  it('allows a burst of exactly 20 and then refuses until it refills', () => {
    const limiter = new RateLimiter();
    const at = 5_000;
    for (let i = 0; i < 20; i++) expect(limiter.take('open', at)).toBe(true);
    expect(limiter.take('open', at)).toBe(false);
    expect(limiter.take('open', at + 100)).toBe(true); // 2 tokens refilled after 100 ms
  });

  it('keeps one bucket per type', () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < 20; i++) limiter.take('open', 0);
    expect(limiter.take('open', 0)).toBe(false);
    expect(limiter.take('close', 0)).toBe(true);
  });
});
