import React from 'react';
import { render } from '@testing-library/react';
import Page from '../src/app/page';

// The page reads the request context from cookies and Postgres, which a unit test has no request
// for (and `pg` does not load under jsdom). Covered by the request-context and e2e tests.
jest.mock('../src/server/request-context', () => ({
  getTenantContext: jest.fn(),
}));
jest.mock('../src/data/tenant-config', () => ({
  getTenantConfig: jest.fn(),
}));
jest.mock('../src/server/tenant-config/modules', () => ({
  isModuleEnabled: jest.fn(),
}));
jest.mock('../src/server/tenant-theme', () => ({
  tenantThemeView: jest.fn(),
}));

describe('Page', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Page />);
    expect(baseElement).toBeTruthy();
  });
});
