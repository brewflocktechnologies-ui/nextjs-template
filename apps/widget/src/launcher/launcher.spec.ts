// Launcher behaviour in jsdom: opening and closing the panel repeatedly keeps exactly one
// visualViewport listener while open and none while closed (no listener build-up).
import { mount } from './index';
import { launcherDir, launcherStrings } from './strings';

describe('launcher viewport tracking', () => {
  const listeners = new Set<EventListenerOrEventListenerObject>();
  const fakeViewport = {
    height: 500,
    addEventListener: (_: string, l: EventListenerOrEventListenerObject) =>
      listeners.add(l),
    removeEventListener: (_: string, l: EventListenerOrEventListenerObject) =>
      listeners.delete(l),
  };

  beforeEach(() => {
    listeners.clear();
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: fakeViewport,
    });
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('adds one listener while open and removes it on close, however often it opens', () => {
    const script = document.createElement('script');
    mount({
      widgetOrigin: 'http://localhost:4400',
      widgetKey: 'wk_test',
      frameStrategy: 'open',
      script,
    });
    const host = document.querySelector('[data-byteflock-launcher]');
    const button = host?.shadowRoot?.querySelector(
      'button.launcher',
    ) as HTMLButtonElement;

    for (let i = 0; i < 3; i++) {
      button.click();
      expect(listeners.size).toBe(1);
      button.click();
      expect(listeners.size).toBe(0);
    }
    button.click();
    const panel = host?.shadowRoot?.querySelector('.panel') as HTMLElement;
    expect(panel.style.getPropertyValue('--bf-viewport-height')).toBe('500px');
  });
});

describe('launcher strings and direction', () => {
  afterEach(() => document.body.replaceChildren());

  it('translates the name, unread count and unavailable state, with plural rules', () => {
    expect(launcherStrings('fr-CA').name).toBe('Discussion');
    expect(launcherStrings('fr').unread(0)).toBe('0 message non lu');
    expect(launcherStrings('fr').unread(2)).toBe('2 messages non lus');
    expect(launcherStrings('de').unread(1)).toBe('1 ungelesene Nachricht');
    expect(launcherStrings('es').unavailableTitle).toBe('Chat no disponible');
    expect(launcherStrings('xx').unread(3)).toBe('3 unread messages');
  });

  it('writes right to left for Arabic, Hebrew, Persian and Urdu only', () => {
    expect(['ar', 'he-IL', 'fa', 'ur'].map(launcherDir)).toEqual([
      'rtl',
      'rtl',
      'rtl',
      'rtl',
    ]);
    expect(launcherDir('en-AU')).toBe('ltr');
  });

  it('applies the locale to the button: name and direction', () => {
    mount({
      widgetOrigin: 'http://localhost:4400',
      widgetKey: 'wk_test',
      locale: 'ar',
      frameStrategy: 'open',
      script: document.createElement('script'),
    });
    const button = document
      .querySelector('[data-byteflock-launcher]')
      ?.shadowRoot?.querySelector('button.launcher');
    expect(button?.getAttribute('dir')).toBe('rtl');
    expect(button?.getAttribute('aria-label')).toBe('Chat');
  });
});
