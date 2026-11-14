// Launcher behaviour in jsdom: opening and closing the panel repeatedly keeps exactly one
// visualViewport listener while open and none while closed (no listener build-up).
import { mount } from './index';

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
