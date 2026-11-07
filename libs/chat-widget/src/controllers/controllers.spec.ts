import { RESOLVED_KEYS, type Theme } from '@byteflock/theme/guard';
import acme from '@byteflock/theme/fixtures/valid/acme-light.json';
import globex from '@byteflock/theme/fixtures/valid/globex-dark.json';
import { InMemoryTransport } from '../transport/in-memory';
import {
  ConsentController,
  ConsentRequiredError,
  VISITOR_ID_KEY,
  type StorageBackend,
} from './consent-controller';
import { ThemeController } from './theme-controller';

function fakeMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches,
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  };
  return {
    matchMedia: () => mql as unknown as MediaQueryList,
    set(dark: boolean) {
      mql.matches = dark;
      for (const l of listeners) l();
    },
    listeners,
  };
}

function memoryBackend(): StorageBackend & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('ThemeController (P1.5-T02)', () => {
  it('applies resolved variables and rejects unknown keys', () => {
    const root = document.createElement('div');
    const tc = new ThemeController(null, {
      root,
      matchMedia: fakeMedia(false).matchMedia,
    });
    const rejected = tc.apply({
      '--sem-color-primary': '#123456',
      '--evil': 'red',
      background: 'url(x)',
    } as Record<string, string>);
    expect(rejected).toEqual(['--evil', 'background']);
    expect(root.style.getPropertyValue('--sem-color-primary')).toBe('#123456');
    expect(root.style.getPropertyValue('--evil')).toBe('');
  });

  it('setTheme resolves every RESOLVED_KEY for the theme appearance', () => {
    const root = document.createElement('div');
    const tc = new ThemeController(null, {
      root,
      matchMedia: fakeMedia(false).matchMedia,
    });
    tc.setTheme(globex as Theme);
    expect(root.dataset.appearance).toBe('dark');
    for (const key of RESOLVED_KEYS)
      expect(root.style.getPropertyValue(key)).not.toBe('');
    expect(root.style.getPropertyValue('--sem-color-primary')).toBe(
      globex.color.dark.primary,
    );
  });

  it('system mode follows the viewer preference and stops after disconnect', () => {
    const root = document.createElement('div');
    const media = fakeMedia(false);
    const seen: string[] = [];
    const tc = new ThemeController(null, {
      root,
      matchMedia: media.matchMedia,
      onAppearance: (a) => seen.push(a),
    });
    tc.setTheme({ ...(acme as Theme), appearance: { mode: 'system' } });
    expect(root.style.getPropertyValue('--sem-color-primary')).toBe(
      acme.color.light.primary,
    );
    media.set(true);
    expect(root.dataset.appearance).toBe('dark');
    expect(root.style.getPropertyValue('--sem-color-primary')).toBe(
      acme.color.dark.primary,
    );
    tc.applyAppearance('light');
    expect(media.listeners.size).toBe(0);
    expect(seen).toEqual(['light', 'dark', 'light']);
  });
});

describe('ConsentController (P1.5-T04)', () => {
  it('refuses storage until consent is granted', () => {
    const backend = memoryBackend();
    const cc = new ConsentController('required', backend);
    expect(cc.state).toBe('unknown');
    expect(() => cc.storage.set('x', '1')).toThrow(ConsentRequiredError);
    expect(() => cc.storage.get('x')).toThrow(ConsentRequiredError);
    expect(cc.visitorId()).toBeNull();
    expect(backend.data.size).toBe(0);

    cc.decide(true);
    const id = cc.visitorId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(backend.data.get(VISITOR_ID_KEY)).toBe(id);
    expect(cc.visitorId()).toBe(id);
  });

  it('denial clears the visitor id and blocks storage again', () => {
    const backend = memoryBackend();
    const cc = new ConsentController('required', backend);
    const states: string[] = [];
    cc.onChange((s) => states.push(s));
    cc.decide(true);
    cc.visitorId();
    cc.decide(false);
    expect(backend.data.has(VISITOR_ID_KEY)).toBe(false);
    expect(() => cc.storage.set('x', '1')).toThrow(ConsentRequiredError);
    expect(states).toEqual(['granted', 'denied']);
  });

  it('notRequired allows storage immediately and ignores decisions', () => {
    const backend = memoryBackend();
    const cc = new ConsentController('notRequired', backend);
    expect(cc.visitorId()).not.toBeNull();
    cc.decide(false);
    expect(cc.state).toBe('notRequired');
  });
});

describe('InMemoryTransport (P1.5-T03)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('echoes a reply after 300 ms', async () => {
    const tr = new InMemoryTransport({ reply: (e) => `echo: ${e.text}` });
    const got: string[] = [];
    tr.subscribe((e) => got.push(e.text));
    await tr.connect();
    expect(tr.status).toBe('connected');
    tr.send({ type: 'message', text: 'hello' });
    vi.advanceTimersByTime(299);
    expect(got).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(got).toEqual(['echo: hello']);
  });

  it('holds replies while paused and delivers them on resume', async () => {
    const tr = new InMemoryTransport();
    const got: string[] = [];
    tr.subscribe((e) => got.push(e.id));
    await tr.connect();
    tr.send({ type: 'message', text: 'a' });
    tr.pause();
    vi.advanceTimersByTime(500);
    expect(got).toEqual([]);
    tr.resume();
    expect(got).toEqual(['bot-1']);
  });

  it('drops pending replies on disconnect', async () => {
    const tr = new InMemoryTransport();
    const got: string[] = [];
    tr.subscribe((e) => got.push(e.id));
    await tr.connect();
    tr.send({ type: 'message', text: 'a' });
    tr.disconnect();
    vi.advanceTimersByTime(500);
    expect(got).toEqual([]);
    expect(tr.status).toBe('disconnected');
  });
});
