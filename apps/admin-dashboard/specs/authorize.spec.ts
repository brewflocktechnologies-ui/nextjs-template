// The authorization matrix (P2.1-T06; AC04 at helper level): every role x every action x own and
// other tenant. The expectations are written out, not derived from the implementation.
import {
  ACTIONS,
  ForbiddenError,
  authorize,
  can,
  type Action,
} from '../src/server/authorize';
import type { RequestContext } from '../src/server/session/types';

const tenantAdmin: RequestContext = {
  scope: 'tenant',
  tenantId: 't_acme',
  userId: 'u_acme_admin',
  roles: ['tenant_admin'],
  locale: 'en-AU',
};
const agent: RequestContext = {
  ...tenantAdmin,
  userId: 'u_acme_agent',
  roles: ['agent'],
};
const superAdmin: RequestContext = {
  scope: 'platform',
  userId: 'u_platform_admin',
  roles: ['super_admin'],
  locale: 'en-AU',
};

const READS: Action[] = ['theme.read', 'config.read', 'widget.read'];
const TENANT_ACTIONS = ACTIONS.filter((a) => a !== 'tenants.list');

describe('authorization matrix (P2.1-T06; P2.1-AC04 at helper level)', () => {
  it('lists exactly the actions of the spec', () => {
    expect([...ACTIONS].sort()).toEqual(
      [
        'config.read',
        'config.write',
        'tenants.list',
        'theme.publish',
        'theme.read',
        'theme.write',
        'widget.read',
        'widget.write',
      ].sort(),
    );
  });

  describe.each(TENANT_ACTIONS)('%s', (action) => {
    it('tenant_admin: allowed on own tenant, 403 on another', () => {
      expect(() => authorize(tenantAdmin, 't_acme', action)).not.toThrow();
      expect(() => authorize(tenantAdmin, 't_globex', action)).toThrow(
        ForbiddenError,
      );
    });

    it('agent: read actions on own tenant only; every write refused', () => {
      if (READS.includes(action)) {
        expect(() => authorize(agent, 't_acme', action)).not.toThrow();
      } else {
        expect(() => authorize(agent, 't_acme', action)).toThrow(
          ForbiddenError,
        );
      }
      expect(() => authorize(agent, 't_globex', action)).toThrow(
        ForbiddenError,
      );
    });

    it('super_admin: allowed on every tenant', () => {
      for (const tenant of ['t_acme', 't_globex', 't_initech']) {
        expect(() => authorize(superAdmin, tenant, action)).not.toThrow();
      }
    });
  });

  it('tenants.list is platform-only', () => {
    expect(() => authorize(superAdmin, null, 'tenants.list')).not.toThrow();
    expect(() => authorize(tenantAdmin, null, 'tenants.list')).toThrow(
      ForbiddenError,
    );
    expect(() => authorize(tenantAdmin, 't_acme', 'tenants.list')).toThrow(
      ForbiddenError,
    );
    expect(() => authorize(agent, 't_acme', 'tenants.list')).toThrow(
      ForbiddenError,
    );
  });

  it('refuses a tenant user when no tenant is named, and an unknown role', () => {
    expect(() => authorize(tenantAdmin, null, 'theme.read')).toThrow(
      ForbiddenError,
    );
    const odd = {
      ...tenantAdmin,
      roles: ['owner'],
    } as unknown as RequestContext;
    expect(() => authorize(odd, 't_acme', 'theme.read')).toThrow(
      ForbiddenError,
    );
  });

  it('ForbiddenError carries status 403 and the action', () => {
    let caught: unknown;
    try {
      authorize(agent, 't_acme', 'theme.publish');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ForbiddenError);
    expect((caught as ForbiddenError).status).toBe(403);
    expect((caught as ForbiddenError).action).toBe('theme.publish');
  });

  it('can() mirrors authorize()', () => {
    expect(can(tenantAdmin, 't_acme', 'theme.publish')).toBe(true);
    expect(can(agent, 't_acme', 'theme.publish')).toBe(false);
  });
});
