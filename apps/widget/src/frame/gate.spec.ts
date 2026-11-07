import { gate, resolveParentOrigin, toOrigin, type GateState } from './gate';

const host = 'http://localhost:4300';
const fresh: GateState = { expected: host, pinned: null };

describe('BRIDGE-04 message gate', () => {
  it('accepts the first message from the parent at the expected origin and pins it', () => {
    const r = gate(fresh, host, true);
    expect(r).toEqual({ ok: true, state: { expected: host, pinned: host } });
  });

  it('BRIDGE-08 drops a message from the wrong origin', () => {
    expect(gate(fresh, 'https://evil.example', true)).toEqual({ ok: false, reason: 'origin' });
  });

  it('BRIDGE-08 drops a message from the right origin but another window', () => {
    expect(gate(fresh, host, false)).toEqual({ ok: false, reason: 'source' });
  });

  it('keeps the pinned origin for the lifetime of the frame', () => {
    const pinned: GateState = { expected: host, pinned: host };
    expect(gate(pinned, host, true).ok).toBe(true);
    expect(gate(pinned, 'http://localhost:3000', true)).toEqual({ ok: false, reason: 'origin' });
  });

  it('accepts nothing when no parent origin is known', () => {
    expect(gate({ expected: null, pinned: null }, host, true)).toEqual({ ok: false, reason: 'origin' });
  });
});

describe('BRIDGE-04 parent origin resolution', () => {
  it('prefers location.ancestorOrigins', () => {
    expect(resolveParentOrigin(host, null)).toEqual({ ok: true, origin: host, source: 'ancestorOrigins' });
  });

  it('falls back to the parent parameter (Firefox before 148)', () => {
    expect(resolveParentOrigin(undefined, encodeURI(host))).toEqual({
      ok: true,
      origin: host,
      source: 'parent-param',
    });
  });

  it('refuses when ancestorOrigins and the parameter disagree', () => {
    expect(resolveParentOrigin(host, 'https://evil.example')).toEqual({ ok: false, reason: 'ORIGIN_MISMATCH' });
  });

  it('treats the same origin with a path as a match', () => {
    expect(resolveParentOrigin(host, `${host}/some/page?x=1`).ok).toBe(true);
  });

  it('reports no parent when neither is usable', () => {
    expect(resolveParentOrigin(undefined, 'javascript:alert(1)')).toEqual({ ok: false, reason: 'NO_PARENT' });
    expect(resolveParentOrigin(undefined, null)).toEqual({ ok: false, reason: 'NO_PARENT' });
  });

  it('only turns http(s) URLs into origins', () => {
    expect(toOrigin('data:text/html,hi')).toBeNull();
    expect(toOrigin('not a url')).toBeNull();
    expect(toOrigin('https://customer.example:8443/path')).toBe('https://customer.example:8443');
  });
});
