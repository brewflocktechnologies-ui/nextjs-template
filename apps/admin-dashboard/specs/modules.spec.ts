/**
 * @jest-environment node
 */
// Module gating helpers (P2.1-T09, CONFIG-01).
jest.mock('server-only', () => ({}));
jest.mock('next/navigation', () => ({ notFound: jest.fn() }));

import { ACTIONS } from '../src/server/authorize';
import { moduleOfAction } from '../src/server/tenant-config/modules';

describe('moduleOfAction (P2.1-T09)', () => {
  it('maps theme actions to themeEditor and widget actions to widgetSettings', () => {
    expect(moduleOfAction('theme.read')).toBe('themeEditor');
    expect(moduleOfAction('theme.write')).toBe('themeEditor');
    expect(moduleOfAction('theme.publish')).toBe('themeEditor');
    expect(moduleOfAction('widget.read')).toBe('widgetSettings');
    expect(moduleOfAction('widget.write')).toBe('widgetSettings');
  });

  it('gates nothing else: config and platform actions are never switched off', () => {
    expect(moduleOfAction('config.read')).toBeNull();
    expect(moduleOfAction('config.write')).toBeNull();
    expect(moduleOfAction('tenants.list')).toBeNull();
  });

  it('every action is either gated by a module or deliberately ungated', () => {
    const gated = ACTIONS.filter((a) => moduleOfAction(a) !== null);
    expect(gated.sort()).toEqual([
      'theme.publish',
      'theme.read',
      'theme.write',
      'widget.read',
      'widget.write',
    ]);
  });
});
